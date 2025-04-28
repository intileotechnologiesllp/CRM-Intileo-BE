// const cron = require("node-cron");
// const { fetchRecentEmail } = require("../controllers/email/emailController");

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

// console.log(
//   "Cron job scheduled to fetch the most recent email every 5 minutes."
// );
