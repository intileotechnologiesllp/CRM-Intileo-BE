const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const leadColumnController = require("../../controllers/leads/leadColumnController");
const validatePrivilege = require("../../middlewares/validatePrivilege");

router.post(
  "/create-column",
  verifyToken,
  validatePrivilege(2, "create"),
  leadColumnController.saveLeadColumnPreference
);
router.get(
  "/get-column",
  verifyToken,
  validatePrivilege(2, "view"),
  leadColumnController.getLeadColumnPreference
);
router.post(
  "/delete-column",
  verifyToken,
  validatePrivilege(2, "delete"),
  leadColumnController.deleteLeadColumn
);
router.get(
  "/save-lead-fields",
  verifyToken,
  validatePrivilege(2, "view"),
  leadColumnController.saveAllLeadFieldsWithCheck
);
router.post(
  "/check-columns",
  verifyToken,
  validatePrivilege(2, "create"),
  leadColumnController.updateLeadColumnChecks
);
router.get("/sync-lead-columns", verifyToken, leadColumnController.syncCustomFieldsWithPreferences);

module.exports = router;
