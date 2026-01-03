const express = require("express");
const router = express.Router();
const activityReportController = require("../../../controllers/insight/report/activityReportController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../../middlewares/dbContext");
// Apply auth middleware to all routes
// router.use(authMiddleware);


router.use(dbContextMiddleware);


router.post("/create-activityreport", verifyToken, activityReportController.createActivityReport);

router.post("/get-activity-data", verifyToken,  activityReportController.createActivityReportDrillDown);

router.post("/save-coordinates", verifyToken,  activityReportController.saveCoordinates);

router.post("/get-summaryactivityreport", verifyToken, activityReportController.getActivityReportSummary);

router.post("/save-activityreport", verifyToken, activityReportController.saveActivityReport);

router.patch("/update-activityreport/:reportId", verifyToken, activityReportController.updateActivityReport);

router.delete("/delete-activityreport/:reportId", verifyToken, activityReportController.deleteActivityReport);

router.post("/create-emailreport", verifyToken, activityReportController.createEmailReport);

router.post("/save-emailreport", verifyToken, activityReportController.saveEmailReport);

router.post("/get-summaryemailreport", verifyToken, activityReportController.getEmailReportSummary);

module.exports = router;