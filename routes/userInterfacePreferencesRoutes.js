const express = require("express");
const router = express.Router();
const userInterfacePreferencesController = require("../controllers/userInterfacePreferencesController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Get user interface preferences
router.get(
  "/get",
  verifyToken,
  userInterfacePreferencesController.getInterfacePreferences
);

// Update user interface preferences
router.post(
  "/update",
  verifyToken,
  userInterfacePreferencesController.updateInterfacePreferences
);

// Reset user interface preferences to default
router.post(
  "/reset",
  verifyToken,
  userInterfacePreferencesController.resetInterfacePreferences
);

module.exports = router;
