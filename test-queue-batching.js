const Imap = require("imap-simple");

// Test script to verify the dynamic UID calculation fix
async function testDynamicUIDCalculation() {
  console.log("=== TESTING DYNAMIC UID CALCULATION ===");

  // Simulate the IMAP connection and search (you'll need to replace with your actual credentials)
  const imapConfig = {
    imap: {
      user: "YOUR_EMAIL", // Replace with actual email
      password: "YOUR_APP_PASSWORD", // Replace with actual app password
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      authTimeout: 30000,
      tlsOptions: { rejectUnauthorized: false },
    },
  };

  try {
    console.log("Connecting to IMAP...");
    const connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");

    // Get all messages for the last 7 days (similar to the actual function)
    const formatDateForIMAP = (date) => {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const sinceDate = formatDateForIMAP(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    console.log(`Using SINCE date: ${sinceDate}`);

    const allMessages = await connection.search([["SINCE", sinceDate]], {
      bodies: [],
      struct: true,
    });
    const allUIDs = allMessages
      .map((msg) => msg.attributes.uid)
      .sort((a, b) => a - b);

    console.log(`Total UIDs found: ${allUIDs.length}`);
    console.log(`UID range: ${allUIDs[0]} to ${allUIDs[allUIDs.length - 1]}`);

    // Test batch calculations (25 emails per batch)
    const batchSize = 25;
    const numBatches = Math.ceil(allUIDs.length / batchSize);

    console.log(`\n=== BATCH CALCULATIONS ===`);
    console.log(`Batch size: ${batchSize}`);
    console.log(`Total batches: ${numBatches}`);

    for (let page = 1; page <= Math.min(numBatches, 5); page++) {
      const skipCount = (page - 1) * batchSize;
      const startIdx = skipCount;
      const endIdx = Math.min(startIdx + batchSize, allUIDs.length);
      const batchUIDs = allUIDs.slice(startIdx, endIdx);

      console.log(`\n--- Batch ${page} ---`);
      console.log(`Skip count: ${skipCount}`);
      console.log(`Start index: ${startIdx}, End index: ${endIdx - 1}`);
      console.log(`Batch UIDs count: ${batchUIDs.length}`);
      console.log(
        `First UID: ${batchUIDs[0]}, Last UID: ${
          batchUIDs[batchUIDs.length - 1]
        }`
      );
      console.log(
        `UIDs: ${batchUIDs.slice(0, 5).join(",")}${
          batchUIDs.length > 5 ? "..." : ""
        }`
      );
    }

    await connection.end();
    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test (uncomment the line below and add your credentials)
// testDynamicUIDCalculation();

console.log("Test script created. Please:");
console.log("1. Replace YOUR_EMAIL and YOUR_APP_PASSWORD with actual values");
console.log("2. Uncomment the last line");
console.log("3. Run: node test-queue-batching.js");
