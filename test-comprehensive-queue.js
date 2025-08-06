// Comprehensive test script for queue email fetching
// This script helps diagnose and test the email queue processing

const express = require("express");
const app = express();
app.use(express.json());

// Mock the email controller to test the logic
const testFetchInboxEmails = (batchParams) => {
  console.log(`\n=== TESTING BATCH ${batchParams.page} ===`);
  console.log("Input parameters:", batchParams);

  // Simulate the dynamic UID calculation logic
  const simulateUIDCalculation = (params) => {
    // Simulate 113 emails with UIDs 1001-1113 (similar to real IMAP UIDs)
    const allUIDs = Array.from({ length: 113 }, (_, i) => 1001 + i);

    console.log(
      `Total UIDs available: ${allUIDs.length} (${allUIDs[0]} to ${
        allUIDs[allUIDs.length - 1]
      })`
    );

    if (params.dynamicFetch) {
      const skipCount = parseInt(params.skipCount) || 0;
      const queueBatchSize = parseInt(params.batchSize) || 25;
      const startIdx = skipCount;
      const endIdx = Math.min(startIdx + queueBatchSize, allUIDs.length);
      const batchUIDs = allUIDs.slice(startIdx, endIdx);

      console.log(`Batch calculation:
        - skipCount: ${skipCount}
        - queueBatchSize: ${queueBatchSize} 
        - startIdx: ${startIdx}
        - endIdx: ${endIdx}
        - batchUIDs.length: ${batchUIDs.length}`);

      if (batchUIDs.length > 0) {
        console.log(
          `UIDs for this batch: ${batchUIDs[0]} to ${
            batchUIDs[batchUIDs.length - 1]
          }`
        );
        console.log(`First 5 UIDs: [${batchUIDs.slice(0, 5).join(", ")}]`);

        return {
          success: true,
          uids: batchUIDs,
          count: batchUIDs.length,
        };
      } else {
        console.log("❌ No UIDs calculated for this batch!");
        return {
          success: false,
          uids: [],
          count: 0,
        };
      }
    }

    return { success: false, message: "Dynamic fetch not enabled" };
  };

  const result = simulateUIDCalculation(batchParams);

  if (result.success) {
    console.log(
      `✅ Batch ${batchParams.page}: Would process ${result.count} emails`
    );
    console.log(
      `   UID range: ${result.uids[0]} - ${result.uids[result.uids.length - 1]}`
    );
  } else {
    console.log(
      `❌ Batch ${batchParams.page}: Failed - ${result.message || "No UIDs"}`
    );
  }

  return result;
};

// Test all 5 batches
console.log("=== COMPREHENSIVE QUEUE BATCH TEST ===\n");

const testBatches = [
  { page: 1, dynamicFetch: true, skipCount: 0, batchSize: 25, days: 7 },
  { page: 2, dynamicFetch: true, skipCount: 25, batchSize: 25, days: 7 },
  { page: 3, dynamicFetch: true, skipCount: 50, batchSize: 25, days: 7 },
  { page: 4, dynamicFetch: true, skipCount: 75, batchSize: 25, days: 7 },
  { page: 5, dynamicFetch: true, skipCount: 100, batchSize: 25, days: 7 },
];

let totalProcessed = 0;
const results = [];

testBatches.forEach((batch) => {
  const result = testFetchInboxEmails(batch);
  results.push(result);
  totalProcessed += result.count || 0;
});

console.log("\n=== SUMMARY ===");
console.log(`Total emails that would be processed: ${totalProcessed}`);
console.log(`Expected total emails: 113`);
console.log(`Match: ${totalProcessed === 113 ? "✅ YES" : "❌ NO"}`);

// Check for overlaps
console.log("\n=== OVERLAP CHECK ===");
let allProcessedUIDs = [];
results.forEach((result, index) => {
  if (result.success) {
    const batch = testBatches[index];
    console.log(
      `Batch ${batch.page}: UIDs ${result.uids[0]} to ${
        result.uids[result.uids.length - 1]
      }`
    );

    // Check for overlaps with previous batches
    const overlaps = result.uids.filter((uid) =>
      allProcessedUIDs.includes(uid)
    );
    if (overlaps.length > 0) {
      console.log(
        `❌ OVERLAP DETECTED in batch ${batch.page}: UIDs ${overlaps.join(
          ", "
        )}`
      );
    } else {
      console.log(`✅ No overlaps in batch ${batch.page}`);
    }

    allProcessedUIDs.push(...result.uids);
  }
});

console.log("\n=== INSTRUCTIONS ===");
console.log(
  "If this test shows correct batch processing but your actual queue still fails:"
);
console.log(
  "1. Check your queue worker is properly passing skipCount parameter"
);
console.log(
  "2. Verify the queue messages contain: dynamicFetch=true, skipCount=X, batchSize=25"
);
console.log("3. Run queue with debugMode=true to bypass duplicate detection");
console.log("4. Check IMAP server is returning different UIDs for each batch");
console.log(
  "5. Verify database connection and Email model is working correctly"
);

module.exports = { testFetchInboxEmails };
