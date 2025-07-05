const amqp = require("amqplib");
const pLimit = require("p-limit");
const limit = pLimit(1);
const { fetchRecentEmail } = require("../controllers/email/emailController");
const { fetchSyncEmails } = require("../controllers/email/emailSettingController");
const nodemailer = require("nodemailer");
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const UserCredential = require("../models/email/userCredentialModel");
const DefaultEmail = require("../models/email/defaultEmailModel");
const MasterUser = require("../models/master/masterUserModel");
const { fetchInboxEmails } = require("../controllers/email/emailController");
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

async function startWorker() {
    const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";

  const connection = await amqp.connect(amqpUrl);
  console.log("Connected to RabbitMQ");
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  channel.consume(
    QUEUE_NAME,
    async (msg) => {
      if (msg !== null) {
        const { adminId } = JSON.parse(msg.content.toString());
        try {
          await limit(async () => {
            console.log(`Fetching recent emails for adminId: ${adminId}`);
            await fetchRecentEmail(adminId);
          });
          channel.ack(msg);
        } catch (error) {
          console.error(
            `Error processing email fetch for adminId ${adminId}:`,
            error
          );
          channel.nack(msg, false, false); // Discard the message on error
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
          // const transporter = nodemailer.createTransport({
          //   service: "gmail",
          //   auth: {
          //     user: userCredential.email,
          //     pass: userCredential.appPassword,
          //   },
          // });

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
              sendQueuedEmail(emailData)
                .then(() => {
                  if (channel.connection.stream.writable) channel.ack(msg);
                })
                .catch((err) => {
                  console.error("Failed to send queued email:", err);
                  if (channel.connection.stream.writable) channel.nack(msg, false, false);
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
    attachments: (emailData.attachments || []).map(att => ({
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
  (userCredential?.provider)

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
      where: { draftId: emailData.draftId, masterUserID: emailData.masterUserID, folder: "drafts" },
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
      const savedAttachments = emailData.attachments.map(file => ({
        emailID:draftEmail.emailID,
        filename: file.filename,
        filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(file.filename)}`,
       // filePath: file.path,
        size: file.size,
        contentType: file.contentType,
      }));
      await Attachment.bulkCreate(savedAttachments);
    }
    console.log(`Draft email sent and updated: ${info.messageId}`);
  }
  } else {
    // Create a new sent email
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

    // Save attachments if any
    if (emailData.attachments && emailData.attachments.length > 0) {
      const savedAttachments = emailData.attachments.map(file => ({
        emailID: savedEmail.emailID,
         filename: file.filename,
          // filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
          //   file.filename
          // )}`,
          filePath: file.path,
         // filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(file.filename)}`,
        size: file.size,
        contentType: file.contentType,
      }));
      await Attachment.bulkCreate(savedAttachments);
    }
    console.log(`Queued email sent and saved: ${info.messageId}`);
  }
}

// --- Update EMAIL_QUEUE consumer ---
async function startEmailWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });

  channel.consume(
    QUEUE,
    async (msg) => {
      if (msg !== null) {
        const emailData = JSON.parse(msg.content.toString());
        limit(() =>
          sendQueuedEmail(emailData)
            .then(() => channel.ack(msg))
            .catch((err) => {
              console.error("Failed to send queued email:", err);
              channel.nack(msg, false, false); // Discard on error
            })
        );
      }
    },
    { noAck: false }
  );

  console.log("Email worker started and waiting for jobs...");
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

async function startEmailWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });

  channel.consume(
    QUEUE,
    async (msg) => {
      if (msg !== null) {
        const emailData = JSON.parse(msg.content.toString());
        limit(() =>
          sendEmailJob(emailData)
            .then(() => channel.ack(msg))
            .catch((err) => {
              console.error("Failed to send email:", err);
              channel.nack(msg, false, false); // Discard on error
            })
        );
      }
    },
    { noAck: false }
  );

  console.log("Email worker started and waiting for jobs...");
}

async function startSyncEmailWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue("SYNC_EMAIL_QUEUE", { durable: true });

  channel.consume(
    "SYNC_EMAIL_QUEUE",
    async (msg) => {
      if (msg !== null) {
        // Expect startUID and endUID in the message for batching
        const { masterUserID, syncStartDate, startUID, endUID } = JSON.parse(msg.content.toString());
        limit(async () => {
          try {
            // Pass startUID and endUID to fetchSyncEmails for batch processing
            await fetchSyncEmails(
              {
                adminId: masterUserID,
                body: { syncStartDate, startUID, endUID },
                query: {}
              },
              { status: () => ({ json: () => {} }) }
            );
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

  channel.consume(
    "FETCH_INBOX_QUEUE",
    async (msg) => {
      if (msg !== null) {
        const { masterUserID, email, appPassword, batchSize, page, days,provider,imapHost,imapPort,imapTLS,smtpHost,smtpPort,smtpSecure } = JSON.parse(msg.content.toString());
        limit(async () => {
          try {
            console.log("Starting fetchInboxEmails");
            // Call fetchInboxEmails logic directly, but mock req/res
            await fetchInboxEmails(
              {
                adminId: masterUserID,
                body: { email, appPassword,provider,imapHost,imapPort,imapTLS,smtpHost,smtpPort,smtpSecure },
                // body: { appPassword },
                query: { batchSize, page, days }
              },
              { status: () => ({ json: () => {} }) }
            );
            console.log("Finished fetchInboxEmails");
            channel.ack(msg);
          } catch (err) {
            console.error("Failed to fetch inbox emails:", err);
            channel.nack(msg, false, false);
          }
        });
      }
   },
    { noAck: false }
  );

    console.log("Inbox fetch worker started and waiting for jobs...");
}

startFetchInboxWorker().catch(console.error);
startSyncEmailWorker().catch(console.error);
startEmailWorker().catch(console.error);
startWorker().catch(console.error);
startScheduledEmailWorker().catch(console.error);



















// Fetch emails from the inbox in batches
exports.fetchInboxEmails = async (req, res) => {
// Enforce max batch size
let { batchSize = 50, page = 1, days = 7, startUID, endUID } = req.query;
// batchSize = Math.min(Number(batchSize) || 10, MAX_BATCH_SIZE);

const masterUserID = req.adminId;
const email = req.body?.email || req.email;
const appPassword = req.body?.appPassword || req.appPassword;
const provider = req.body?.provider;

let connection;
try {
if (!masterUserID || !email || !appPassword || !provider) {
return res.status(400).json({ message: "All fields are required." });
}

// Check if the user already has credentials saved
const existingCredential = await UserCredential.findOne({
where: { masterUserID },
});
const smtpConfigByProvider = {
gmail: { smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true },
yandex: { smtpHost: "smtp.yandex.com", smtpPort: 465, smtpSecure: true },
yahoo: {
smtpHost: "smtp.mail.yahoo.com",
smtpPort: 465,
smtpSecure: true,
},
outlook: {
smtpHost: "smtp.office365.com",
smtpPort: 587,
smtpSecure: false,
},
};

// Prepare SMTP config for saving
let smtpHost = null,
smtpPort = null,
smtpSecure = null;
if (["gmail", "yandex", "yahoo", "outlook"].includes(provider)) {
const smtpConfig = smtpConfigByProvider[provider];
smtpHost = smtpConfig.smtpHost;
smtpPort = smtpConfig.smtpPort;
smtpSecure = smtpConfig.smtpSecure;
} else if (provider === "custom") {
smtpHost = req.body.smtpHost;
smtpPort = req.body.smtpPort;
smtpSecure = req.body.smtpSecure;
}
if (existingCredential) {
await existingCredential.update({
email,
appPassword,
provider,
imapHost: provider === "custom" ? req.body.imapHost : null,
imapPort: provider === "custom" ? req.body.imapPort : null,
imapTLS: provider === "custom" ? req.body.imapTLS : null,
smtpHost,
smtpPort,
smtpSecure,
});
console.log(`User credentials updated for masterUserID: ${masterUserID}`);
} else {
// Use upsert to avoid duplicate entry errors
await UserCredential.create({
masterUserID,
email,
appPassword,
provider,
imapHost: provider === "custom" ? req.body.imapHost : null,
imapPort: provider === "custom" ? req.body.imapPort : null,
imapTLS: provider === "custom" ? req.body.imapTLS : null,
smtpHost,
smtpPort,
smtpSecure,
});
console.log(
`User credentials upserted for masterUserID: ${masterUserID}`
);
}

// Fetch emails after saving credentials
console.log("Fetching emails for masterUserID:", masterUserID);
// Fetch user credentials
const userCredential = await UserCredential.findOne({
where: { masterUserID },
});

if (!userCredential) {
console.error(
"User credentials not found for masterUserID:",
masterUserID
);
return res.status(404).json({ message: "User credentials not found." });
}
console.log(userCredential.email, "email");
console.log(userCredential.appPassword, "appPassword");

const userEmail = userCredential.email;
const userPassword = userCredential.appPassword;

console.log("Connecting to IMAP server...");
// const imapConfig = {
//   imap: {
//     user: userEmail,
//     password: userPassword,
//     host: "imap.gmail.com",
//     port: 993,
//     tls: true,
//     authTimeout: 30000,
//     tlsOptions: {
//       rejectUnauthorized: false,
//     },
//   },
// };
let imapConfig;
const providerd = userCredential.provider; // default to gmail

const providerConfig = PROVIDER_CONFIG[providerd];
const folderMap =
PROVIDER_FOLDER_MAP[providerd] || PROVIDER_FOLDER_MAP["gmail"];
if (providerd === "custom") {
if (!userCredential.imapHost || !userCredential.imapPort) {
return res.status(400).json({
message: "Custom IMAP settings are missing in user credentials.",
});
}
imapConfig = {
imap: {
user: userCredential.email,
password: userCredential.appPassword,
host: userCredential.imapHost,
port: userCredential.imapPort,
tls: userCredential.imapTLS,
authTimeout: 30000,
tlsOptions: { rejectUnauthorized: false },
},
};
} else {
imapConfig = {
imap: {
user: userCredential.email,
password: userCredential.appPassword,
host: providerConfig.host,
port: providerConfig.port,
tls: providerConfig.tls,
authTimeout: 30000,
tlsOptions: { rejectUnauthorized: false },
},
};
}

connection = await Imap.connect(imapConfig);

// Add robust error handler
connection.on("error", (err) => {
console.error("IMAP connection error:", err);
});

// Helper function to fetch emails from a specific folder using UID range
const fetchEmailsFromFolder = async (folderName, folderType) => {
try {
await connection.openBox(folderName);
let searchCriteria;
if (startUID && endUID) {
// Use UID range for this batch
searchCriteria = [["UID", `${startUID}:${endUID}`]];
} else if (!days || days === 0 || days === "all") {
searchCriteria = ["ALL"];
} else {
const sinceDate = formatDateForIMAP(
new Date(Date.now() - days * 24 * 60 * 60 * 1000)
);
searchCriteria = [["SINCE", sinceDate]];
}
const fetchOptions = { bodies: "", struct: true };
const messages = await connection.search(searchCriteria, fetchOptions);

console.log(`Total emails found in ${folderType}: ${messages.length}`);

// Pagination logic
const startIndex = (page - 1) * batchSize;
const endIndex = startIndex + parseInt(batchSize);
const batchMessages = messages.slice(startIndex, endIndex);

for (const message of batchMessages) {
const rawBodyPart = message.parts.find((part) => part.which === "");
const rawBody = rawBodyPart ? rawBodyPart.body : null;

if (!rawBody) {
console.log(`No body found for email in ${folderType}.`);
continue;
}

const parsedEmail = await simpleParser(rawBody);

//..............changes for inReplyTo and references fields................
const referencesHeader = parsedEmail.headers.get("references");
const references = Array.isArray(referencesHeader)
? referencesHeader.join(" ") // Convert array to string
: referencesHeader || null;

const emailData = {
messageId: parsedEmail.messageId || null,
inReplyTo: parsedEmail.headers.get("in-reply-to") || null,
references,
sender: parsedEmail.from ? parsedEmail.from.value[0].address : null,
senderName: parsedEmail.from
? parsedEmail.from.value[0].name
: null,
recipient: parsedEmail.to
? parsedEmail.to.value.map((to) => to.address).join(", ")
: null,
cc: parsedEmail.cc
? parsedEmail.cc.value.map((cc) => cc.address).join(", ")
: null,
bcc: parsedEmail.bcc
? parsedEmail.bcc.value.map((bcc) => bcc.address).join(", ")
: null,
masterUserID: masterUserID,
subject: parsedEmail.subject || null,
body: cleanEmailBody(parsedEmail.html || parsedEmail.text || ""),
folder: folderType, // Dynamically set the folder type
createdAt: parsedEmail.date || new Date(),
};

// Save email to the database
const existingEmail = await Email.findOne({
where: { messageId: emailData.messageId },
});

let savedEmail;
if (!existingEmail) {
savedEmail = await Email.create(emailData);
console.log(`Recent email saved: ${emailData.messageId}`);
} else {
console.log(`Recent email already exists: ${emailData.messageId}`);
savedEmail = existingEmail;
}

// Save attachments
const attachments = [];
if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
// Filter out icon/image attachments
const filteredAttachments = parsedEmail.attachments.filter(
(att) => !isIconAttachment(att)
);
if (filteredAttachments.length > 0) {
const savedAttachments = await saveAttachments(
filteredAttachments,
savedEmail.emailID
);
attachments.push(...savedAttachments);
console.log(
`Saved ${attachments.length} attachments for email: ${emailData.messageId}`
);
} else {
console.log(
`No non-icon/image attachments to save for email: ${emailData.messageId}`
);
}
}

// Fetch the full thread recursively
if (emailData.messageId) {
const fullThread = await getFullThread(emailData.messageId, Email);
// Remove duplicates by messageId
const uniqueThread = [];
const seen = new Set();
for (const em of fullThread) {
if (!seen.has(em.messageId)) {
uniqueThread.push(em);
seen.add(em.messageId);
}
}
// Sort by createdAt (oldest first)
uniqueThread.sort(
(a, b) => new Date(a.createdAt) - new Date(b.createdAt)
);
// Optionally, you can log the thread for debugging
console.log(
`Full thread for messageId ${emailData.messageId}:`,
uniqueThread.map((e) => e.messageId)
);
// Only save thread emails if not already present (no attachment logic)
for (const threadEmail of uniqueThread) {
if (threadEmail.messageId === emailData.messageId) continue;
const existingThreadEmail = await Email.findOne({
where: { messageId: threadEmail.messageId },
});
if (!existingThreadEmail) {
await Email.create(
threadEmail.toJSON ? threadEmail.toJSON() : threadEmail
);
console.log(`Thread email saved: ${threadEmail.messageId}`);
}
}
// You can now use uniqueThread as the full conversation
}
}
} catch (folderError) {
console.error(
`Error fetching emails from folder ${folderType}:`,
folderError
);
}
};
const boxes = await connection.getBoxes();
const allFoldersArr = flattenFolders(boxes).map((f) => f.toLowerCase());
const folderTypes = ["inbox", "drafts", "archive", "sent"];
for (const type of folderTypes) {
const folderName = folderMap[type];
if (allFoldersArr.includes(folderName.toLowerCase())) {
console.log(`Fetching emails from ${type}...`);
await fetchEmailsFromFolder(folderName, type);
} else {
console.log(
`Folder "${folderName}" not found for provider ${provider}. Skipping.`
);
}
}

console.log("Fetching emails from Inbox...");
await fetchEmailsFromFolder(folderMap.inbox, "inbox");

console.log("Fetching emails from Drafts...");
await fetchEmailsFromFolder(folderMap.drafts, "drafts");

console.log("Fetching emails from Archive...");
// await fetchEmailsFromFolder(folderMap.archive, "archive");
if (allFoldersArr.includes(folderMap.archive.toLowerCase())) {
console.log("Fetching emails from Archive...");
await fetchEmailsFromFolder(folderMap.archive, "archive");
} else {
console.log(
`Archive folder "${folderMap.archive}" not found for provider ${provider}. Skipping.`
);
}

console.log("Fetching emails from Sent...");
await fetchEmailsFromFolder(folderMap.sent, "sent");

connection.end();
console.log("IMAP connection closed.");

res.status(200).json({
message:
"Fetched and saved emails from Inbox, Drafts, Archive, and Sent folders.",
});
} catch (error) {
console.error("Error fetching emails:", error);
res.status(500).json({ message: "Internal server error." });
} finally {
// Safe connection close
if (
connection &&
connection.imap &&
connection.imap.state !== "disconnected"
) {
try {
connection.end();
} catch (closeErr) {
console.error("Error closing IMAP connection:", closeErr);
}
}
}
};