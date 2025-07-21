const {
  cleanupRecentSearches,
  cleanupDuplicateSearches,
  getRecentSearchStats,
} = require("./recentSearchCleanup");

async function testCleanup() {
  console.log("=== TESTING RECENT SEARCH CLEANUP UTILITIES ===\n");

  try {
    // Get initial stats
    console.log("1. Getting initial statistics...");
    const initialStats = await getRecentSearchStats();
    console.log("Initial stats:", JSON.stringify(initialStats, null, 2));
    console.log();

    // Test cleanup with safe parameters
    console.log("2. Testing cleanup (keep last 7 days, max 20 per user)...");
    const cleanupResult = await cleanupRecentSearches({
      daysToKeep: 7,
      maxPerUser: 20,
    });
    console.log("Cleanup result:", JSON.stringify(cleanupResult, null, 2));
    console.log();

    // Test duplicate cleanup for a specific user (if we had a test user)
    console.log("3. Testing duplicate cleanup...");
    // Note: This would need a real adminId to test properly
    // const duplicateResult = await cleanupDuplicateSearches(1);
    // console.log("Duplicate cleanup result:", JSON.stringify(duplicateResult, null, 2));
    console.log("Skipping duplicate cleanup test (requires real adminId)");
    console.log();

    // Get final stats
    console.log("4. Getting final statistics...");
    const finalStats = await getRecentSearchStats();
    console.log("Final stats:", JSON.stringify(finalStats, null, 2));

    console.log("\n=== CLEANUP TEST COMPLETED ===");
  } catch (error) {
    console.error("Test failed:", error);
  }

  // Close database connection if needed
  process.exit(0);
}

// Run the test
if (require.main === module) {
  testCleanup();
}

module.exports = { testCleanup };
