const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const followerController = require("../controllers/follower/followerController");

// Apply authentication middleware to all routes
router.use(verifyToken);

// ===================================================================
// FOLLOWER MANAGEMENT ROUTES
// ===================================================================

/**
 * Add a follower to an entity
 * POST /api/followers/:entityType/:entityId
 * Body: { userId: number }
 * entityType: deal, lead, person, organization
 */
router.post(
  "/:entityType/:entityId",
  followerController.addFollower
);

/**
 * Remove a follower from an entity
 * DELETE /api/followers/:entityType/:entityId/:userId
 */
router.delete(
  "/:entityType/:entityId/:userId",
  followerController.removeFollower
);

/**
 * Get all followers for an entity
 * GET /api/followers/:entityType/:entityId
 */
router.get(
  "/:entityType/:entityId",
  followerController.getFollowers
);

/**
 * Get follower count for an entity
 * GET /api/followers/:entityType/:entityId/count
 */
router.get(
  "/:entityType/:entityId/count",
  followerController.getFollowerCount
);

/**
 * Check if a user is following an entity
 * GET /api/followers/:entityType/:entityId/check/:userId
 */
router.get(
  "/:entityType/:entityId/check/:userId",
  followerController.checkIfFollowing
);

/**
 * Get all entities followed by a user
 * GET /api/followers/user/:userId
 * Query params: ?entityType=deal (optional filter)
 */
router.get(
  "/user/:userId",
  followerController.getUserFollowing
);

/**
 * Bulk add followers to an entity
 * POST /api/followers/:entityType/:entityId/bulk
 * Body: { userIds: number[] }
 */
router.post(
  "/:entityType/:entityId/bulk",
  followerController.bulkAddFollowers
);

/**
 * Bulk remove followers from an entity
 * DELETE /api/followers/:entityType/:entityId/bulk
 * Body: { userIds: number[] }
 */
router.delete(
  "/:entityType/:entityId/bulk",
  followerController.bulkRemoveFollowers
);

module.exports = router;
