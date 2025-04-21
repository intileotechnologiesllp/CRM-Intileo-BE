const express = require("express");
const router = express.Router();
const auditHistoryController = require("../../controllers/reports/auditHistoryController"); // Adjust the path as necessary

router.get("/", auditHistoryController.getAuditHistory); // Get audit history


module.exports = router;