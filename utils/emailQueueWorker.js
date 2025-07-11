const amqp = require("amqplib");
const pLimit = require("p-limit");
// Reduce concurrency to 1 for all workers to minimize memory/connection usage
const limit = pLimit(1);
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
function logMemoryUsage(context = "") {
  const mem = process.memoryUsage();
  const rss = (mem.rss / 1024 / 1024).toFixed(1);
  const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
  const external = (mem.external / 1024 / 1024).toFixed(1);

  console.log(
    `[Memory] ${context} RSS: ${rss}MB, Heap: ${heapUsed}MB / ${heapTotal}MB, External: ${external}MB`
  );

  // Warning if memory usage is high
  if (mem.heapUsed > 500 * 1024 * 1024) {
    // 500MB
    console.warn(`[Memory Warning] High heap usage: ${heapUsed}MB`);
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

async function startSyncEmailWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue("SYNC_EMAIL_QUEUE", { durable: true });

  // Set prefetch to 1 to ensure only one message is processed at a time
  channel.prefetch(1);

  channel.consume(
    "SYNC_EMAIL_QUEUE",
    async (msg) => {
      if (msg !== null) {
        // Expect startUID and endUID in the message for batching
        const { masterUserID, syncStartDate, startUID, endUID } = JSON.parse(
          msg.content.toString()
        );
        await limit(async () => {
          try {
            logMemoryUsage(
              `Before syncEmails for masterUserID ${masterUserID}`
            );

            // Pass startUID and endUID to fetchSyncEmails for batch processing
            await fetchSyncEmails(
              {
                adminId: masterUserID,
                body: { syncStartDate, startUID, endUID },
                query: { batchSize: 10 }, // Enforce small batch size
              },
              { status: () => ({ json: () => {} }) }
            );

            logMemoryUsage(`After syncEmails for masterUserID ${masterUserID}`);

            // Force garbage collection
            if (global.gc) {
              global.gc();
            }

            channel.ack(msg);
          } catch (err) {
            console.error("Failed to sync emails:", err);
            channel.nack(msg, false, false);
          }
        });
      }
    },
    { noAck: false }
  );

  console.log("Sync email worker started and waiting for jobs...");
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
                    console.log(
                      `Inbox fetch completed for masterUserID ${masterUserID}, page ${page}: ${data.message}`
                    );
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
            if (page % 10 === 0) {
              // Every 10 batches
              console.log(
                `Completed ${page} batches, forcing additional cleanup...`
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

// In fetchInboxEmails/fetchSyncEmails/fetchRecentEmail, ensure IMAP connections are closed in finally blocks (edit those files if needed)
// ...existing code...

startFetchInboxWorker().catch(console.error);
startSyncEmailWorker().catch(console.error);
startEmailWorker().catch(console.error);
startWorker().catch(console.error);
startScheduledEmailWorker().catch(console.error);