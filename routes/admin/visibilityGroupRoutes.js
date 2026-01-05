const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
// Import controllers
const visibilityGroupController = require("../../controllers/admin/visibilityGroupController");
const groupMembershipController = require("../../controllers/admin/groupMembershipController");
// const pipelineVisibilityController = require("../../controllers/admin/pipelineVisibilityController");

// Role checking middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

// Apply authentication middleware to all routes
router.use(dbContextMiddleware);
router.use(verifyToken);


// ===========================================
// VISIBILITY GROUPS ROUTES
// ===========================================

// Get all visibility groups
router.get("/", visibilityGroupController.getVisibilityGroups);

// Create a new visibility group (Admin only)
router.post(
  "/",
  requireRole(["admin"]),
  visibilityGroupController.createVisibilityGroup
);

// Get a specific visibility group
router.get("/:groupId", visibilityGroupController.getVisibilityGroupById);

// Update a visibility group (Admin only)
router.put(
  "/:groupId",
  requireRole(["admin"]),
  visibilityGroupController.updateVisibilityGroup
);

// Delete a visibility group (Admin only)
router.delete(
  "/:groupId",
  requireRole(["admin"]),
  visibilityGroupController.deleteVisibilityGroup
);

// ===========================================
// GROUP MEMBERSHIP ROUTES
// ===========================================

// Get available users for group assignment (must come before /:groupId/users)
router.get("/users/available", groupMembershipController.getAvailableUsers);

// Move user to a different group (Admin only)
router.put(
  "/users/:userId/move",
  requireRole(["admin"]),
  groupMembershipController.moveUserToGroup
);

// Get users in a specific group
router.get("/:groupId/users", groupMembershipController.getGroupUsers);

// Add users to a group (Admin only)
router.post(
  "/:groupId/users",
  requireRole(["admin"]),
  groupMembershipController.addUsersToGroup
);

// Remove a user from a group (Admin only)
router.delete(
  "/:groupId/users/:userId",
  requireRole(["admin"]),
  groupMembershipController.removeUserFromGroup
);

// ===========================================
// PIPELINE VISIBILITY ROUTES
// ===========================================
// Temporarily commented out to fix server startup

// // Get pipeline visibility rules for a group
// router.get("/:groupId/pipelines", pipelineVisibilityController.getGroupPipelineRules);

// // Update pipeline visibility rules for a group (Admin only)
// router.put("/:groupId/pipelines", requireRole(["admin"]), pipelineVisibilityController.updateGroupPipelineRules);

// // Grant access to specific pipeline (Admin only)
// router.post("/:groupId/pipelines/:pipelineId/grant", requireRole(["admin"]), pipelineVisibilityController.grantPipelineAccess);

// // Revoke access to specific pipeline (Admin only)
// router.delete("/:groupId/pipelines/:pipelineId/revoke", requireRole(["admin"]), pipelineVisibilityController.revokePipelineAccess);

module.exports = router;
