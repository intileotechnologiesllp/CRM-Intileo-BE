const cron = require("node-cron");
 const { fetchRecentEmail } = require("../controllers/email/emailController");
const { fetchSentEmails } = require("../controllers/email/emailController"); // Adjust the path to your controller
const UserCredential = require("../models/email/userCredentialModel"); // Adjust the path to your model
const Email = require("../models/email/emailModel");
const Attachment = require("../models/email/attachmentModel");
const nodemailer = require("nodemailer");
const { Sequelize } = require("sequelize");

//
// Combined cron job to fetch recent and sent emails for all users


// const amqp = require("amqplib");



// const QUEUE_NAME = "email-fetch-queue";

// async function pushJobsToQueue() {
//   const connection = await amqp.connect("amqp://localhost");
//   const channel = await connection.createChannel();
//   await channel.assertQueue(QUEUE_NAME, { durable: true });

//   const userCredentials = await UserCredential.findAll();
//   if (!userCredentials || userCredentials.length === 0) {
//     console.log("No user credentials found.");
//     await channel.close();
//     await connection.close();
//     return;
//   }

//   for (const credential of userCredentials) {
//     const adminId = credential.masterUserID;
//     channel.sendToQueue(
//       QUEUE_NAME,
//       Buffer.from(JSON.stringify({ adminId })),
//       { persistent: true }
//     );
//   }
//   console.log(`Queued ${userCredentials.length} email fetch jobs.`);

//   await channel.close();
//   await connection.close();
// }

// cron.schedule("*/2 * * * *", async () => {
//   console.log("Running cron job to queue email fetch jobs...");
//   try {
//     await pushJobsToQueue();
//   } catch (error) {
//     console.error("Error queueing email fetch jobs:", error);
//   }
// });





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
