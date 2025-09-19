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

router.post("/create-dealconversionreport", verifyToken, dealReportController.createDealConversionReport);

router.post("/get-summarydealconversionreport", verifyToken, dealReportController.getDealConversionReportSummary);

router.post("/save-dealconversionreport", verifyToken, dealReportController.saveDealConversionReport);

router.post("/create-dealprogressreport", verifyToken, dealReportController.createDealProgressReport);

router.post("/get-summarydealprogressreport", verifyToken, dealReportController.getDealProgressReportSummary);

router.post("/save-dealprogressreport", verifyToken, dealReportController.saveDealProgressReport);

router.post("/create-dealdurationreport", verifyToken, dealReportController.createDealDurationReport);

router.post("/create-funneldealconversionreport", verifyToken, dealReportController.createFunnelDealConversionReport);

module.exports = router;