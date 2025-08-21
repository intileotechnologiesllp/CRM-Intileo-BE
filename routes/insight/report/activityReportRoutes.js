const express = require("express");
const router = express.Router();
const activityReportController = require("../../../controllers/insight/report/activityReportController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");
// Apply auth middleware to all routes
// router.use(authMiddleware);


router.post("/create-activityreport", verifyToken, activityReportController.createActivityReport);

router.post("/get-summaryactivityreport", verifyToken, activityReportController.getActivityReportSummary);

router.patch("/save-activityreport/:reportId", verifyToken, activityReportController.saveActivityReport);

router.delete("/delete-activityreport/:reportId", verifyToken, activityReportController.deleteActivityReport);

module.exports = router;