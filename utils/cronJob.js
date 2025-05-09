const cron = require("node-cron");
 const { fetchRecentEmail } = require("../controllers/email/emailController");
const { fetchSentEmails } = require("../controllers/email/emailController"); // Adjust the path to your controller
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
        console.log(`Result for sent emails (adminId ${adminId}):`, sentEmailsResult);
      } catch (error) {
        console.error(`Error processing emails for adminId ${adminId}:`, error);
      }
    }
  } catch (error) {
    console.error("Error running combined cron job:", error);
  }
});
