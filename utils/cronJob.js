const cron = require("node-cron");
 const { fetchRecentEmail } = require("../controllers/email/emailController");
const { fetchSentEmails } = require("../controllers/email/emailController"); // Adjust the path to your controller
const UserCredential = require("../models/email/userCredentialModel"); // Adjust the path to your model
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const nodemailer = require("nodemailer");
const { Sequelize } = require("sequelize");
// // Schedule the cron job to run every 5 minutes
// cron.schedule("*/2 * * * *", async () => {
//   console.log("Running scheduled task to fetch the most recent email...");
//   try {
//     await fetchRecentEmail(
//       { query: {} },
//       { status: () => ({ json: () => {} }) }
//     ); // Mock req and res
//   } catch (error) {
//     console.error("Error running scheduled task:", error);
//   }
// });
// cron.schedule("*/1 * * * *", async () => {
//     console.log("Running cron job to fetch recent emails for all users...");
  
//     try {
//       // Fetch all user credentials
//       const userCredentials = await UserCredential.findAll();
  
//       if (!userCredentials || userCredentials.length === 0) {
//         console.log("No user credentials found.");
//         return;
//       }
  
//       // Iterate over each user credential
//       for (const credential of userCredentials) {
//         const adminId = credential.masterUserID;
  
//         try {
//           console.log(`Fetching emails for adminId: ${adminId}`);
//           const result = await fetchRecentEmail(adminId); // Pass adminId to fetchRecentEmail
//           console.log(`Result for adminId ${adminId}:`, result);
//         } catch (error) {
//           console.error(`Error fetching emails for adminId ${adminId}:`, error);
//         }
//       }
//     } catch (error) {
//       console.error("Error running cron job:", error);
//     }
//   });

//   cron.schedule("*/1 * * * *", async () => {
//     console.log("Running cron job to fetch recent emails for all users...");
  
//     try {
//       // Fetch all user credentials
//       const userCredentials = await UserCredential.findAll();
  
//       if (!userCredentials || userCredentials.length === 0) {
//         console.log("No user credentials found.");
//         return;
//       }
  
//       // Iterate over each user credential
//       for (const credential of userCredentials) {
//         const adminId = credential.masterUserID;
  
//         try {
//           console.log(`Fetching recent emails for adminId: ${adminId}`);
//           const result = await fetchRecentEmail(adminId); // Pass adminId to fetchRecentEmail
//           console.log(`Result for adminId ${adminId}:`, result);
//         } catch (error) {
//           console.error(`Error fetching recent emails for adminId ${adminId}:`, error);
//         }
//       }
//     } catch (error) {
//       console.error("Error running cron job:", error);
//     }
//   });
  
//   // Cron job to fetch sent emails for all users
//   cron.schedule("*/3 * * * *", async () => {
//     console.log("Running cron job to fetch sent emails for all users...");
  
//     try {
//       // Fetch all user credentials
//       const userCredentials = await UserCredential.findAll();
  
//       if (!userCredentials || userCredentials.length === 0) {
//         console.log("No user credentials found.");
//         return;
//       }
  
//       // Iterate over each user credential
//       for (const credential of userCredentials) {
//         const adminId = credential.masterUserID;
  
//         try {
//           console.log(`Fetching sent emails for adminId: ${adminId}`);
//           const result = await fetchSentEmails(adminId); // Pass adminId to fetchSentEmails
//           console.log(`Result for adminId ${adminId}:`, result);
//         } catch (error) {
//           console.error(`Error fetching sent emails for adminId ${adminId}:`, error);
//         }
//       }
//     } catch (error) {
//       console.error("Error running cron job:", error);
//     }
//   });
// Adjust the path to your model

// Combined cron job to fetch recent and sent emails for all users
cron.schedule("*/2 * * * *", async () => {
  console.log("Running combined cron job to fetch recent and sent emails for all users...");

  try {
    // Fetch all user credentials
    const userCredentials = await UserCredential.findAll();

    if (!userCredentials || userCredentials.length === 0) {
      console.log("No user credentials found.");
      return;
    }

    // Iterate over each user credential
    for (const credential of userCredentials) {
      const adminId = credential.masterUserID;

      try {
        // Fetch recent emails
        console.log(`Fetching recent emails for adminId: ${adminId}`);
        const recentEmailsResult = await fetchRecentEmail(adminId); // Pass adminId to fetchRecentEmail
        console.log(`Result for recent emails (adminId ${adminId}):`, recentEmailsResult);

        // Fetch sent emails
        console.log(`Fetching sent emails for adminId: ${adminId}`);
        // const sentEmailsResult = await fetchSentEmails(adminId); // Pass adminId to fetchSentEmails
        // console.log(`Result for sent emails (adminId ${adminId}):`, sentEmailsResult);
      } catch (error) {
        console.error(`Error processing emails for adminId ${adminId}:`, error);
      }
    }
  } catch (error) {
    console.error("Error running combined cron job:", error);
  }
});

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
