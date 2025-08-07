// Load environment variables
require("dotenv").config();

const amqp = require("amqplib");
const pLimit = require("p-limit");
// Create a concurrency limiter for better resource management - reduced to 1 for IMAP stability
const limit = pLimit(1);

// Create a separate IMAP connection limiter for cron jobs to prevent connection timeouts
const imapConnectionLimit = pLimit(1); // Only 1 IMAP connection at a time

// Global IMAP operation lock to prevent ANY concurrent IMAP operations across ALL processes
let globalImapLock = false;
let currentImapOperation = null;

// Global IMAP lock with enhanced logging
async function acquireGlobalImapLock(adminId, operation = "UNKNOWN") {
  while (globalImapLock) {
    console.log(
      `[IMAP-LOCK] AdminId ${adminId} waiting for global IMAP lock (currently held by ${currentImapOperation})`
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
  }

  globalImapLock = true;
  currentImapOperation = `AdminId-${adminId}-${operation}`;
  console.log(`[IMAP-LOCK] 🔒 ACQUIRED by ${currentImapOperation}`);
}

function releaseGlobalImapLock(adminId, operation = "UNKNOWN") {
  if (globalImapLock) {
    console.log(`[IMAP-LOCK] 🔓 RELEASED by AdminId-${adminId}-${operation}`);
    globalImapLock = false;
    currentImapOperation = null;
  }
}

// Circuit breaker for problematic users - tracks failed connections
const userFailureTracker = new Map(); // Map<userId, { failures: number, lastFailure: timestamp, blocked: boolean }>

// Function to check if user should be temporarily blocked
function shouldSkipUser(adminId) {
  const userInfo = userFailureTracker.get(adminId);
  if (!userInfo) return false;

  // Block user for 10 minutes after 3 consecutive failures
  if (userInfo.failures >= 3) {
    const timeSinceLastFailure = Date.now() - userInfo.lastFailure;
    if (timeSinceLastFailure < 10 * 60 * 1000) {
      // 10 minutes
      return true;
    } else {
      // Reset after cooldown period
      userFailureTracker.delete(adminId);
      return false;
    }
  }
  return false;
}

// Function to record user failure
function recordUserFailure(adminId, error) {
  const userInfo = userFailureTracker.get(adminId) || {
    failures: 0,
    lastFailure: 0,
  };
  userInfo.failures += 1;
  userInfo.lastFailure = Date.now();
  userFailureTracker.set(adminId, userInfo);

  console.warn(
    `[CronWorker] User ${adminId} failure count: ${userInfo.failures}/3 (${error})`
  );

  if (userInfo.failures >= 3) {
    console.error(
      `[CronWorker] User ${adminId} temporarily blocked for 10 minutes due to repeated failures`
    );
  }
}

// Function to record user success
function recordUserSuccess(adminId) {
  userFailureTracker.delete(adminId); // Clear failure tracking on success
}

// Helper function to publish jobs to queue
async function publishToQueue(queueName, data) {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  let connection, channel;

  try {
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(queueName, { durable: true });

    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error(`Error publishing to queue ${queueName}:`, error);
    if (channel) await channel.close().catch(() => {});
    if (connection) await connection.close().catch(() => {});
    throw error;
  }
}

// Global counters for tracking email fetching statistics
const emailStats = {
  totalFetched: 0,
  userStats: {}, // Track per-user statistics
  sessionStartTime: new Date(),
};

// Function to get current email statistics
const getEmailStatistics = () => {
  const sessionDuration = Math.floor(
    (new Date() - emailStats.sessionStartTime) / 1000 / 60
  ); // minutes
  return {
    totalFetched: emailStats.totalFetched,
    sessionDuration: `${sessionDuration} minutes`,
    userStats: emailStats.userStats,
    sessionStartTime: emailStats.sessionStartTime.toISOString(),
  };
};

// Function to display current statistics
const displayEmailStatistics = () => {
  const stats = getEmailStatistics();
  console.log(`
════════════════════════════════════════════
📊 CURRENT EMAIL FETCHING STATISTICS
════════════════════════════════════════════
🌍 SESSION TOTAL: ${stats.totalFetched} emails fetched
⏱️  Session Duration: ${stats.sessionDuration}
🕐 Started: ${stats.sessionStartTime}
👥 Users: ${Object.keys(stats.userStats).length} active

📋 USER BREAKDOWN:
${Object.entries(stats.userStats)
  .map(
    ([userId, data]) =>
      `   User ${userId}: ${data.fetched} emails (${data.batches} batches)`
  )
  .join("\n")}
════════════════════════════════════════════
`);
};
const { fetchRecentEmail } = require("../controllers/email/emailController");
const {
  fetchSyncEmails,
} = require("../controllers/email/emailSettingController");
const nodemailer = require("nodemailer");
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const UserCredential = require("../models/email/userCredentialModel");
const DefaultEmail = require("../models/email/defaultEmailModel");
const MasterUser = require("../models/master/masterUserModel");
const { fetchInboxEmails } = require("../controllers/email/emailController");
const { batch } = require("googleapis/build/src/apis/batch");
const QUEUE_NAME = "email-fetch-queue";
const SCHEDULED_QUEUE = "scheduled-email-queue";
const QUEUE = "EMAIL_QUEUE";
const PROVIDER_SMTP_CONFIG = {
  gmail: {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  },
  yandex: {
    host: "smtp.yandex.com",
    port: 465,
    secure: true,
  },
  // Add more providers as needed
};

// const limit = pLimit(5); // Limit concurrency to 5

// Utility: Log memory usage for diagnostics
async function logMemoryUsage(context = "") {
  const mem = process.memoryUsage();
  const rss = (mem.rss / 1024 / 1024).toFixed(1);
  const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
  const external = (mem.external / 1024 / 1024).toFixed(1);

  console.log(
    `[Memory] ${context} RSS: ${rss}MB, Heap: ${heapUsed}MB / ${heapTotal}MB, External: ${external}MB`
  );

  // Warning if memory usage is high - reduced threshold for earlier intervention
  if (mem.heapUsed > 250 * 1024 * 1024) {
    // Reduced from 300MB to 250MB for earlier warning
    console.warn(
      `[Memory Warning] High heap usage: ${heapUsed}MB - Consider restarting worker`
    );

    // Force garbage collection if memory is high
    if (mem.heapUsed > 300 * 1024 * 1024 && global.gc) {
      console.log(
        `[Memory] Forcing garbage collection due to high usage: ${heapUsed}MB`
      );
      global.gc();
      global.gc(); // Double GC for thorough cleanup

      // Log memory after cleanup
      const memAfter = process.memoryUsage();
      const heapAfter = (memAfter.heapUsed / 1024 / 1024).toFixed(1);
      console.log(
        `[Memory] After cleanup: ${heapAfter}MB (freed ${(
          heapUsed - heapAfter
        ).toFixed(1)}MB)`
      );
    }

    // Emergency cleanup if memory is very high (approaching PM2 restart threshold)
    if (mem.heapUsed > 450 * 1024 * 1024) {
      console.error(
        `[Memory CRITICAL] Memory usage ${heapUsed}MB approaching 500MB restart limit - forcing emergency cleanup`
      );
      if (global.gc) {
        global.gc();
        global.gc();
        global.gc(); // Triple GC for emergency cleanup

        // Wait for GC to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        const memEmergency = process.memoryUsage();
        const heapEmergency = (memEmergency.heapUsed / 1024 / 1024).toFixed(1);
        console.log(
          `[Memory CRITICAL] After emergency cleanup: ${heapEmergency}MB`
        );
      }
    }
  }
}

// Add process-level error handling
process.on("unhandledRejection", (reason, p) => {
  console.error("[FATAL] Unhandled Rejection at:", p, "reason:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  process.exit(1);
});

// Patch all worker consumers to log memory and always close connections
async function startWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";

  const connection = await amqp.connect(amqpUrl);
  console.log("Connected to RabbitMQ");
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Set prefetch to 1 to ensure only one message is processed at a time
  channel.prefetch(1);

  channel.consume(
    QUEUE_NAME,
    async (msg) => {
      if (msg !== null) {
        // Enforce small batch size and log memory for fetchRecentEmail
        const { adminId } = JSON.parse(msg.content.toString());
        logMemoryUsage(`Before fetchRecentEmail for adminId ${adminId}`);
        try {
          await limit(async () => {
            // Pass smaller batch size to fetchRecentEmail for memory safety
            await fetchRecentEmail(adminId, { batchSize: 5 });
          });
          channel.ack(msg);
        } catch (error) {
          console.error(
            `Error processing email fetch for adminId ${adminId}:`,
            error
          );
          channel.nack(msg, false, false); // Discard the message on error
        } finally {
          logMemoryUsage(`After fetchRecentEmail for adminId ${adminId}`);
          // Force garbage collection
          if (global.gc) {
            global.gc();
          }
        }
      }
    },
    { noAck: false }
  );

  console.log("Email fetch worker started and waiting for jobs...");
}

async function startScheduledEmailWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";

  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(SCHEDULED_QUEUE, { durable: true });

  // Set prefetch to 1 to ensure only one message is processed at a time
  channel.prefetch(1);

  channel.consume(
    SCHEDULED_QUEUE,
    async (msg) => {
      if (msg !== null) {
        const { emailID } = JSON.parse(msg.content.toString());
        try {
          const email = await Email.findByPk(emailID, {
            include: [{ model: Attachment, as: "attachments" }],
          });
          if (!email) return channel.ack(msg);

          // Fetch sender credentials
          const userCredential = await UserCredential.findOne({
            where: { masterUserID: email.masterUserID },
          });
          if (!userCredential) return channel.ack(msg);
          const provider = userCredential.provider; // default to gmail
          // Send email
          let transporterConfig;
          if (provider === "gmail" || provider === "yandex") {
            const smtp = PROVIDER_SMTP_CONFIG[provider];
            transporterConfig = {
              host: smtp.host,
              port: smtp.port,
              secure: smtp.secure,
              auth: {
                user: userCredential.email,
                pass: userCredential.appPassword,
              },
            };
          } else if (provider === "custom") {
            transporterConfig = {
              host: userCredential.smtpHost,
              port: userCredential.smtpPort,
              secure: userCredential.smtpSecure, // true/false
              auth: {
                user: userCredential.email,
                pass: userCredential.appPassword,
              },
            };
          } else {
            // fallback to gmail
            transporterConfig = {
              service: "gmail",
              auth: {
                user: userCredential.email,
                pass: userCredential.appPassword,
              },
            };
          }
          const transporter = nodemailer.createTransport(transporterConfig);

          const info = await transporter.sendMail({
            from: userCredential.email,
            to: email.recipient,
            cc: email.cc,
            bcc: email.bcc,
            subject: email.subject,
            text: email.body,
            html: email.body,
            attachments: email.attachments.map((att) => ({
              filename: att.filename,
              path: att.path,
            })),
          });

          // Move email to sent
          await email.update({
            folder: "sent",
            createdAt: new Date(),
            messageId: info.messageId,
          });
          console.log(`Scheduled email sent: ${email.subject}`);

          channel.ack(msg);
        } catch (err) {
          console.error("Failed to send scheduled email:", err);
          channel.nack(msg, false, false); // Discard on error
        }
      }
    },
    { noAck: false }
  );

  console.log("Scheduled email worker started and waiting for jobs...");
}

// Add user-specific scheduled email workers for parallel processing
async function startUserSpecificScheduledWorkers() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";

  // Get all users with credentials to create user-specific scheduled queues
  let userCredentials = [];
  try {
    userCredentials = await UserCredential.findAll({
      attributes: ["masterUserID"],
      group: ["masterUserID"], // Ensure unique users
    });
    console.log(
      `[ScheduledWorker] Found ${userCredentials.length} users for scheduled email queues`
    );
  } catch (error) {
    console.error("[ScheduledWorker] Error fetching user credentials:", error);
    return;
  }

  // Create a worker for each user's scheduled queue
  for (const credential of userCredentials) {
    const userScheduledQueueName = `SCHEDULED_EMAIL_QUEUE_${credential.masterUserID}`;

    try {
      const connection = await amqp.connect(amqpUrl);
      const channel = await connection.createChannel();
      await channel.assertQueue(userScheduledQueueName, { durable: true });

      console.log(
        `[ScheduledWorker] Listening to queue: ${userScheduledQueueName}`
      );

      // Set prefetch to 1 to ensure only one message is processed at a time per user
      channel.prefetch(1);

      channel.consume(
        userScheduledQueueName,
        async (msg) => {
          if (msg !== null) {
            const { emailID } = JSON.parse(msg.content.toString());

            try {
              const email = await Email.findByPk(emailID, {
                include: [{ model: Attachment, as: "attachments" }],
              });
              if (!email) {
                console.log(
                  `[ScheduledWorker] Email ${emailID} not found, skipping`
                );
                return channel.ack(msg);
              }

              console.log(
                `[ScheduledWorker] Processing scheduled email ${emailID} for user ${email.masterUserID}`
              );

              // Fetch sender credentials
              const userCredential = await UserCredential.findOne({
                where: { masterUserID: email.masterUserID },
              });
              if (!userCredential) {
                console.error(
                  `[ScheduledWorker] No credentials found for user ${email.masterUserID}`
                );
                return channel.ack(msg);
              }

              const provider = userCredential.provider || "gmail";

              // Send email
              let transporterConfig;
              if (provider === "gmail" || provider === "yandex") {
                const smtp = PROVIDER_SMTP_CONFIG[provider];
                transporterConfig = {
                  host: smtp.host,
                  port: smtp.port,
                  secure: smtp.secure,
                  auth: {
                    user: userCredential.email,
                    pass: userCredential.appPassword,
                  },
                };
              } else if (provider === "custom") {
                transporterConfig = {
                  host: userCredential.smtpHost,
                  port: userCredential.smtpPort,
                  secure: userCredential.smtpSecure,
                  auth: {
                    user: userCredential.email,
                    pass: userCredential.appPassword,
                  },
                };
              } else {
                // fallback to gmail
                transporterConfig = {
                  service: "gmail",
                  auth: {
                    user: userCredential.email,
                    pass: userCredential.appPassword,
                  },
                };
              }

              const transporter =
                nodemailer.createTransporter(transporterConfig);

              const info = await transporter.sendMail({
                from: userCredential.email,
                to: email.recipient,
                cc: email.cc,
                bcc: email.bcc,
                subject: email.subject,
                text: email.body,
                html: email.body,
                attachments: email.attachments.map((att) => ({
                  filename: att.filename,
                  path: att.path,
                })),
              });

              // Move email to sent
              await email.update({
                folder: "sent",
                createdAt: new Date(),
                messageId: info.messageId,
              });

              console.log(
                `[ScheduledWorker] Scheduled email sent for user ${email.masterUserID}: ${email.subject}`
              );
              channel.ack(msg);
            } catch (err) {
              console.error(
                `[ScheduledWorker] Failed to send scheduled email ${emailID}:`,
                err
              );
              channel.nack(msg, false, false); // Discard on error
            }
          }
        },
        { noAck: false }
      );

      // Add connection error handling
      connection.on("error", (err) => {
        console.error(
          `AMQP connection error in ${userScheduledQueueName}:`,
          err
        );
      });

      connection.on("close", () => {
        console.log(
          `AMQP connection closed in ${userScheduledQueueName}. Attempting to reconnect...`
        );
        setTimeout(() => startUserSpecificScheduledWorkers(), 5000);
      });
    } catch (error) {
      console.error(
        `[ScheduledWorker] Error setting up queue ${userScheduledQueueName}:`,
        error
      );
    }
  }

  console.log(
    "User-specific scheduled workers started and waiting for jobs..."
  );
}

//......................................................................
// async function sendQueuedEmail(emailData) {
//   // Fetch sender credentials (prefer DefaultEmail)
//   let SENDER_EMAIL = emailData.sender;
//   let SENDER_PASSWORD;
//   let SENDER_NAME = emailData.senderName;
//   let signatureBlock = "";
//   let userCredential;

//   // If you need to fetch password from DB:
//   if (!emailData.senderPassword) {
//     const defaultEmail = await DefaultEmail.findOne({
//       where: { masterUserID: emailData.masterUserID, isDefault: true },
//     });
//     if (defaultEmail) {
//       SENDER_PASSWORD = defaultEmail.appPassword;
//     } else {
//       userCredential = await UserCredential.findOne({
//         where: { masterUserID: emailData.masterUserID },
//       });
//       SENDER_PASSWORD = userCredential ? userCredential.appPassword : "";
//     }
//   } else {
//     SENDER_PASSWORD = emailData.senderPassword;
//   }

//   // Build signature block if needed (optional)
//   if (!userCredential) {
//     userCredential = await UserCredential.findOne({
//       where: { masterUserID: emailData.masterUserID },
//     });
//   }
//   if (userCredential) {
//     if (userCredential.signatureName) {
//       signatureBlock += `<strong>${userCredential.signatureName}</strong><br>`;
//     }
//     if (userCredential.signature) {
//       signatureBlock += `${userCredential.signature}<br>`;
//     }
//     if (userCredential.signatureImage) {
//       signatureBlock += `<img src="${userCredential.signatureImage}" alt="Signature Image" style="max-width:200px;"/><br>`;
//     }
//   }

//   let emailBody = emailData.body || "";
//   if (signatureBlock && !emailBody.includes(signatureBlock)) {
//     emailBody += `<br><br>${signatureBlock}`;
//   }

//   // Prepare mail options
//   const mailOptions = {
//     from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
//     to: emailData.recipient,
//     cc: emailData.cc,
//     bcc: emailData.bcc,
//     subject: emailData.subject,
//     html: emailBody,
//     text: emailBody,
//     attachments: (emailData.attachments || []).map(att => ({
//       filename: att.filename,
//       path: att.path,
//     })),
//     inReplyTo: emailData.inReplyTo || undefined,
//     references: emailData.references || undefined,
//   };

//   // Send email
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: SENDER_EMAIL,
//       pass: SENDER_PASSWORD,
//     },
//   });

//   const info = await transporter.sendMail(mailOptions);

//   // Save email to DB with real messageId
//   const savedEmail = await Email.create({
//     messageId: info.messageId,
//     inReplyTo: emailData.inReplyTo || null,
//     references: emailData.references || null,
//     sender: SENDER_EMAIL,
//     senderName: SENDER_NAME,
//     recipient: emailData.recipient,
//     cc: emailData.cc,
//     bcc: emailData.bcc,
//     subject: emailData.subject,
//     body: emailBody,
//     folder: "sent",
//     createdAt: emailData.createdAt || new Date(),
//     masterUserID: emailData.masterUserID,
//     tempMessageId: emailData.tempMessageId,
//     isDraft: false,
//     // ...any other fields you need...
//   });

//   // Save attachments if any
//   if (emailData.attachments && emailData.attachments.length > 0) {
//     const savedAttachments = emailData.attachments.map(file => ({
//       emailID: savedEmail.emailID,
//       filename: file.filename,
//       filePath: file.path,
//       size: file.size,
//       contentType: file.contentType,
//     }));
//     await Attachment.bulkCreate(savedAttachments);
//   }

//   console.log(`Queued email sent and saved: ${info.messageId}`);
// }

// --- Update EMAIL_QUEUE consumer ---
// async function startEmailWorker() {
//   const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
//   const connection = await amqp.connect(amqpUrl);
//   const channel = await connection.createChannel();
//   await channel.assertQueue(QUEUE, { durable: true });

//   channel.consume(
//     QUEUE,
//     async (msg) => {
//       if (msg !== null) {
//         const emailData = JSON.parse(msg.content.toString());
//         limit(() =>
//           sendQueuedEmail(emailData)
//             .then(() => channel.ack(msg))
//             .catch((err) => {
//               console.error("Failed to send queued email:", err);
//               channel.nack(msg, false, false); // Discard on error
//             })
//         );
//       }
//     },
//     { noAck: false }
//   );

//   console.log("Email worker started and waiting for jobs...");
// }

///.......................new............

async function startEmailWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  let connection, channel;

  async function connect() {
    try {
      connection = await amqp.connect(amqpUrl);
      channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });

      channel.consume(
        QUEUE,
        async (msg) => {
          if (msg !== null) {
            const emailData = JSON.parse(msg.content.toString());
            limit(() =>
              sendEmailJob(emailData)
                .then(() => {
                  if (channel.connection.stream.writable) channel.ack(msg);
                })
                .catch((err) => {
                  console.error("Failed to send queued email:", err);
                  if (channel.connection.stream.writable)
                    channel.nack(msg, false, false);
                })
            );
          }
        },
        { noAck: false }
      );

      connection.on("error", (err) => {
        console.error("AMQP connection error:", err);
      });

      connection.on("close", () => {
        console.error("AMQP connection closed. Reconnecting in 5s...");
        setTimeout(connect, 5000);
      });

      console.log("Email worker started and waiting for jobs...");
    } catch (err) {
      console.error("Failed to connect to RabbitMQ:", err);
      setTimeout(connect, 5000);
    }
  }

  connect();
}
async function sendEmailJob(emailData) {
  let draftEmail = null;
  let SENDER_EMAIL = emailData.sender;
  let SENDER_PASSWORD;
  let SENDER_NAME = emailData.senderName;
  let signatureBlock = "";
  let userCredential;

  // Define baseURL for attachment file paths
  const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";

  // Fetch password if not provided
  if (!emailData.senderPassword) {
    const defaultEmail = await DefaultEmail.findOne({
      where: { masterUserID: emailData.masterUserID, isDefault: true },
    });
    if (defaultEmail) {
      SENDER_PASSWORD = defaultEmail.appPassword;
    } else {
      userCredential = await UserCredential.findOne({
        where: { masterUserID: emailData.masterUserID },
      });
      SENDER_PASSWORD = userCredential ? userCredential.appPassword : "";
    }
  } else {
    SENDER_PASSWORD = emailData.senderPassword;
  }

  // Build signature block if needed
  if (!userCredential) {
    userCredential = await UserCredential.findOne({
      where: { masterUserID: emailData.masterUserID },
    });
  }
  if (userCredential) {
    if (userCredential.signatureName) {
      signatureBlock += `<strong>${userCredential.signatureName}</strong><br>`;
    }
    if (userCredential.signature) {
      signatureBlock += `${userCredential.signature}<br>`;
    }
    if (userCredential.signatureImage) {
      signatureBlock += `<img src="${userCredential.signatureImage}" alt="Signature Image" style="max-width:200px;"/><br>`;
    }
  }

  let emailBody = emailData.body || "";
  if (signatureBlock && !emailBody.includes(signatureBlock)) {
    emailBody += `<br><br>${signatureBlock}`;
  }

  // Prepare mail options
  const mailOptions = {
    from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
    to: emailData.recipient || (draftEmail && draftEmail.recipient),
    cc: emailData.cc || (draftEmail && draftEmail.cc),
    bcc: emailData.bcc || (draftEmail && draftEmail.bcc),
    subject: emailData.subject,
    html: emailBody,
    text: emailBody,
    attachments: (emailData.attachments || []).map((att) => ({
      filename: att.filename,
      path: att.path,
    })),
    inReplyTo: emailData.inReplyTo || undefined,
    references: emailData.references || undefined,
  };

  // Send email
  const provider =
    emailData.provider ||
    (typeof defaultEmail !== "undefined" && defaultEmail?.provider) ||
    userCredential?.provider;

  let transporterConfig;
  if (provider === "gmail" || provider === "yandex") {
    const smtp = PROVIDER_SMTP_CONFIG[provider];
    transporterConfig = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: SENDER_EMAIL,
        pass: SENDER_PASSWORD,
      },
    };
  } else if (provider === "custom") {
    transporterConfig = {
      host: userCredential.smtpHost,
      port: userCredential.smtpPort,
      secure: userCredential.smtpSecure, // true/false
      auth: {
        user: SENDER_EMAIL,
        pass: SENDER_PASSWORD,
      },
    };
  } else {
    // fallback to gmail
    transporterConfig = {
      service: "gmail",
      auth: {
        user: SENDER_EMAIL,
        pass: SENDER_PASSWORD,
      },
    };
  }

  const transporter = nodemailer.createTransport(transporterConfig);
  // const transporter = nodemailer.createTransport({
  //   service: "gmail",
  //   auth: {
  //     user: SENDER_EMAIL,
  //     pass: SENDER_PASSWORD,
  //   },
  // });

  const info = await transporter.sendMail(mailOptions);

  // --- Save or update email and attachments ---
  if (emailData.draftId) {
    // Update the existing draft to "sent"
    const draftEmail = await Email.findOne({
      where: {
        draftId: emailData.draftId,
        masterUserID: emailData.masterUserID,
        folder: "drafts",
      },
    });
    if (draftEmail) {
      await draftEmail.update({
        messageId: info.messageId,
        inReplyTo: emailData.inReplyTo,
        references: emailData.references,
        sender: SENDER_EMAIL,
        senderName: SENDER_NAME,
        recipient: emailData.recipient,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        body: emailBody,
        folder: "sent",
        createdAt: emailData.createdAt,
        isDraft: false,
        tempMessageId: emailData.tempMessageId,
        // attachments: emailData.attachments,
      });
      // Remove old attachments
      await Attachment.destroy({ where: { emailID: draftEmail.emailID } });
      // Save new attachments
      if (emailData.attachments && emailData.attachments.length > 0) {
        const savedAttachments = emailData.attachments.map((file) => ({
          emailID: draftEmail.emailID,
          filename: file.filename,
          filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
            file.filename
          )}`,
          // filePath: file.path,
          size: file.size,
          contentType: file.contentType,
        }));
        await Attachment.bulkCreate(savedAttachments);
      }
      console.log(`Draft email sent and updated: ${info.messageId}`);
    }
  } else {
    // Create a new sent email (no existing email to update since we don't save in composeEmail anymore)
    const savedEmail = await Email.create({
      messageId: info.messageId,
      inReplyTo: emailData.inReplyTo || null,
      references: emailData.references || null,
      sender: SENDER_EMAIL,
      senderName: SENDER_NAME,
      recipient: emailData.recipient,
      cc: emailData.cc,
      bcc: emailData.bcc,
      subject: emailData.subject,
      body: emailBody,
      folder: "sent",
      createdAt: emailData.createdAt || new Date(),
      masterUserID: emailData.masterUserID,
      tempMessageId: emailData.tempMessageId,
      isDraft: false,
    });

    // Save attachments if any (for user-uploaded files in compose email)
    if (emailData.attachments && emailData.attachments.length > 0) {
      const savedAttachments = emailData.attachments.map((file) => ({
        emailID: savedEmail.emailID,
        filename: file.filename,
        filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
          file.filename
        )}`, // Save public URL for user uploads
        size: file.size,
        contentType: file.contentType,
      }));
      await Attachment.bulkCreate(savedAttachments);
      console.log(
        `Saved ${savedAttachments.length} user-uploaded attachment files for email: ${savedEmail.emailID}`
      );
    }
    console.log(`Email sent and saved: ${info.messageId}`);
  }
}

//.....................change

// async function sendEmailJob(emailID) {
//   // Fetch email and attachments
//   const email = await Email.findByPk(emailID, {
//     include: [{ model: Attachment, as: "attachments" }],
//   });
//   if (!email) return;

//   // Fetch sender credentials (prefer DefaultEmail)
//   let SENDER_EMAIL, SENDER_PASSWORD, SENDER_NAME;
//   let signatureBlock = "";
//   let userCredential;
//   const defaultEmail = await DefaultEmail.findOne({
//     where: { masterUserID: email.masterUserID, isDefault: true },
//   });

//   if (defaultEmail) {
//     SENDER_EMAIL = defaultEmail.email;
//     SENDER_PASSWORD = defaultEmail.appPassword;
//     SENDER_NAME = defaultEmail.senderName;
//     if (!SENDER_NAME) {
//       const masterUser = await MasterUser.findOne({
//         where: { masterUserID: email.masterUserID },
//       });
//       SENDER_NAME = masterUser ? masterUser.name : "";
//     }
//         // Fetch userCredential for signature if needed
//     userCredential = await UserCredential.findOne({
//       where: { masterUserID: email.masterUserID },
//     });
//   } else {
//     const userCredential = await UserCredential.findOne({
//       where: { masterUserID: email.masterUserID },
//     });
//     SENDER_EMAIL = userCredential.email;
//     SENDER_PASSWORD = userCredential.appPassword;
//     const masterUser = await MasterUser.findOne({
//       where: { masterUserID: email.masterUserID },
//     });
//     SENDER_NAME = masterUser ? masterUser.name : "";

//   }
//     // Build signature block if not already present in email.body
//   if (userCredential) {
//     if (userCredential.signatureName) {
//       signatureBlock += `<strong>${userCredential.signatureName}</strong><br>`;
//     }
//     if (userCredential.signature) {
//       signatureBlock += `${userCredential.signature}<br>`;
//     }
//     if (userCredential.signatureImage) {
//       signatureBlock += `<img src="${userCredential.signatureImage}" alt="Signature Image" style="max-width:200px;"/><br>`;
//     }
//   }

//   // Only add signature if not already present in body
//   let emailBody = email.body || "";
//   if (signatureBlock && !emailBody.includes(signatureBlock)) {
//     emailBody += `<br><br>${signatureBlock}`;
//   }
// const inReplyToHeader = email.inReplyTo || undefined;
// const referencesHeader = email.references || undefined;
//   // Prepare mail options
//   const mailOptions = {
//     from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
//     to: email.recipient,
//     cc: email.cc,
//     bcc: email.bcc,
//     subject: email.subject,
//     // html: email.body,
//     // text: email.body, // fallback
//     html: emailBody,
//     text: emailBody,
//     attachments: email.attachments.map(att => ({
//       filename: att.filename,
//       path: att.filePath || att.path,
//     })),
//      inReplyTo: inReplyToHeader,
//   references: referencesHeader,
//   };

//   // Send email
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: SENDER_EMAIL,
//       pass: SENDER_PASSWORD,
//     },
//   });

//   const info = await transporter.sendMail(mailOptions);

//   // Update email as sent
//   await email.update({
//     folder: "sent",
//     messageId: info.messageId,
//     // createdAt: new Date(),
//     isDraft: false,
//   });

//   console.log(`Email sent and updated: ${info.messageId}`);
// }

// OLD SYNC WORKER - DISABLED (replaced by user-specific sync workers)
// async function startSyncEmailWorker() {
//   console.log("⚠️  OLD SYNC WORKER DISABLED - Use user-specific sync workers instead");
// }

// Add user-specific sync workers for parallel processing
async function startUserSpecificSyncWorkers() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";

  // Get all users with credentials to create user-specific sync queues
  let userCredentials = [];
  try {
    userCredentials = await UserCredential.findAll({
      attributes: ["masterUserID"],
      group: ["masterUserID"], // Ensure unique users
    });
    console.log(
      `[SyncWorker] Found ${userCredentials.length} users for sync email queues`
    );
  } catch (error) {
    console.error("[SyncWorker] Error fetching user credentials:", error);
    return;
  }

  // Create a single connection that will handle all user queues for this worker instance
  try {
    const connection = await amqp.connect(amqpUrl);

    // Create multiple channels for parallel processing
    const channels = [];
    const channelCount = Math.min(userCredentials.length, 5); // Max 5 channels per worker

    for (let i = 0; i < channelCount; i++) {
      const channel = await connection.createChannel();
      channel.prefetch(1); // Only process one message at a time per channel
      channels.push(channel);
    }

    console.log(
      `[SyncWorker] Created ${channels.length} channels for parallel processing`
    );

    // Distribute user queues across channels
    for (let i = 0; i < userCredentials.length; i++) {
      const credential = userCredentials[i];
      const userSyncQueueName = `SYNC_EMAIL_QUEUE_${credential.masterUserID}`;
      const channel = channels[i % channels.length]; // Round-robin distribution

      await channel.assertQueue(userSyncQueueName, { durable: true });
      console.log(`[SyncWorker] Listening to queue: ${userSyncQueueName}`);

      channel.consume(
        userSyncQueueName,
        async (msg) => {
          if (msg !== null) {
            const { masterUserID, syncStartDate, startUID, endUID } =
              JSON.parse(msg.content.toString());

            console.log(
              `[SyncWorker] Processing sync batch for user ${masterUserID}, startUID: ${startUID}, endUID: ${endUID}`
            );

            try {
              // Add timeout to prevent hanging sync workers
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Sync worker timeout after 5 minutes for user ${masterUserID}`
                      )
                    ),
                  300000
                ); // 5 minute timeout
              });

              const syncPromise = (async () => {
                logMemoryUsage(
                  `Before fetchSyncEmails for user ${masterUserID}`
                );

                // Pass startUID and endUID to fetchSyncEmails for batch processing
                await fetchSyncEmails(
                  {
                    adminId: masterUserID,
                    body: { syncStartDate }, // syncStartDate goes in body
                    query: { batchSize: 10, startUID, endUID }, // startUID and endUID go in query
                  },
                  { status: () => ({ json: () => {} }) }
                );

                logMemoryUsage(
                  `After fetchSyncEmails for user ${masterUserID}`
                );
                console.log(
                  `[SyncWorker] Successfully processed sync batch for user ${masterUserID}`
                );
              })();

              // Race between sync and timeout
              await Promise.race([syncPromise, timeoutPromise]);

              channel.ack(msg);
            } catch (error) {
              console.error(
                `[SyncWorker] Error processing sync batch for user ${masterUserID}:`,
                error
              );

              // For timeout errors, add specific handling
              if (error.message.includes("timeout")) {
                console.warn(
                  `[SyncWorker] Timeout detected for user ${masterUserID}, this user may have IMAP connection issues`
                );
              }

              channel.nack(msg, false, false); // Discard the message on error
            } finally {
              // Force garbage collection
              if (global.gc) {
                global.gc();
              }
            }
          }
        },
        { noAck: false }
      );
    }

    // Add connection error handling
    connection.on("error", (err) => {
      console.error(`AMQP connection error in sync workers:`, err);
    });

    connection.on("close", () => {
      console.log(
        `AMQP connection closed in sync workers. Attempting to reconnect...`
      );
      setTimeout(() => startUserSpecificSyncWorkers(), 5000);
    });
  } catch (error) {
    console.error(`[SyncWorker] Error setting up sync workers:`, error);
  }

  console.log("User-specific sync workers started and waiting for jobs...");
}

async function startFetchInboxWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue("FETCH_INBOX_QUEUE", { durable: true });

  // Set prefetch to 1 to ensure only one message is processed at a time
  channel.prefetch(1);

  channel.consume(
    "FETCH_INBOX_QUEUE",
    async (msg) => {
      if (msg !== null) {
        // Force a small batch size for memory safety
        let {
          masterUserID,
          email,
          appPassword,
          batchSize,
          page,
          days,
          provider,
          imapHost,
          imapPort,
          imapTLS,
          smtpHost,
          smtpPort,
          smtpSecure,
          startUID,
          endUID,
        } = JSON.parse(msg.content.toString());

        // Enforce maximum batch size to prevent memory issues
        batchSize = Math.min(parseInt(batchSize) || 5, 5);

        await limit(async () => {
          try {
            // Log memory usage before fetch
            logMemoryUsage(
              `Before fetchInboxEmails batch for masterUserID ${masterUserID}, page ${page}, UIDs ${startUID}-${endUID}`
            );

            // Add delay between batches to prevent overwhelming the system
            if (page > 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
            }

            // Call fetchInboxEmails logic directly, but mock req/res
            await fetchInboxEmails(
              {
                adminId: masterUserID,
                email,
                appPassword,
                body: {
                  email,
                  appPassword,
                  provider,
                  imapHost,
                  imapPort,
                  imapTLS,
                  smtpHost,
                  smtpPort,
                  smtpSecure,
                },
                query: {
                  batchSize,
                  page,
                  days,
                  startUID,
                  endUID,
                },
              },
              {
                status: (code) => ({
                  json: (data) => {
                    // Extract email count from response
                    const emailCount = data.processedEmails || 0;

                    // Update global statistics
                    emailStats.totalFetched += emailCount;
                    if (!emailStats.userStats[masterUserID]) {
                      emailStats.userStats[masterUserID] = {
                        fetched: 0,
                        batches: 0,
                      };
                    }
                    emailStats.userStats[masterUserID].fetched += emailCount;
                    emailStats.userStats[masterUserID].batches += 1;

                    // Calculate session duration
                    const sessionDuration = Math.floor(
                      (new Date() - emailStats.sessionStartTime) / 1000 / 60
                    ); // minutes

                    console.log(`
🚀 FETCH INBOX QUEUE WORKER COMPLETED BATCH!
📧 This batch: ${emailCount} NEW emails saved to database
👤 User ${masterUserID} TOTAL SAVED: ${
                      emailStats.userStats[masterUserID].fetched
                    } emails (across ${
                      emailStats.userStats[masterUserID].batches
                    } batches)
🌍 SESSION TOTAL SAVED: ${emailStats.totalFetched} emails across all users
⏱️  Session duration: ${sessionDuration} minutes
📋 Batch ${page} completed: ${data.message || "Success"}

💡 IMPORTANT: These counts show NEWLY SAVED emails only
   - Skips duplicates already in database
   - Total inbox emails may be higher than saved count
   - This is normal behavior for incremental processing
`);
                  },
                }),
              }
            );

            // Log memory usage after fetch
            logMemoryUsage(
              `After fetchInboxEmails batch for masterUserID ${masterUserID}, page ${page}`
            );

            // Force garbage collection after processing
            if (global.gc) {
              global.gc();
              logMemoryUsage(
                `After garbage collection for masterUserID ${masterUserID}, page ${page}`
              );
            }

            // Additional memory cleanup
            if (page % 5 === 0) {
              // Every 5 batches instead of 10
              console.log(
                `Completed ${page} batches, forcing additional cleanup...`
              );
              if (global.gc) {
                global.gc();
                global.gc(); // Double GC for thorough cleanup
              }
              // Longer delay to let system recover
              await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds
            }
            channel.ack(msg);
          } catch (err) {
            console.error(
              `Failed to fetch inbox emails for masterUserID ${masterUserID}, page ${page}:`,
              err
            );
            channel.nack(msg, false, false);
          }
        });
      }
    },
    { noAck: false }
  );

  // Add connection error handling
  connection.on("error", (err) => {
    console.error("AMQP connection error in fetchInboxWorker:", err);
  });

  connection.on("close", () => {
    console.log(
      "AMQP connection closed in fetchInboxWorker. Attempting to reconnect..."
    );
    setTimeout(() => startFetchInboxWorker(), 5000);
  });

  console.log("Inbox fetch worker started and waiting for jobs...");
}

// New function to handle user-specific queues for parallel processing
async function startUserSpecificInboxWorkers() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";

  // Get all users with credentials to create user-specific queues
  let userCredentials = [];
  try {
    userCredentials = await UserCredential.findAll({
      attributes: ["masterUserID"],
      group: ["masterUserID"], // Ensure unique users
    });
    console.log(
      `[UserWorker] Found ${userCredentials.length} users with email credentials`
    );
  } catch (error) {
    console.error("[UserWorker] Error fetching user credentials:", error);
    return;
  }

  // Create a worker for each user
  for (const credential of userCredentials) {
    const userQueueName = `FETCH_INBOX_QUEUE_${credential.masterUserID}`;

    try {
      const connection = await amqp.connect(amqpUrl);
      const channel = await connection.createChannel();
      await channel.assertQueue(userQueueName, { durable: true });

      console.log(`[UserWorker] Listening to queue: ${userQueueName}`);

      // Set prefetch to 1 to ensure only one message is processed at a time per user
      channel.prefetch(1);

      channel.consume(
        userQueueName,
        async (msg) => {
          if (msg !== null) {
            // Process message with same logic as original worker
            let {
              masterUserID,
              email,
              appPassword,
              batchSize,
              page,
              days,
              provider,
              imapHost,
              imapPort,
              imapTLS,
              smtpHost,
              smtpPort,
              smtpSecure,
              startUID,
              endUID,
              allUIDsInBatch, // Add missing field
              expectedCount, // Add missing field
              originalUIDCount, // Track original UID count for debugging
              // Add dynamic fetch parameters
              dynamicFetch,
              skipCount,
              debugMode,
            } = JSON.parse(msg.content.toString());

            // Enforce maximum batch size to prevent memory issues but allow faster processing
            // Dynamically adjust batch size based on actual email count to prevent warnings
            batchSize = Math.min(parseInt(batchSize) || 10, 10); // Reduced from 25 to 10 for better memory management

            await limit(async () => {
              try {
                // Log memory usage before fetch
                logMemoryUsage(
                  `Before fetchInboxEmails batch for user ${masterUserID}, page ${page}, UIDs ${startUID}-${endUID} (${
                    originalUIDCount || "unknown"
                  } original UIDs)`
                );

                // Add delay between batches to prevent overwhelming the system
                if (page > 1) {
                  await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased delay for memory recovery
                }

                // Force memory cleanup every 5 batches
                if (page % 5 === 0 && global.gc) {
                  console.log(
                    `[Memory] Batch ${page}: Forcing garbage collection...`
                  );
                  global.gc();
                  logMemoryUsage(`After GC - Batch ${page}`);
                }

                // Add timeout to prevent hanging workers
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(
                    () => reject(new Error("Worker timeout after 5 minutes")),
                    300000
                  ); // 5 minute timeout
                });

                const fetchPromise = fetchInboxEmails(
                  {
                    adminId: masterUserID, // This is what fetchInboxEmails reads as req.adminId
                    email,
                    appPassword,
                    body: {
                      email,
                      appPassword,
                      provider,
                      imapHost,
                      imapPort,
                      imapTLS,
                      smtpHost,
                      smtpPort,
                      smtpSecure,
                      // Add dynamic fetch parameters to body (since we check body in fetchInboxEmails)
                      dynamicFetch,
                      skipCount,
                      debugMode,
                    },
                    query: {
                      batchSize,
                      page,
                      days,
                      startUID,
                      endUID,
                      allUIDsInBatch, // Add missing field
                      expectedCount, // Add missing field
                      originalUIDCount, // Add missing field for debugging
                      // Also add dynamic fetch parameters to query for compatibility
                      dynamicFetch,
                      skipCount,
                      debugMode,
                    },
                  },
                  {
                    status: (code) => ({
                      json: (data) => {
                        console.log(
                          `User ${masterUserID} inbox fetch completed, page ${page}: ${data.message}`
                        );
                      },
                    }),
                  }
                );

                // Race between fetch and timeout
                await Promise.race([fetchPromise, timeoutPromise]);

                // Check if we need to queue more batches (only for first batch with dynamic fetch)
                if (page === 1 && dynamicFetch) {
                  try {
                    // Get total email count dynamically by connecting to IMAP
                    console.log(
                      `[AutoPagination] Connecting to IMAP to get actual email count for user ${masterUserID}...`
                    );

                    // Set up IMAP configuration - use already imported UserCredential
                    const userCredential = await UserCredential.findOne({
                      where: { masterUserID },
                    });

                    if (!userCredential) {
                      console.log(
                        `[AutoPagination] No credentials found for user ${masterUserID}, skipping auto-pagination`
                      );
                      return;
                    }

                    const providerConfig = {
                      gmail: { host: "imap.gmail.com", port: 993, tls: true },
                      yandex: { host: "imap.yandex.com", port: 993, tls: true },
                    };

                    let imapConfig;
                    if (provider === "custom") {
                      imapConfig = {
                        imap: {
                          user: email,
                          password: appPassword,
                          host: imapHost,
                          port: imapPort,
                          tls: imapTLS,
                          authTimeout: 30000,
                          tlsOptions: { rejectUnauthorized: false },
                        },
                      };
                    } else {
                      const config =
                        providerConfig[provider] || providerConfig.gmail;
                      imapConfig = {
                        imap: {
                          user: email,
                          password: appPassword,
                          host: config.host,
                          port: config.port,
                          tls: config.tls,
                          authTimeout: 30000,
                          tlsOptions: { rejectUnauthorized: false },
                        },
                      };
                    }

                    const Imap = require("imap-simple");
                    const connection = await Imap.connect(imapConfig);
                    await connection.openBox("INBOX");

                    // Get actual total email count
                    let totalEmails;
                    if (!days || days === 0 || days === "all") {
                      const allMessages = await connection.search(["ALL"]);
                      totalEmails = allMessages.length;
                    } else {
                      const formatDateForIMAP = (date) => {
                        const months = [
                          "Jan",
                          "Feb",
                          "Mar",
                          "Apr",
                          "May",
                          "Jun",
                          "Jul",
                          "Aug",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dec",
                        ];
                        const day = date.getDate();
                        const month = months[date.getMonth()];
                        const year = date.getFullYear();
                        return `${day}-${month}-${year}`;
                      };

                      const sinceDate = formatDateForIMAP(
                        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                      );
                      const recentMessages = await connection.search([
                        ["SINCE", sinceDate],
                      ]);
                      totalEmails = recentMessages.length;
                    }

                    await connection.end();
                    console.log(
                      `[AutoPagination] User ${masterUserID}: Found ${totalEmails} total emails in inbox`
                    );

                    // Calculate how many batches we need
                    const totalBatches = Math.ceil(totalEmails / batchSize);
                    console.log(
                      `[AutoPagination] User ${masterUserID}: Need ${totalBatches} total batches (${batchSize} emails per batch)`
                    );

                    // Only queue additional batches if we need more than 1 batch
                    if (totalBatches > 1) {
                      const amqpUrl =
                        process.env.RABBITMQ_URL || "amqp://localhost";
                      const tempConnection = await amqp.connect(amqpUrl);
                      const tempChannel = await tempConnection.createChannel();

                      // Queue remaining batches (pages 2, 3, 4, etc.)
                      for (
                        let nextPage = 2;
                        nextPage <= totalBatches;
                        nextPage++
                      ) {
                        const nextSkipCount = (nextPage - 1) * batchSize;

                        if (nextSkipCount < totalEmails) {
                          const nextJobData = {
                            masterUserID,
                            email,
                            appPassword,
                            batchSize,
                            page: nextPage,
                            days,
                            provider,
                            imapHost,
                            imapPort,
                            imapTLS,
                            smtpHost,
                            smtpPort,
                            smtpSecure,
                            dynamicFetch: true,
                            skipCount: nextSkipCount,
                            debugMode,
                          };

                          await tempChannel.assertQueue(userQueueName, {
                            durable: true,
                          });
                          tempChannel.sendToQueue(
                            userQueueName,
                            Buffer.from(JSON.stringify(nextJobData)),
                            { persistent: true }
                          );

                          console.log(
                            `[AutoPagination] Queued batch ${nextPage} for user ${masterUserID} (skip: ${nextSkipCount})`
                          );
                        }
                      }

                      await tempChannel.close();
                      await tempConnection.close();

                      console.log(
                        `[AutoPagination] Successfully queued ${
                          totalBatches - 1
                        } additional batches for user ${masterUserID}`
                      );
                    } else {
                      console.log(
                        `[AutoPagination] User ${masterUserID}: Only 1 batch needed, no additional batches to queue`
                      );
                    }
                  } catch (paginationError) {
                    console.error(
                      `[AutoPagination] Error queuing additional batches for user ${masterUserID}:`,
                      paginationError
                    );
                    console.log(
                      `[AutoPagination] Continuing with single batch processing for user ${masterUserID}`
                    );
                  }
                }

                // Log memory usage after fetch
                logMemoryUsage(
                  `After fetchInboxEmails batch for user ${masterUserID}, page ${page}`
                );

                // Force garbage collection after processing
                if (global.gc) {
                  global.gc();
                  logMemoryUsage(
                    `After garbage collection for user ${masterUserID}, page ${page}`
                  );
                }

                // Additional memory cleanup
                if (page % 10 === 0) {
                  // Every 10 batches
                  console.log(
                    `User ${masterUserID} completed ${page} batches, forcing additional cleanup...`
                  );
                  if (global.gc) {
                    global.gc();
                    global.gc(); // Double GC for thorough cleanup
                  }
                  // Small delay to let system recover
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                }

                channel.ack(msg);
              } catch (err) {
                console.error(
                  `Failed to fetch inbox emails for user ${masterUserID}, page ${page}:`,
                  err
                );
                channel.nack(msg, false, false);
              }
            });
          }
        },
        { noAck: false }
      );

      // Add connection error handling
      connection.on("error", (err) => {
        console.error(`AMQP connection error in ${userQueueName}:`, err);
      });

      connection.on("close", () => {
        console.log(
          `AMQP connection closed in ${userQueueName}. Attempting to reconnect...`
        );
        setTimeout(() => startUserSpecificInboxWorkers(), 5000);
      });
    } catch (error) {
      console.error(
        `[UserWorker] Error setting up queue ${userQueueName}:`,
        error
      );
    }
  }

  console.log("User-specific inbox workers started and waiting for jobs...");
  console.log(`
📊 EMAIL STATISTICS TRACKING ENABLED
🕐 Session started: ${emailStats.sessionStartTime.toISOString()}
📧 Total emails fetched: ${emailStats.totalFetched}
👥 Active users: ${Object.keys(emailStats.userStats).length}
`);
}

// Add user-specific workers for cron job queues (email-fetch-queue-{userID})
async function startUserSpecificCronWorkers() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";

  // Get all users with credentials to create user-specific cron queues
  let userCredentials = [];
  try {
    userCredentials = await UserCredential.findAll({
      attributes: ["masterUserID"],
      group: ["masterUserID"], // Ensure unique users
    });
    console.log(
      `[CronWorker] Found ${userCredentials.length} users for cron email queues`
    );
  } catch (error) {
    console.error("[CronWorker] Error fetching user credentials:", error);
    return;
  }

  // Use SINGLE connection with ONE channel for true sequential processing across ALL users
  try {
    const connection = await amqp.connect(amqpUrl);
    const channel = await connection.createChannel();
    channel.prefetch(1); // Only process one message at a time globally

    console.log(
      `[CronWorker] Created single connection with one channel for sequential IMAP processing across all ${userCredentials.length} users`
    );

    // Create queues for all users but process through single channel for true sequencing
    for (const credential of userCredentials) {
      const userCronQueueName = `email-fetch-queue-${credential.masterUserID}`;
      await channel.assertQueue(userCronQueueName, { durable: true });
      console.log(`[CronWorker] Queue ${userCronQueueName} created`);

      channel.consume(
        userCronQueueName,
        async (msg) => {
          if (msg !== null) {
            const { adminId } = JSON.parse(msg.content.toString());

            // Check circuit breaker - skip problematic users temporarily
            if (shouldSkipUser(adminId)) {
              console.warn(
                `[CronWorker] Skipping adminId ${adminId} - temporarily blocked due to repeated failures`
              );
              channel.ack(msg);
              return;
            }

            await logMemoryUsage(
              `Before fetchRecentEmail for adminId ${adminId}`
            );

            try {
              // Enhanced IMAP connection with global lock, timeout and retry
              const fetchPromise = imapConnectionLimit(async () => {
                console.log(
                  `[CronWorker] Processing adminId ${adminId} - Sequential IMAP (${
                    imapConnectionLimit.pendingCount +
                    imapConnectionLimit.activeCount
                  }/1)`
                );

                // Acquire global IMAP lock to prevent any concurrent operations
                await acquireGlobalImapLock(adminId, "CRON-FETCH");

                try {
                  let retryCount = 0;
                  const maxRetries = 2;

                  while (retryCount <= maxRetries) {
                    try {
                      await fetchRecentEmail(adminId);
                      recordUserSuccess(adminId);
                      return true;
                    } catch (error) {
                      retryCount++;
                      console.error(
                        `[CronWorker] Attempt ${retryCount}/${
                          maxRetries + 1
                        } failed for adminId ${adminId}:`,
                        error.message
                      );

                      if (retryCount > maxRetries) {
                        recordUserFailure(adminId);
                        throw error;
                      }

                      await new Promise((resolve) =>
                        setTimeout(resolve, 2000 * retryCount)
                      );
                    }
                  }
                } finally {
                  // Always release the global lock
                  releaseGlobalImapLock(adminId, "CRON-FETCH");
                }
              });

              // 5 minute timeout
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Cron worker timeout after 5 minutes for adminId ${adminId}`
                      )
                    ),
                  300000
                );
              });

              await Promise.race([fetchPromise, timeoutPromise]);
              console.log(
                `[CronWorker] Successfully processed adminId ${adminId}`
              );
            } catch (error) {
              console.error(
                `[CronWorker] Error processing adminId ${adminId}:`,
                error.message
              );
              recordUserFailure(adminId);
            } finally {
              channel.ack(msg);
              await logMemoryUsage(
                `After fetchRecentEmail for adminId ${adminId}`
              );

              if (global.gc) {
                global.gc();
                console.log(`[GC] Triggered for adminId ${adminId}`);
              }
            }
          }
        },
        { noAck: false }
      );
    }

    // Connection error handling
    connection.on("error", (err) => {
      console.error(`[CronWorker] AMQP connection error:`, err);
    });

    connection.on("close", () => {
      console.log(`[CronWorker] AMQP connection closed. Reconnecting...`);
      setTimeout(() => startUserSpecificCronWorkers(), 5000);
    });
  } catch (error) {
    console.error(`[CronWorker] Error setting up cron workers:`, error);
  }

  console.log(
    "✅ User-specific cron workers started with TRUE SEQUENTIAL IMAP processing"
  );
}

// In fetchInboxEmails/fetchSyncEmails/fetchRecentEmail, ensure IMAP connections are closed in finally blocks (edit those files if needed)
// ...existing code...

// Parse command line arguments to determine which workers to start
const args = process.argv.slice(2);
const workerType =
  args.find((arg) => arg.startsWith("--"))?.substring(2) || "all";

console.log(`🚀 EMAIL QUEUE WORKER STARTING...`);
console.log(`📋 Worker Type: ${workerType.toUpperCase()}`);
console.log(`🕐 Started at: ${new Date().toISOString()}`);

// Start workers based on command line arguments
async function startWorkers() {
  try {
    switch (workerType) {
      case "inbox":
        console.log("🔄 Starting INBOX workers only...");
        await startUserSpecificInboxWorkers();
        console.log("✅ Inbox workers started successfully");
        break;

      case "cron":
        console.log("⏰ Starting CRON workers only...");
        await startUserSpecificCronWorkers();
        console.log("✅ Cron workers started successfully");
        break;

      case "sync":
        console.log("🔄 Starting USER-SPECIFIC SYNC workers only...");
        await startUserSpecificSyncWorkers();
        console.log("✅ User-specific sync workers started successfully");
        break;

      case "scheduled":
        console.log("📅 Starting USER-SPECIFIC SCHEDULED workers only...");
        await startUserSpecificScheduledWorkers();
        console.log("✅ User-specific scheduled workers started successfully");
        break;

      case "legacy-sync":
        console.log("🔄 Starting LEGACY SYNC and EMAIL workers only...");
        await Promise.all([
          // startSyncEmailWorker(), // DISABLED: Now using user-specific sync workers
          startEmailWorker(),
          startScheduledEmailWorker(),
        ]);
        console.log("✅ Legacy sync and email workers started successfully");
        break;

      case "all":
      default:
        console.log("🔄 Starting ALL workers...");
        await Promise.all([
          startUserSpecificInboxWorkers(),
          startUserSpecificCronWorkers(),
          startUserSpecificSyncWorkers(),
          startUserSpecificScheduledWorkers(),
          startEmailWorker(),
        ]);
        console.log("✅ All workers started successfully");
        break;
    }

    // Display statistics every 10 minutes (only for inbox and all modes)
    if (workerType === "inbox" || workerType === "all") {
      setInterval(() => {
        displayEmailStatistics();
      }, 10 * 60 * 1000); // 10 minutes
    }

    console.log(`🎯 Worker process ready and listening for jobs...`);
  } catch (error) {
    console.error("❌ Failed to start workers:", error);
    process.exit(1);
  }
}

// Start the workers
startWorkers();

// Export statistics functions for external use
module.exports = {
  getEmailStatistics,
  displayEmailStatistics,
};
