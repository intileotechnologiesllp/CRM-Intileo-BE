// Diagnostic script to test fetchInboxEmails function parameters
// This simulates what the queue worker would call

console.log("=== QUEUE WORKER SIMULATION ===");

// Simulate the request objects that would be passed to fetchInboxEmails
const simulateBatch = (batchNumber, totalBatches = 5, batchSize = 25) => {
  const skipCount = (batchNumber - 1) * batchSize;

  console.log(`\n--- Simulating Batch ${batchNumber} ---`);

  const req = {
    query: {
      dynamicFetch: true,
      skipCount: skipCount,
      batchSize: batchSize,
      page: batchNumber,
      days: 7,
    },
    body: {
      // These would be populated by the queue message
    },
    adminId: "test-user-123",
  };

  const res = {
    status: (code) => ({
      json: (data) => {
        console.log(`Response (${code}):`, JSON.stringify(data, null, 2));
        return res;
      },
    }),
  };

  console.log("Request query parameters:", req.query);
  console.log("Expected behavior:");
  console.log(`  - Should skip first ${skipCount} emails`);
  console.log(
    `  - Should process emails ${skipCount + 1} to ${skipCount + batchSize}`
  );

  return { req, res };
};

// Test all 5 batches
for (let i = 1; i <= 5; i++) {
  simulateBatch(i);
}

console.log("\n=== DIAGNOSTIC COMPLETE ===");
console.log(
  "If you're still getting the same 25 emails in each batch, the issue is likely:"
);
console.log("1. Queue worker not properly passing skipCount parameter");
console.log(
  "2. IMAP server returning same results despite different UID queries"
);
console.log("3. Database duplicate detection preventing new saves");
console.log("\nNext steps:");
console.log("1. Check queue worker logs for parameter passing");
console.log(
  "2. Temporarily remove duplicate detection to see if emails are different"
);
console.log(
  "3. Add more detailed UID logging in the actual fetchInboxEmails function"
);
