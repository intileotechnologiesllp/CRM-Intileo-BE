const amqp = require("amqplib");
const pLimit = require("p-limit");
const limit = pLimit(5);
const { fetchRecentEmail } = require("../controllers/email/emailController");
const nodemailer = require("nodemailer");
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const UserCredential = require("../models/email/userCredentialModel");
const DefaultEmail = require("../models/email/defaultEmailModel");
const MasterUser = require("../models/master/masterUserModel");
const QUEUE_NAME = "email-fetch-queue";
const SCHEDULED_QUEUE = "scheduled-email-queue";
const QUEUE = "EMAIL_QUEUE";

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

          // Send email
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: userCredential.email,
              pass: userCredential.appPassword,
            },
          });

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


async function sendEmailJob(emailID) {
  // Fetch email and attachments
  const email = await Email.findByPk(emailID, {
    include: [{ model: Attachment, as: "attachments" }],
  });
  if (!email) return;

  // Fetch sender credentials (prefer DefaultEmail)
  let SENDER_EMAIL, SENDER_PASSWORD, SENDER_NAME;
  let signatureBlock = "";
  const defaultEmail = await DefaultEmail.findOne({
    where: { masterUserID: email.masterUserID, isDefault: true },
  });

  if (defaultEmail) {
    SENDER_EMAIL = defaultEmail.email;
    SENDER_PASSWORD = defaultEmail.appPassword;
    SENDER_NAME = defaultEmail.senderName;
    if (!SENDER_NAME) {
      const masterUser = await MasterUser.findOne({
        where: { masterUserID: email.masterUserID },
      });
      SENDER_NAME = masterUser ? masterUser.name : "";
    }
        // Fetch userCredential for signature if needed
    userCredential = await UserCredential.findOne({
      where: { masterUserID: email.masterUserID },
    });
  } else {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: email.masterUserID },
    });
    SENDER_EMAIL = userCredential.email;
    SENDER_PASSWORD = userCredential.appPassword;
    const masterUser = await MasterUser.findOne({
      where: { masterUserID: email.masterUserID },
    });
    SENDER_NAME = masterUser ? masterUser.name : "";
    
  }
    // Build signature block if not already present in email.body
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

  // Only add signature if not already present in body
  let emailBody = email.body || "";
  if (signatureBlock && !emailBody.includes(signatureBlock)) {
    emailBody += `<br><br>${signatureBlock}`;
  }

  // Prepare mail options
  const mailOptions = {
    from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
    to: email.recipient,
    cc: email.cc,
    bcc: email.bcc,
    subject: email.subject,
    html: email.body,
    text: email.body, // fallback
    attachments: email.attachments.map(att => ({
      filename: att.filename,
      path: att.filePath || att.path,
    })),
  };

  // Send email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SENDER_EMAIL,
      pass: SENDER_PASSWORD,
    },
  });

  const info = await transporter.sendMail(mailOptions);

  // Update email as sent
  await email.update({
    folder: "sent",
    messageId: info.messageId,
    createdAt: new Date(),
    isDraft: false,
  });

  console.log(`Email sent and updated: ${info.messageId}`);
}

async function startEmailWorker() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost";
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });

  channel.consume(
    QUEUE,
    async (msg) => {
      if (msg !== null) {
        const { emailID } = JSON.parse(msg.content.toString());
        limit(() =>
          sendEmailJob(emailID)
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




startEmailWorker().catch(console.error);
startWorker().catch(console.error);
startScheduledEmailWorker().catch(console.error);



