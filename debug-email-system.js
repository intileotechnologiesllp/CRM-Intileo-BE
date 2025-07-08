#!/usr/bin/env node
/**
 * Email System Debug Script
 *
 * This script helps debug email fetching issues by:
 * - Testing RabbitMQ connection
 * - Verifying email credentials
 * - Testing email fetch functionality
 * - Providing diagnostic information
 *
 * Usage: node debug-email-system.js
 */

require("dotenv").config();
const amqp = require("amqplib");
const UserCredential = require("./models/email/userCredentialModel");
const {
  fetchRecentEmail,
  fetchInboxEmails,
} = require("./controllers/email/emailController");

// Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const QUEUE_NAME = "email-fetch-queue";

/**
 * Test RabbitMQ connection
 */
async function testRabbitMQ() {
  console.log("🐰 Testing RabbitMQ connection...");

  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Test queue creation
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log("✅ RabbitMQ connection successful");
    console.log(`  - URL: ${RABBITMQ_URL}`);
    console.log(`  - Queue: ${QUEUE_NAME}`);

    // Test sending a message
    const testMessage = { test: true, timestamp: new Date().toISOString() };
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(testMessage)), {
      persistent: true,
    });
    console.log("✅ Test message sent to queue");

    // Clean up
    await channel.close();
    await connection.close();

    return true;
  } catch (error) {
    console.error("❌ RabbitMQ connection failed:", error.message);
    console.error("  - Ensure RabbitMQ is running on", RABBITMQ_URL);
    console.error("  - Check if the URL is correct");
    return false;
  }
}

/**
 * Test email credentials
 */
async function testEmailCredentials() {
  console.log("\n📧 Testing email credentials...");

  try {
    const credentials = await UserCredential.findAll();

    if (!credentials || credentials.length === 0) {
      console.log("⚠️  No email credentials found");
      console.log("  - Add email credentials through the admin panel");
      return false;
    }

    console.log(`✅ Found ${credentials.length} email credential(s)`);

    for (const credential of credentials) {
      console.log(`  - User ID: ${credential.masterUserID}`);
      console.log(`  - Email: ${credential.email}`);
      console.log(`  - Provider: ${credential.provider}`);
      console.log(`  - IMAP Host: ${credential.imapHost}`);
      console.log(`  - IMAP Port: ${credential.imapPort}`);
      console.log(
        `  - Has Password: ${credential.imapPassword ? "Yes" : "No"}`
      );
      console.log(`  - Created: ${credential.createdAt}`);
      console.log("  ---");
    }

    return credentials;
  } catch (error) {
    console.error("❌ Failed to retrieve email credentials:", error.message);
    return false;
  }
}

/**
 * Test direct email fetch (without RabbitMQ)
 */
async function testDirectEmailFetch() {
  console.log("\n📬 Testing direct email fetch...");

  try {
    const credentials = await UserCredential.findAll();

    if (!credentials || credentials.length === 0) {
      console.log("❌ No credentials to test email fetch");
      return false;
    }

    // Test with first credential
    const firstCredential = credentials[0];
    console.log(
      `Testing with credential for user ${firstCredential.masterUserID}`
    );

    // Create mock request object
    const mockReq = {
      adminId: firstCredential.masterUserID,
      body: {},
    };

    // Create mock response object
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response ${code}:`, data);
          return { status: code, data };
        },
      }),
      json: (data) => {
        console.log("Response:", data);
        return { data };
      },
    };

    // Test fetchRecentEmail
    console.log("🔍 Testing fetchRecentEmail...");
    await fetchRecentEmail(mockReq, mockRes);

    return true;
  } catch (error) {
    console.error("❌ Direct email fetch failed:", error.message);
    console.error("Full error:", error);
    return false;
  }
}

/**
 * Test email queue processing
 */
async function testEmailQueueProcessing() {
  console.log("\n🔄 Testing email queue processing...");

  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Get queue info
    const queueInfo = await channel.checkQueue(QUEUE_NAME);
    console.log(`✅ Queue status:`);
    console.log(`  - Messages: ${queueInfo.messageCount}`);
    console.log(`  - Consumers: ${queueInfo.consumerCount}`);

    // Add a test job
    const credentials = await UserCredential.findAll();
    if (credentials && credentials.length > 0) {
      const testJob = { adminId: credentials[0].masterUserID, debug: true };
      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(testJob)), {
        persistent: true,
      });
      console.log("✅ Test job added to queue");
    }

    await channel.close();
    await connection.close();

    return true;
  } catch (error) {
    console.error("❌ Email queue processing test failed:", error.message);
    return false;
  }
}

/**
 * Check system requirements
 */
async function checkSystemRequirements() {
  console.log("\n🔧 Checking system requirements...");

  const requirements = {
    "Node.js": process.version,
    Environment: process.env.NODE_ENV || "development",
    Database: "Checking...",
    "RabbitMQ URL": RABBITMQ_URL,
    "Gmail Client ID": process.env.GMAIL_CLIENT_ID ? "Set" : "Not Set",
    "Gmail Client Secret": process.env.GMAIL_CLIENT_SECRET ? "Set" : "Not Set",
  };

  console.log("System Information:");
  for (const [key, value] of Object.entries(requirements)) {
    console.log(`  - ${key}: ${value}`);
  }

  // Test database connection
  try {
    const sequelize = require("./config/db");
    await sequelize.authenticate();
    console.log("  - Database: ✅ Connected");
  } catch (error) {
    console.log("  - Database: ❌ Connection failed");
    console.error("    Error:", error.message);
  }
}

/**
 * Provide debugging recommendations
 */
function provideRecommendations(results) {
  console.log("\n💡 Debugging Recommendations:");

  if (!results.rabbitmq) {
    console.log("🔧 RabbitMQ Issues:");
    console.log(
      "  1. Install RabbitMQ: https://www.rabbitmq.com/download.html"
    );
    console.log("  2. Start RabbitMQ service");
    console.log("  3. Check if port 5672 is open");
    console.log("  4. Verify RABBITMQ_URL in environment variables");
    console.log("");
  }

  if (!results.credentials) {
    console.log("📧 Email Credentials Issues:");
    console.log("  1. Add email credentials through admin panel");
    console.log("  2. Verify IMAP settings are correct");
    console.log("  3. Check if email provider allows IMAP access");
    console.log('  4. For Gmail, ensure "Less secure app access" is enabled');
    console.log("");
  }

  if (!results.emailFetch) {
    console.log("📬 Email Fetch Issues:");
    console.log("  1. Check email server connectivity");
    console.log("  2. Verify email credentials are valid");
    console.log("  3. Check firewall settings");
    console.log("  4. Review email controller logs");
    console.log("");
  }

  console.log("🚀 Alternative Solutions:");
  console.log("  1. Use direct cron jobs instead of RabbitMQ");
  console.log("  2. Implement email webhook endpoints");
  console.log("  3. Use email forwarding to a dedicated inbox");
  console.log("  4. Set up email polling at longer intervals");
}

/**
 * Main debug function
 */
async function runEmailDebug() {
  console.log("🔍 Starting Email System Debug\n");

  const results = {
    rabbitmq: false,
    credentials: false,
    emailFetch: false,
    queueProcessing: false,
  };

  try {
    // Step 1: Check system requirements
    await checkSystemRequirements();

    // Step 2: Test RabbitMQ connection
    results.rabbitmq = await testRabbitMQ();

    // Step 3: Test email credentials
    results.credentials = await testEmailCredentials();

    // Step 4: Test direct email fetch
    if (results.credentials) {
      results.emailFetch = await testDirectEmailFetch();
    }

    // Step 5: Test email queue processing
    if (results.rabbitmq) {
      results.queueProcessing = await testEmailQueueProcessing();
    }

    // Step 6: Provide recommendations
    provideRecommendations(results);

    console.log("\n📊 Debug Summary:");
    console.log(`  - RabbitMQ: ${results.rabbitmq ? "✅" : "❌"}`);
    console.log(`  - Email Credentials: ${results.credentials ? "✅" : "❌"}`);
    console.log(`  - Email Fetch: ${results.emailFetch ? "✅" : "❌"}`);
    console.log(
      `  - Queue Processing: ${results.queueProcessing ? "✅" : "❌"}`
    );

    if (Object.values(results).every((r) => r)) {
      console.log("\n🎉 All email system components are working!");
    } else {
      console.log(
        "\n⚠️  Some components need attention. See recommendations above."
      );
    }
  } catch (error) {
    console.error("\n💥 Debug failed:", error.message);
    console.error("Full error:", error);
  }
}

// Handle command line execution
if (require.main === module) {
  runEmailDebug().catch(console.error);
}

module.exports = {
  testRabbitMQ,
  testEmailCredentials,
  testDirectEmailFetch,
  testEmailQueueProcessing,
  checkSystemRequirements,
  runEmailDebug,
};
