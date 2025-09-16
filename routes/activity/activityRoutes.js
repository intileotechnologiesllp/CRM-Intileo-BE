const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const activityController = require("../../controllers/activity/activityController");
const activitySettingsMiddleware = require("../../middlewares/activitySettingsMiddleware");

router.post("/create-activity", verifyToken, activityController.createActivity);
router.get("/get-activities", verifyToken,activityController.getActivities);
router.delete("/delete-activity/:activityId", verifyToken, activityController.deleteActivity);
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
  verifyToken,
  activityController.getActivityFilterFields
);

// Bulk activity operations
router.post("/bulk-edit", verifyToken, activityController.bulkEditActivities);
router.post(
  "/bulk-delete",
  verifyToken,
  activityController.bulkDeleteActivities
);
router.post("/bulk-mark", verifyToken, activityController.bulkMarkActivities);
router.post(
  "/bulk-reassign",
  verifyToken,
  activityController.bulkReassignActivities
);

module.exports = router;
