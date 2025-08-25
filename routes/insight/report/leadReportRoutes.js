const express = require("express");
const router = express.Router();
const leadReportController = require("../../../controllers/insight/report/leadReportController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");
// Apply auth middleware to all routes
// router.use(authMiddleware);


router.post("/create-leadperformreport", verifyToken, leadReportController.createLeadPerformReport);

router.post("/get-summaryleadperformreport", verifyToken, leadReportController.getLeadPerformReportSummary);

router.post("/save-leadperformreport", verifyToken, leadReportController.saveLeadPerformReport);

router.patch("/update-leadperformreport/:reportId", verifyToken, leadReportController.updateLeadPerformReport);

router.delete("/delete-leadperformreport/:reportId", verifyToken, leadReportController.deleteLeadPerformReport);


module.exports = router;