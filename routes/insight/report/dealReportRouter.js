const express = require("express");
const router = express.Router();
const dealReportController = require("../../../controllers/insight/report/dealReportController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");
// Apply auth middleware to all routes
// router.use(authMiddleware);


router.post("/create-dealperformreport", verifyToken, dealReportController.createDealPerformReport);

router.post("/get-summarydealperformreport", verifyToken, dealReportController.getDealPerformReportSummary);

router.post("/save-dealperformreport", verifyToken, dealReportController.saveDealPerformReport);


module.exports = router;