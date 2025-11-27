const cron = require("node-cron");
const { fetchRecentEmail } = require("../controllers/email/emailController");
const { fetchSentEmails } = require("../controllers/email/emailController"); // Adjust the path to your controller
const UserCredential = require("../models/email/userCredentialModel"); // Adjust the path to your model
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const nodemailer = require("nodemailer");
const { Sequelize } = require("sequelize");
const { cleanupRecentSearches } = require("./recentSearchCleanup");
const Imap = require("imap-simple");

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

// ==========================================
// EMAIL FLAGS SYNC FUNCTION
// ==========================================

/**
 * Background function to sync email flags from IMAP servers
 * Compares IMAP flags with database isRead status and updates mismatches
 */
async function syncFlags() {
  console.log("🔄 Starting email flags sync...");
  
  try {
    // Get all user credentials
    const userCredentials = await UserCredential.findAll({
      where: {
        email: { [Sequelize.Op.ne]: null },
        appPassword: { [Sequelize.Op.ne]: null }
      }
    });

    if (!userCredentials || userCredentials.length === 0) {
      console.log("⚠️ No user credentials found for flag sync");
      return;
    }

    console.log(`📧 Processing flag sync for ${userCredentials.length} users`);

    // Process each user's emails
    for (const credential of userCredentials) {
      try {
        await syncUserFlags(credential);
      } catch (userError) {
        console.error(`❌ Flag sync failed for user ${credential.masterUserID}:`, userError.message);
        // Continue with other users even if one fails
        continue;
      }
    }

    console.log("✅ Email flags sync completed");
  } catch (error) {
    console.error("❌ Error in email flags sync:", error);
  }
}

/**
 * Sync flags for a specific user
 */
async function syncUserFlags(userCredential) {
  const userId = userCredential.masterUserID;
  console.log(`🔄 Syncing flags for user ${userId}`);

  // Build IMAP configuration
  const imapConfig = buildImapConfig(userCredential);
  
  let connection = null;
  
  try {
    // Connect to IMAP server
    connection = await Imap.connect(imapConfig);
    console.log(`📡 Connected to IMAP for user ${userId}`);

    // Get folders to sync
    const foldersToSync = getFoldersToSync(userCredential);
    
    let totalUpdated = 0;

    // Sync each folder
    for (const folderName of foldersToSync) {
      try {
        const updatedCount = await syncFolderFlags(connection, userId, folderName);
        totalUpdated += updatedCount;
      } catch (folderError) {
        console.error(`❌ Error syncing folder ${folderName} for user ${userId}:`, folderError.message);
        // Continue with other folders
        continue;
      }
    }

    console.log(`✅ Updated ${totalUpdated} email flags for user ${userId}`);
    
  } catch (error) {
    console.error(`❌ IMAP connection failed for user ${userId}:`, error.message);
    throw error;
  } finally {
    // Always close the connection
    if (connection && connection.imap && connection.imap.state !== "disconnected") {
      try {
        connection.end();
        console.log(`🔌 IMAP connection closed for user ${userId}`);
      } catch (closeError) {
        console.error(`❌ Error closing IMAP connection for user ${userId}:`, closeError.message);
      }
    }
  }
}

/**
 * Sync flags for a specific folder
 */
async function syncFolderFlags(connection, userId, folderName) {
  console.log(`📁 Syncing flags for folder: ${folderName} (user ${userId})`);

  try {
    // Open the folder
    await connection.openBox(folderName);
    
    // Get emails from database for this user and folder
    const dbEmails = await Email.findAll({
      where: {
        masterUserID: userId,
        folder: mapFolderName(folderName)
      },
      attributes: ['emailID', 'messageId', 'uid', 'isRead'],
      limit: 1000 // Process in batches to avoid memory issues
    });

    if (dbEmails.length === 0) {
      console.log(`📭 No emails found in database for folder ${folderName} (user ${userId})`);
      return 0;
    }

    console.log(`📧 Found ${dbEmails.length} emails in database for folder ${folderName}`);

    // Get IMAP UIDs and flags for emails in this folder
    const searchCriteria = ['ALL']; // Get all emails in folder
    const fetchOptions = {
      bodies: '', // Don't fetch body, only metadata
      struct: false,
      envelope: true
    };

    const imapEmails = await connection.search(searchCriteria, fetchOptions);
    
    if (!imapEmails || imapEmails.length === 0) {
      console.log(`📭 No emails found in IMAP folder ${folderName} (user ${userId})`);
      return 0;
    }

    console.log(`📧 Found ${imapEmails.length} emails in IMAP folder ${folderName}`);

    // Create a map of IMAP emails by messageId and UID
    const imapEmailMap = new Map();
    imapEmails.forEach(email => {
      const messageId = email.attributes?.envelope?.['message-id'];
      const uid = email.attributes?.uid;
      const flags = email.attributes?.flags || [];
      const isReadInImap = flags.includes('\\Seen');

      if (messageId) {
        imapEmailMap.set(messageId, { uid, isRead: isReadInImap, flags });
      }
      if (uid) {
        imapEmailMap.set(`uid:${uid}`, { messageId, isRead: isReadInImap, flags });
      }
    });

    // Compare and update flags
    let updatedCount = 0;
    const emailsToUpdate = [];

    for (const dbEmail of dbEmails) {
      let imapEmail = null;
      
      // Try to find by messageId first
      if (dbEmail.messageId) {
        imapEmail = imapEmailMap.get(dbEmail.messageId);
      }
      
      // If not found by messageId, try by UID
      if (!imapEmail && dbEmail.uid) {
        imapEmail = imapEmailMap.get(`uid:${dbEmail.uid}`);
      }

      if (imapEmail && imapEmail.isRead !== dbEmail.isRead) {
        emailsToUpdate.push({
          emailID: dbEmail.emailID,
          newIsRead: imapEmail.isRead,
          oldIsRead: dbEmail.isRead
        });
      }
    }

    // Batch update emails that need flag changes
    if (emailsToUpdate.length > 0) {
      console.log(`🔄 Updating ${emailsToUpdate.length} emails with changed flags in folder ${folderName}`);
      
      for (const emailUpdate of emailsToUpdate) {
        try {
          await Email.update(
            { isRead: emailUpdate.newIsRead },
            { where: { emailID: emailUpdate.emailID } }
          );
          updatedCount++;
        } catch (updateError) {
          console.error(`❌ Failed to update email ${emailUpdate.emailID}:`, updateError.message);
        }
      }

      console.log(`✅ Successfully updated ${updatedCount} emails in folder ${folderName}`);
    } else {
      console.log(`✅ No flag updates needed for folder ${folderName}`);
    }

    return updatedCount;

  } catch (error) {
    console.error(`❌ Error syncing folder ${folderName}:`, error.message);
    throw error;
  }
}

/**
 * Build IMAP configuration for a user
 */
function buildImapConfig(userCredential) {
  const config = {
    imap: {
      user: userCredential.email,
      password: userCredential.appPassword,
      authTimeout: 30000,
      connTimeout: 30000,
      keepalive: false,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false // Handle self-signed certificates
      }
    }
  };

  // Set provider-specific settings
  switch (userCredential.provider.toLowerCase()) {
    case 'gmail':
      config.imap.host = 'imap.gmail.com';
      config.imap.port = 993;
      break;
    case 'outlook':
      config.imap.host = 'outlook.office365.com';
      config.imap.port = 993;
      break;
    case 'yahoo':
      config.imap.host = 'imap.mail.yahoo.com';
      config.imap.port = 993;
      break;
    case 'yandex':
      config.imap.host = 'imap.yandex.com';
      config.imap.port = 993;
      break;
    case 'custom':
      config.imap.host = userCredential.imapHost;
      config.imap.port = userCredential.imapPort || 993;
      config.imap.tls = userCredential.imapTLS !== false;
      break;
    default:
      throw new Error(`Unsupported email provider: ${userCredential.provider}`);
  }

  return config;
}

/**
 * Get folders to sync for a user
 */
function getFoldersToSync(userCredential) {
  const defaultFolders = ['INBOX'];
  
  if (userCredential.syncAllFolders) {
    // For now, just sync common folders to avoid performance issues
    // Can be enhanced later to discover all folders
    return ['INBOX', '[Gmail]/Sent Mail', 'Sent', 'INBOX.Sent', '[Gmail]/Drafts', 'Drafts', 'INBOX.Drafts'];
  }
  
  if (userCredential.syncFolders && Array.isArray(userCredential.syncFolders)) {
    return userCredential.syncFolders;
  }
  
  return defaultFolders;
}

/**
 * Map IMAP folder name to database folder name
 */
function mapFolderName(imapFolderName) {
  const folderMap = {
    'INBOX': 'inbox',
    '[Gmail]/Sent Mail': 'sent',
    'Sent': 'sent',
    'INBOX.Sent': 'sent',
    '[Gmail]/Drafts': 'drafts',
    'Drafts': 'drafts',
    'INBOX.Drafts': 'drafts',
    '[Gmail]/Trash': 'trash',
    'Trash': 'trash',
    'INBOX.Trash': 'trash'
  };
  
  return folderMap[imapFolderName] || 'inbox';
}

// Schedule the flag sync to run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("🔄 Running email flags sync cron job...");
  try {
    await syncFlags();
  } catch (error) {
    console.error("❌ Error in flag sync cron job:", error);
  }
});
