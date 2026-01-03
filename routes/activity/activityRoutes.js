const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const validatePrivilege = require("../../middlewares/validatePrivilege");
const dbContextMiddleware = require("../../middlewares/dbContext");

const activityController = require("../../controllers/activity/activityController");
const activitySettingsMiddleware = require("../../middlewares/activitySettingsMiddleware");

router.use(dbContextMiddleware);

router.post("/create-activity", verifyToken, activityController.createActivity);
router.get("/get-activities", verifyToken,activityController.getActivities);
router.get("/get-activity/:activityId", verifyToken, activityController.getActivityById);
router.delete("/delete-activity/:activityId", verifyToken, validatePrivilege(22, "delete"), activityController.deleteActivity);
router.get(
  "/mark-as-done/:activityId",
  verifyToken,activitySettingsMiddleware,
  activityController.markActivityAsDone
);
router.post(
  "/update-activity/:activityId",
  verifyToken,
  activityController.updateActivity
);
router.get(
  "/save-activity-fields",
  verifyToken,
  activityController.saveAllActivityFieldsWithCheck
);
router.post(
  "/check-columns",
  verifyToken,
  activityController.updateActivityColumnChecks
);
router.get(
  "/get-activity-fields",
  verifyToken,
  activityController.getActivityFields
);
router.get(
  "/get-All-leads-and-deals",
  verifyToken,
  activityController.getAllLeadsAndDeals
);
router.get(
  "/get-organization",
  verifyToken,
  activityController.getAllOrganizations
);
router.get(
  "/get-calender-activities",
  verifyToken,
  activityController.getCalendarActivities
);
router.get(
  "/get-filter-fields",
  activityController.getActivityFilterFields
);

// Get connected person and organization data by leadId or dealId
router.get(
  "/connected-data",
  verifyToken,
  activityController.getConnectedData
);

// Bulk activity operations
router.post("/bulk-edit", verifyToken, activityController.bulkEditActivities);
router.post(
  "/bulk-delete",
  verifyToken,
  validatePrivilege(22, "delete"),
  activityController.bulkDeleteActivities
);
router.post("/bulk-mark", verifyToken, activityController.bulkMarkActivities);
router.post(
  "/bulk-reassign",
  verifyToken,
  validatePrivilege(21, "edit_owner"),
  activityController.bulkReassignActivities
);

module.exports = router;
