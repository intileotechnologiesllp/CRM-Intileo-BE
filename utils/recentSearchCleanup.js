const RecentSearch = require("../models/recentSearchModel");
const { Op } = require("sequelize");

/**
 * Clean up old recent search entries
 * @param {Object} options - Cleanup options
 * @param {number} options.daysToKeep - Number of days to keep searches (default: 30)
 * @param {number} options.maxPerUser - Maximum searches per user to keep (default: 50)
 * @param {number} options.adminId - Specific admin ID to clean (optional)
 */
async function cleanupRecentSearches(options = {}) {
  const { daysToKeep = 30, maxPerUser = 50, adminId = null } = options;

  try {
    console.log("=== RECENT SEARCH CLEANUP STARTED ===");
    console.log(`Days to keep: ${daysToKeep}`);
    console.log(`Max per user: ${maxPerUser}`);
    console.log(`Admin ID filter: ${adminId || "all users"}`);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let totalDeleted = 0;

    // Method 1: Delete searches older than specified days
    const whereCondition = {
      searchedAt: {
        [Op.lt]: cutoffDate,
      },
    };

    if (adminId) {
      whereCondition.masterUserID = adminId;
    }

    const oldSearchesDeleted = await RecentSearch.destroy({
      where: whereCondition,
    });

    totalDeleted += oldSearchesDeleted;
    console.log(
      `Deleted ${oldSearchesDeleted} searches older than ${daysToKeep} days`
    );

    // Method 2: Keep only the most recent N searches per user
    if (maxPerUser > 0) {
      // Get all users (or specific user)
      const userCondition = adminId ? { masterUserID: adminId } : {};

      const users = await RecentSearch.findAll({
        where: userCondition,
        attributes: ["masterUserID"],
        group: ["masterUserID"],
      });

      for (const user of users) {
        const userId = user.masterUserID;

        // Get total count for this user
        const userSearchCount = await RecentSearch.count({
          where: { masterUserID: userId },
        });

        if (userSearchCount > maxPerUser) {
          // Get IDs of searches to keep (most recent ones)
          const searchesToKeep = await RecentSearch.findAll({
            where: { masterUserID: userId },
            order: [["searchedAt", "DESC"]],
            limit: maxPerUser,
            attributes: ["id"],
          });

          const idsToKeep = searchesToKeep.map((s) => s.id);

          // Delete the rest
          const excessDeleted = await RecentSearch.destroy({
            where: {
              masterUserID: userId,
              id: {
                [Op.notIn]: idsToKeep,
              },
            },
          });

          totalDeleted += excessDeleted;
          console.log(
            `Deleted ${excessDeleted} excess searches for user ${userId} (kept ${maxPerUser})`
          );
        }
      }
    }

    console.log(
      `=== CLEANUP COMPLETED: ${totalDeleted} total searches deleted ===`
    );

    return {
      success: true,
      deletedCount: totalDeleted,
      cutoffDate: cutoffDate,
      daysToKeep,
      maxPerUser,
    };
  } catch (error) {
    console.error("Error cleaning up recent searches:", error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0,
    };
  }
}

/**
 * Clean up duplicate recent searches for a user
 * @param {number} adminId - User ID to clean duplicates for
 */
async function cleanupDuplicateSearches(adminId) {
  try {
    console.log(`=== CLEANING DUPLICATE SEARCHES FOR USER ${adminId} ===`);

    // Find duplicate search terms for this user
    const duplicates = await RecentSearch.findAll({
      where: { masterUserID: adminId },
      attributes: [
        "searchTerm",
        [
          RecentSearch.sequelize.fn(
            "COUNT",
            RecentSearch.sequelize.col("searchTerm")
          ),
          "count",
        ],
      ],
      group: ["searchTerm"],
      having: RecentSearch.sequelize.literal("COUNT(searchTerm) > 1"),
      raw: true,
    });

    let totalDeleted = 0;

    for (const duplicate of duplicates) {
      // Keep only the most recent search for each term
      const allSearches = await RecentSearch.findAll({
        where: {
          masterUserID: adminId,
          searchTerm: duplicate.searchTerm,
        },
        order: [["searchedAt", "DESC"]],
      });

      // Delete all except the first (most recent)
      const searchesToDelete = allSearches.slice(1);
      const idsToDelete = searchesToDelete.map((s) => s.id);

      if (idsToDelete.length > 0) {
        const deleted = await RecentSearch.destroy({
          where: { id: { [Op.in]: idsToDelete } },
        });
        totalDeleted += deleted;
        console.log(
          `Removed ${deleted} duplicate searches for term: "${duplicate.searchTerm}"`
        );
      }
    }

    console.log(
      `=== DUPLICATE CLEANUP COMPLETED: ${totalDeleted} duplicates removed ===`
    );
    return { success: true, deletedCount: totalDeleted };
  } catch (error) {
    console.error("Error cleaning duplicate searches:", error);
    return { success: false, error: error.message, deletedCount: 0 };
  }
}

/**
 * Get statistics about recent searches
 */
async function getRecentSearchStats() {
  try {
    const stats = await RecentSearch.findAll({
      attributes: [
        "masterUserID",
        [
          RecentSearch.sequelize.fn("COUNT", RecentSearch.sequelize.col("id")),
          "searchCount",
        ],
        [
          RecentSearch.sequelize.fn(
            "MAX",
            RecentSearch.sequelize.col("searchedAt")
          ),
          "lastSearch",
        ],
        [
          RecentSearch.sequelize.fn(
            "MIN",
            RecentSearch.sequelize.col("searchedAt")
          ),
          "firstSearch",
        ],
      ],
      group: ["masterUserID"],
      raw: true,
    });

    const totalSearches = await RecentSearch.count();
    const totalUsers = stats.length;

    return {
      totalSearches,
      totalUsers,
      userStats: stats,
      avgSearchesPerUser:
        totalUsers > 0 ? Math.round(totalSearches / totalUsers) : 0,
    };
  } catch (error) {
    console.error("Error getting search stats:", error);
    return null;
  }
}

module.exports = {
  cleanupRecentSearches,
  cleanupDuplicateSearches,
  getRecentSearchStats,
};
