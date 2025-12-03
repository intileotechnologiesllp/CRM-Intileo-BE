const express = require("express");
const router = express.Router();
const organizationReportController = require("../../../controllers/insight/report/organizationReportController.js");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");

router.post("/create-organizationreport", verifyToken, organizationReportController.createOrganizationReport);

router.post("/get-summaryorganizationreport", verifyToken, organizationReportController.getOrganizationReportSummary);

router.post("/save-organizationreport", verifyToken, organizationReportController.saveOrganizationReport);

module.exports = router;