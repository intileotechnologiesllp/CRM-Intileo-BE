const express = require("express");
const router = express.Router();
const dbContextMiddleware = require("../../middlewares/dbContext");
const auditHistoryController = require("../../controllers/reports/auditHistoryController"); // Adjust the path as necessary


router.use(dbContextMiddleware);

router.get("/", auditHistoryController.getAuditHistory); // Get audit history


module.exports = router;