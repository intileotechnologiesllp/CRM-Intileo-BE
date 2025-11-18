const express = require("express");
const router = express.Router();
const contactSyncController = require("../../controllers/contact/contactSyncController");
const { verifyToken } = require("../../middlewares/authMiddleware");

// OAuth routes
router.get(
  "/oauth/google/authorize",
  verifyToken,
  contactSyncController.getGoogleAuthUrl
);
// Callback doesn't need auth - user ID comes from OAuth state parameter
router.get(
  "/oauth/google/callback",
  contactSyncController.handleGoogleCallback
);

// Sync configuration routes
router.get("/config", verifyToken, contactSyncController.getSyncConfig);
router.post(
  "/config",
  verifyToken,
  contactSyncController.createOrUpdateSyncConfig
);
router.put(
  "/config",
  verifyToken,
  contactSyncController.createOrUpdateSyncConfig
);
router.delete(
  "/config/disconnect",
  verifyToken,
  contactSyncController.disconnectGoogle
);

// Sync operations
router.post("/start", verifyToken, contactSyncController.startSync);
router.get("/stats", verifyToken, contactSyncController.getSyncStats);

// Sync history routes
router.get("/history", verifyToken, contactSyncController.getSyncHistory);
router.get(
  "/history/:syncHistoryId",
  verifyToken,
  contactSyncController.getSyncHistoryDetails
);

// Change logs routes
router.get(
  "/history/:syncHistoryId/changes",
  verifyToken,
  contactSyncController.getChangeLogs
);
router.get(
  "/contact/:personId/changes",
  verifyToken,
  contactSyncController.getContactChangeLogs
);

module.exports = router;
