#!/usr/bin/env node
/**
 * Simple Email Cron Job (No RabbitMQ)
 *
 * This script provides a direct alternative to RabbitMQ-based email fetching.
 * It runs email fetch jobs directly without queuing, making it more reliable
 * for environments where RabbitMQ is not available or causing issues.
 *
 * Usage: node simple-email-cron.js
 */

const cron = require("node-cron");
const {
  fetchRecentEmail,
  fetchSentEmails,
} = require("./controllers/email/emailController");
const UserCredential = require("./models/email/userCredentialModel");

// Configuration
const CRON_SCHEDULE = process.env.EMAIL_FETCH_SCHEDULE || "*/5 * * * *"; // Every 5 minutes
const MAX_CONCURRENT_JOBS = 3; // Limit concurrent email fetches

let isRunning = false;
let currentJobs = 0;

/**
 * Process email fetch for a single user
 */
async function processUserEmailFetch(credential) {
  if (currentJobs >= MAX_CONCURRENT_JOBS) {
    console.log(
      `⏳ Skipping user ${credential.masterUserID} - too many concurrent jobs`
    );
    return;
  }

  currentJobs++;
  console.log(
    `📧 Processing email fetch for user ${credential.masterUserID} (${credential.email})`
  );

  try {
    // Create mock request and response objects
    const mockReq = {
      adminId: credential.masterUserID,
      body: {},
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          if (code === 200) {
            console.log(
              `✅ Recent emails fetched for user ${credential.masterUserID}`
            );
          } else {
            console.log(
              `⚠️  Email fetch returned ${code} for user ${credential.masterUserID}:`,
              data.message
            );
          }
          return { status: code, data };
        },
      }),
      json: (data) => {
        console.log(
          `📬 Email fetch result for user ${credential.masterUserID}:`,
          data.message
        );
        return { data };
      },
    };

    // Fetch recent emails
    await fetchRecentEmail(mockReq, mockRes);

    // Small delay between recent and sent emails
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Fetch sent emails
    await fetchSentEmails(mockReq, mockRes);

    console.log(`✅ Completed email fetch for user ${credential.masterUserID}`);
  } catch (error) {
    console.error(
      `❌ Error processing email fetch for user ${credential.masterUserID}:`,
      error.message
    );
    console.error("  Full error:", error);
  } finally {
    currentJobs--;
  }
}

/**
 * Main email fetch job
 */
async function runEmailFetchJob() {
  if (isRunning) {
    console.log("⏳ Email fetch job already running, skipping...");
    return;
  }

  isRunning = true;
  const startTime = new Date();

  try {
    console.log(`🚀 Starting email fetch job at ${startTime.toISOString()}`);

    // Get all user credentials
    const credentials = await UserCredential.findAll({
      where: { isActive: true },
    });

    if (!credentials || credentials.length === 0) {
      console.log("⚠️  No active email credentials found");
      return;
    }

    console.log(`📋 Found ${credentials.length} active email credential(s)`);

    // Process each credential
    const promises = credentials.map((credential) =>
      processUserEmailFetch(credential)
    );

    // Wait for all jobs to complete
    await Promise.allSettled(promises);

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log(`✅ Email fetch job completed in ${duration}s`);
  } catch (error) {
    console.error("❌ Email fetch job failed:", error.message);
    console.error("Full error:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Log memory usage
 */
function logMemoryUsage() {
  const mem = process.memoryUsage();
  const rss = (mem.rss / 1024 / 1024).toFixed(1);
  const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);

  console.log(
    `📊 Memory Usage - RSS: ${rss}MB, Heap: ${heapUsed}MB / ${heapTotal}MB`
  );
}

/**
 * Start the cron job
 */
function startSimpleEmailCron() {
  console.log("🕒 Starting Simple Email Cron Job");
  console.log(`⏰ Schedule: ${CRON_SCHEDULE}`);
  console.log(`🔄 Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);

  // Schedule the cron job
  cron.schedule(
    CRON_SCHEDULE,
    async () => {
      console.log("\n" + "=".repeat(50));
      console.log(`🕐 Cron job triggered at ${new Date().toISOString()}`);

      await runEmailFetchJob();

      // Log memory usage after job completion
      logMemoryUsage();

      console.log("=".repeat(50));
    },
    {
      scheduled: true,
      timezone: "America/New_York", // Adjust timezone as needed
    }
  );

  console.log("✅ Simple Email Cron Job started successfully");
  console.log("📝 Logs will appear when the job runs");

  // Also run once immediately for testing
  setTimeout(() => {
    console.log("\n🧪 Running initial test...");
    runEmailFetchJob();
  }, 2000);
}

/**
 * Stop the cron job
 */
function stopSimpleEmailCron() {
  console.log("🛑 Stopping Simple Email Cron Job");
  process.exit(0);
}

/**
 * Handle graceful shutdown
 */
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  stopSimpleEmailCron();
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  stopSimpleEmailCron();
});

// Handle command line execution
if (require.main === module) {
  startSimpleEmailCron();
}

module.exports = {
  runEmailFetchJob,
  processUserEmailFetch,
  startSimpleEmailCron,
  stopSimpleEmailCron,
};
