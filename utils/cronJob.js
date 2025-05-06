const cron = require("node-cron");
 const { fetchRecentEmail } = require("../controllers/email/emailController");
// const { fetchInboxEmails } = require("../controllers/email/"); // Adjust the path to your controller
const UserCredential = require("../models/email/userCredentialModel"); // Adjust the path to your model

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
//   console.log("Running cron job to fetch recent emails for all users...");

//   try {
//     // Fetch all user credentials
//     const userCredentials = await UserCredential.findAll();

//     // Iterate over each user credential
//     for (const credential of userCredentials) {
//       const adminId = credential.masterUserID;

//       try {
//         console.log(`Fetching emails for adminId: ${adminId}`);
//         const result = await fetchRecentEmail(adminId); // Pass adminId to fetchRecentEmail
//         console.log(`Result for adminId ${adminId}:`, result);
//       } catch (error) {
//         console.error(`Error fetching emails for adminId ${adminId}:`, error);
//       }
//     }
//   } catch (error) {
//     console.error("Error running cron job:", error);
//   }
// });

// console.log(
//   "Cron job scheduled to fetch the most recent email every 2 minutes."
// );


// cron.schedule("*/5 * * * *", async () => {
//     console.log("Running scheduled task to fetch the most recent email...");
//     try {
//       await fetchSentEmails(
//         { query: {} },
//         { status: () => ({ json: () => {} }) }
//       ); // Mock req and res
//     } catch (error) {
//       console.error("Error running scheduled task:", error);
//     }
//   });
  
//   console.log(
//     "Cron job scheduled to fetch the most recent email every 5 minutes."
//   );
//   cron.schedule("*/8 * * * *", async () => {
//     console.log("Running scheduled task to fetch the most recent email...");
//     try {
//       await fetchArchiveEmails(
//         { query: {} },
//         { status: () => ({ json: () => {} }) }
//       ); // Mock req and res
//     } catch (error) {
//       console.error("Error running scheduled task:", error);
//     }
//   });
  
//   console.log(
//     "Cron job scheduled to fetch the most recent email every 5 minutes."
//   );
//   cron.schedule("*/7 * * * *", async () => {
//     console.log("Running scheduled task to fetch the most recent email...");
//     try {
//       await fetchDraftEmails(
//         { query: {} },
//         { status: () => ({ json: () => {} }) }
//       ); // Mock req and res
//     } catch (error) {
//       console.error("Error running scheduled task:", error);
//     }
//   });
  
//   console.log(
//     "Cron job scheduled to fetch the most recent email every 5 minutes."
//   );
