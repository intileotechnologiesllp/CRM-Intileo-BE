const express = require("express");
const router = express.Router();
const contactReportController = require("../../../controllers/insight/report/contactReportController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");
// Apply auth middleware to all routes
// router.use(authMiddleware);


router.post("/create-personreport", verifyToken, contactReportController.createPersonReport);

router.post("/get-summarypersonreport", verifyToken, contactReportController.getPersonReportSummary);

router.post("/save-personreport", verifyToken, contactReportController.savePersonReport);

router.post("/create-organizationreport", verifyToken, contactReportController.createOrganizationReport);

router.post("/get-summaryorganizationreport", verifyToken, contactReportController.getOrganizationReportSummary);

router.post("/save-organizationreport", verifyToken, contactReportController.saveOrganizationReport);

module.exports = router;