// Simple test to verify batch processing logic
function testBatchLogic() {
  console.log("=== TESTING BATCH LOGIC ===");

  // Simulate having 113 emails with UIDs from 1 to 113
  const allUIDs = Array.from({ length: 113 }, (_, i) => i + 1);
  const batchSize = 25;
  const numBatches = Math.ceil(allUIDs.length / batchSize);

  console.log(`Total UIDs: ${allUIDs.length}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Number of batches: ${numBatches}`);
  console.log(`UIDs range: ${allUIDs[0]} to ${allUIDs[allUIDs.length - 1]}`);

  console.log("\n=== BATCH CALCULATIONS ===");

  for (let page = 1; page <= numBatches; page++) {
    const skipCount = (page - 1) * batchSize;
    const startIdx = skipCount;
    const endIdx = Math.min(startIdx + batchSize, allUIDs.length);
    const batchUIDs = allUIDs.slice(startIdx, endIdx);

    console.log(`\n--- Batch ${page} ---`);
    console.log(`skipCount: ${skipCount}`);
    console.log(`startIdx: ${startIdx}, endIdx: ${endIdx}`);
    console.log(`batchUIDs.length: ${batchUIDs.length}`);
    console.log(
      `First UID: ${batchUIDs[0]}, Last UID: ${batchUIDs[batchUIDs.length - 1]}`
    );
    console.log(
      `UIDs: [${batchUIDs.slice(0, 5).join(", ")}${
        batchUIDs.length > 5 ? ", ..." : ""
      }]`
    );

    // Verify no overlap
    if (page > 1) {
      const prevBatchSkip = (page - 2) * batchSize;
      const prevBatchEnd = Math.min(prevBatchSkip + batchSize, allUIDs.length);
      const prevLastUID = allUIDs[prevBatchEnd - 1];
      const currentFirstUID = batchUIDs[0];

      if (currentFirstUID <= prevLastUID) {
        console.error(
          `❌ OVERLAP DETECTED! Current batch first UID ${currentFirstUID} <= Previous batch last UID ${prevLastUID}`
        );
      } else {
        console.log(
          `✅ No overlap: Current first UID ${currentFirstUID} > Previous last UID ${prevLastUID}`
        );
      }
    }
  }

  // Summary
  const totalProcessed = numBatches * batchSize;
  const lastBatchSize = allUIDs.length % batchSize || batchSize;
  const actualTotalProcessed = (numBatches - 1) * batchSize + lastBatchSize;

  console.log(`\n=== SUMMARY ===`);
  console.log(`Expected total processed: ${actualTotalProcessed}`);
  console.log(`Actual total emails: ${allUIDs.length}`);
  console.log(
    `Match: ${actualTotalProcessed === allUIDs.length ? "✅ YES" : "❌ NO"}`
  );
}

testBatchLogic();
