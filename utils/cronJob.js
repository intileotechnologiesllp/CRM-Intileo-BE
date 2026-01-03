const cron = require("node-cron");
const { fetchRecentEmail } = require("../controllers/email/emailController");
const { fetchSentEmails } = require("../controllers/email/emailController"); // Adjust the path to your controller
const UserCredential = require("../models/email/userCredentialModel"); // Adjust the path to your model
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const nodemailer = require("nodemailer");
const { Sequelize, Op } = require("sequelize");
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

// Re-enabled: Email fetch cron jobs queue jobs for dedicated PM2 cron workers to process
// This runs only in the main app process and queues jobs for the cron workers
cron.schedule("*/2 * * * *", async () => {
  console.log("Running cron job to queue email fetch jobs...");
  try {
    await pushJobsToQueue();
  } catch (error) {
    console.error("Error queueing email fetch jobs:", error);
  }
});

// Enhanced scheduled email cron job with user-specific queues
cron.schedule("* * * * *", async () => {
  // Every minute
  console.log("🕐 Running scheduled email cron job...");
  const now = new Date();
  console.log("📅 Current server time:", now.toISOString());

  try {
    // Find all outbox emails that should be sent now or earlier
    const emails = await Email.findAll({
      where: {
        folder: "outbox",
        scheduledAt: { [Sequelize.Op.lte]: now },
      },
      attributes: ["emailID", "scheduledAt", "folder", "masterUserID", "subject"],
    });

    console.log(
      "📧 Found scheduled outbox emails:",
      emails.map((e) => ({
        emailID: e.emailID,
        scheduledAt: e.scheduledAt,
        folder: e.folder,
        masterUserID: e.masterUserID,
        subject: e.subject
      }))
    );

    if (!emails.length) {
      console.log("📭 No scheduled outbox emails to queue at this time.");
      return;
    }

    // Connect to RabbitMQ and queue each email to user-specific queues
    const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
    const connection = await amqp.connect(amqpUrl);
    const channel = await connection.createChannel();

    for (const email of emails) {
      // Use user-specific queue for scheduled emails
      const userScheduledQueueName = `SCHEDULED_EMAIL_QUEUE_${email.masterUserID}`;
      
      await channel.assertQueue(userScheduledQueueName, { durable: true });
      
      console.log(
        `🚀 Queueing scheduled email: ID ${email.emailID}, Subject: "${email.subject}", User: ${email.masterUserID}, Queue: ${userScheduledQueueName}, Due: ${email.scheduledAt}`
      );
      
      channel.sendToQueue(
        userScheduledQueueName,
        Buffer.from(JSON.stringify({ emailID: email.emailID })),
        { persistent: true }
      );
    }
    
    console.log(`✅ Queued ${emails.length} scheduled emails for sending to user-specific queues.`);

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error("❌ Error queueing scheduled outbox emails:", error);
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

// Campaign processing cron job - queues campaign jobs to RabbitMQ
// Runs every minute to check for campaigns that need to be processed
const Campaigns = require("../models/email/campaignsModel");

async function queueCampaignJobs() {
  const amqpUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
  let connection;
  let channel;

  try {
    console.log("🕐 Running campaign cron job to queue campaign jobs...");
    
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();

    // Get all active campaigns
    const campaigns = await Campaigns.findAll({
      attributes: ['campaignId', 'campaignName', 'sendingTime', 'createdBy', 'subject', 'emailContent', 'receivers', 'sender'],
      raw: true
    });

    if (!campaigns || campaigns.length === 0) {
      console.log("📭 No campaigns found to process.");
      return;
    }

    const now = new Date();
    let totalQueued = 0;

    for (const campaign of campaigns) {
      try {
        // Parse sendingTime JSON
        let sendingTime;
        try {
          sendingTime = typeof campaign.sendingTime === 'string' 
            ? JSON.parse(campaign.sendingTime) 
            : campaign.sendingTime;
        } catch (parseError) {
          console.error(`❌ Error parsing sendingTime for campaign ${campaign.campaignId}:`, parseError);
          continue;
        }

        // Check if campaign should be processed now
        const shouldProcess = checkIfCampaignShouldProcess(sendingTime, now);
        
        if (!shouldProcess) {
          continue;
        }

        // Get recipients from campaign.receivers field (comma-separated emails)
        const recipients = parseReceivers(campaign.receivers);

        if (!recipients || recipients.length === 0) {
          console.log(`⚠️ No recipients found for campaign ${campaign.campaignId}`);
          continue;
        }

        // Create campaign-specific queue
        const queueName = `CAMPAIGN_QUEUE_${campaign.campaignId}`;
        await channel.assertQueue(queueName, { durable: true });

        // Queue job with recipients (batch recipients in chunks if needed)
        const BATCH_SIZE = 50; // Process 50 recipients per job
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const batch = recipients.slice(i, i + BATCH_SIZE);
          
          const job = {
            campaignId: campaign.campaignId,
            jobId: `${campaign.campaignId}-${Date.now()}-${i}`,
            recipients: batch,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 3,
            priority: 5
          };

          channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(job)),
            { persistent: true }
          );

          totalQueued++;
        }

        console.log(`✅ Queued ${Math.ceil(recipients.length / BATCH_SIZE)} jobs for campaign ${campaign.campaignId} (${recipients.length} recipients)`);

      } catch (campaignError) {
        console.error(`❌ Error processing campaign ${campaign.campaignId}:`, campaignError.message);
      }
    }

    console.log(`📊 Campaign cron job completed: ${totalQueued} jobs queued across ${campaigns.length} campaigns`);

  } catch (error) {
    console.error("❌ Error in campaign cron job:", error);
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
}

// Check if campaign should be processed based on sendingTime
function checkIfCampaignShouldProcess(sendingTime, now) {
  if (!sendingTime) return false;

  // If sendingTime has a specific date/time
  if (sendingTime.dateTime) {
    const scheduledTime = new Date(sendingTime.dateTime);
    // Process if scheduled time has passed (within last 5 minutes to avoid duplicates)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    return scheduledTime <= now && scheduledTime >= fiveMinutesAgo;
  }

  // If sendingTime has a schedule (e.g., daily at specific time)
  if (sendingTime.schedule) {
    const schedule = sendingTime.schedule;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Check if current time matches schedule
    if (schedule.hour !== undefined && schedule.hour !== currentHour) {
      return false;
    }
    if (schedule.minute !== undefined && schedule.minute !== currentMinute) {
      return false;
    }
    
    // Check day of week if specified
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
      if (!schedule.daysOfWeek.includes(currentDay)) {
        return false;
      }
    }
    
    return true;
  }

  // If sendingTime is "immediate" or similar
  if (sendingTime.type === 'immediate') {
    return true;
  }

  return false;
}

// Parse comma-separated receivers string into recipient objects
function parseReceivers(receiversString) {
  if (!receiversString || typeof receiversString !== 'string') {
    return [];
  }

  // Split by comma and clean up each email
  const emails = receiversString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0 && email.includes('@')); // Basic email validation

  // Return array of recipient objects (email only, name can be added later if needed)
  return emails.map(email => ({
    email: email,
    name: null // Name not available from comma-separated string
  }));
}

// Schedule campaign cron job to run every minute
// cron.schedule("* * * * *", async () => {
//   try {
//     await queueCampaignJobs();
//   } catch (error) {
//     console.error("Error running campaign cron job:", error);
//   }
// });