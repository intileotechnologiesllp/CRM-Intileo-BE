const cron = require("node-cron");
const { fetchRecentEmail } = require("../controllers/email/emailController");
const { fetchSentEmails } = require("../controllers/email/emailController"); // Adjust the path to your controller
const UserCredential = require("../models/email/userCredentialModel"); // Adjust the path to your model
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const nodemailer = require("nodemailer");
const { Sequelize } = require("sequelize");
const { cleanupRecentSearches } = require("./recentSearchCleanup");

//
// Combined cron job to fetch recent and sent emails for all users

const amqp = require("amqplib");

const QUEUE_NAME = "email-fetch-queue";
const SCHEDULED_QUEUE = "scheduled-email-queue";

async function pushJobsToQueue() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
  const connection = await amqp.connect(amqpUrl);
  const channel = await connection.createChannel();

  const userCredentials = await UserCredential.findAll();
  if (!userCredentials || userCredentials.length === 0) {
    console.log("No user credentials found.");
    await channel.close();
    await connection.close();
    return;
  }

  for (const credential of userCredentials) {
    const adminId = credential.masterUserID;
    // Use user-specific queue name for cron jobs too
    const userQueueName = `email-fetch-queue-${adminId}`;

    await channel.assertQueue(userQueueName, { durable: true });
    channel.sendToQueue(
      userQueueName,
      Buffer.from(JSON.stringify({ adminId })),
      {
        persistent: true,
      }
    );
  }
  console.log(
    `Queued ${userCredentials.length} email fetch jobs to user-specific queues.`
  );

  await channel.close();
  await connection.close();
}

cron.schedule("*/2 * * * *", async () => {
  console.log("Running cron job to queue email fetch jobs...");
  try {
    await pushJobsToQueue();
  } catch (error) {
    console.error("Error queueing email fetch jobs:", error);
  }
});

cron.schedule("* * * * *", async () => {
  // Every minute
  console.log("Running cron job to queue scheduled outbox emails...");
  const now = new Date();
  console.log("Current server time:", now.toISOString());

  try {
    // Find all outbox emails that should be sent now or earlier
    const emails = await Email.findAll({
      where: {
        folder: "outbox",
        scheduledAt: { [Sequelize.Op.lte]: now },
      },
      attributes: ["emailID", "scheduledAt", "folder"],
    });

    console.log(
      "Found scheduled outbox emails:",
      emails.map((e) => ({
        emailID: e.emailID,
        scheduledAt: e.scheduledAt,
        folder: e.folder,
      }))
    );

    if (!emails.length) {
      console.log("No scheduled outbox emails to queue at this time.");
      return;
    }

    // Connect to RabbitMQ and queue each email for sending
    const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
    const connection = await amqp.connect(amqpUrl);
    const channel = await connection.createChannel();
    await channel.assertQueue(SCHEDULED_QUEUE, { durable: true });

    for (const email of emails) {
      console.log(
        `Queueing emailID ${email.emailID} (scheduledAt: ${email.scheduledAt}) to RabbitMQ...`
      );
      channel.sendToQueue(
        SCHEDULED_QUEUE,
        Buffer.from(JSON.stringify({ emailID: email.emailID })),
        { persistent: true }
      );
    }
    console.log(`Queued ${emails.length} scheduled outbox emails for sending.`);

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error("Error queueing scheduled outbox emails:", error);
  }
});

// cron.schedule("*/2 * * * *", async () => {
//   console.log("Running combined cron job to fetch recent and sent emails for all users...");

//   try {
//     // Fetch all user credentials
//     const userCredentials = await UserCredential.findAll();

//     if (!userCredentials || userCredentials.length === 0) {
//       console.log("No user credentials found.");
//       return;
//     }

//     // Iterate over each user credential
//     for (const credential of userCredentials) {
//       const adminId = credential.masterUserID;

//       try {
//         // Fetch recent emails
//         console.log(`Fetching recent emails for adminId: ${adminId}`);
//         const recentEmailsResult = await fetchRecentEmail(adminId); // Pass adminId to fetchRecentEmail
//         console.log(`Result for recent emails (adminId ${adminId}):`, recentEmailsResult);

//         // Fetch sent emails
//         console.log(`Fetching sent emails for adminId: ${adminId}`);
//         // const sentEmailsResult = await fetchSentEmails(adminId); // Pass adminId to fetchSentEmails
//         // console.log(`Result for sent emails (adminId ${adminId}):`, sentEmailsResult);
//       } catch (error) {
//         console.error(`Error processing emails for adminId ${adminId}:`, error);
//       }
//     }
//   } catch (error) {
//     console.error("Error running combined cron job:", error);
//   }
// });

// Uncomment the following code to enable the cron job for sending scheduled emails

// cron.schedule("* * * * *", async () => { // Runs every minute
//   console.log("Running cron job to send scheduled emails...");

//   const now = new Date();
//   console.log("Current time:", now);
//   const emails = await Email.findAll({
//     where: {
//       folder: "outbox",
//       scheduledAt: { [Sequelize.Op.lte]: now },
//     },
//     include: [{ model: Attachment, as: "attachments" }],
//   });
//   console.log(emails);
//   console.log("Fetched emails:", emails.length);
// if (emails.length > 0) {
//   emails.forEach(e => console.log(e.emailID, e.folder, e.scheduledAt));
// }

//   for (const email of emails) {
//     try {
//       // Fetch sender credentials
//       const userCredential = await UserCredential.findOne({
//         where: { masterUserID: email.masterUserID },
//       });
//       if (!userCredential) continue;

//       // Send email
//       const transporter = nodemailer.createTransport({
//         service: "gmail",
//         auth: {
//           user: userCredential.email,
//           pass: userCredential.appPassword,
//         },
//       });

//       const info = await transporter.sendMail({
//         from: userCredential.email,
//         to: email.recipient,
//         cc: email.cc,
//         bcc: email.bcc,
//         subject: email.subject,
//         text: email.body,
//         html: email.body,
//         attachments: email.attachments.map(att => ({
//           filename: att.filename,
//           path: att.path,
//         })),
//       });

//       // Move email to sent
//       await email.update({ folder: "sent", createdAt: new Date(), messageId: info.messageId });
//       console.log(`Scheduled email sent: ${email.subject}`);
//     } catch (err) {
//       console.error("Failed to send scheduled email:", err);
//     }
//   }
// });

cron.schedule("0 2 * * *", async () => {
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const BATCH_SIZE = 500;
  let totalDeleted = 0;
  let deletedCount;

  try {
    do {
      const emailsToDelete = await Email.findAll({
        where: {
          folder: "trash",
          createdAt: { [Sequelize.Op.lt]: THIRTY_DAYS_AGO },
        },
        attributes: ["emailID"],
        limit: BATCH_SIZE,
      });

      if (emailsToDelete.length === 0) break;

      const ids = emailsToDelete.map((e) => e.emailID);

      deletedCount = await Email.destroy({
        where: { emailID: ids },
      });

      totalDeleted += deletedCount;

      if (deletedCount > 0) {
        console.log(
          `Batch deleted ${deletedCount} emails from trash (older than 30 days).`
        );
      }
    } while (deletedCount === BATCH_SIZE);

    if (totalDeleted > 0) {
      console.log(
        `Auto-deleted total ${totalDeleted} emails from trash (older than 30 days).`
      );
    }
  } catch (error) {
    console.error("Error auto-deleting old trash emails:", error);
  }
});

// Daily cleanup of recent search history (runs at 2:00 AM)
cron.schedule("0 2 * * *", async () => {
  console.log("Running daily cleanup of recent search history...");

  try {
    const result = await cleanupRecentSearches({
      daysToKeep: 30, // Keep searches for 30 days
      maxPerUser: 50, // Keep maximum 50 searches per user
    });

    if (result.success) {
      console.log(
        `Recent search cleanup completed: ${result.deletedCount} searches deleted`
      );
    } else {
      console.error("Recent search cleanup failed:", result.error);
    }
  } catch (error) {
    console.error("Error running recent search cleanup:", error);
  }
});
