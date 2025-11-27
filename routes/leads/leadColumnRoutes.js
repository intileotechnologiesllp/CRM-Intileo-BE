const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const leadColumnController = require("../../controllers/leads/leadColumnController");
// const validatePrivilege = require("../../middlewares/validatePrivilege");

router.post(
  "/create-column",
  verifyToken,
  leadColumnController.saveLeadColumnPreference
);
router.get(
  "/get-column",
  verifyToken,
  leadColumnController.getLeadColumnPreference
);
router.post(
  "/delete-column",
  verifyToken,
  leadColumnController.deleteLeadColumn
);
router.get(
  "/save-lead-fields",
  verifyToken,
  leadColumnController.saveAllLeadFieldsWithCheck
);
router.post(
  "/check-columns",
  verifyToken,
  leadColumnController.updateLeadColumnChecks
);
router.get("/sync-lead-columns", verifyToken, leadColumnController.syncCustomFieldsWithPreferences);

module.exports = router;
