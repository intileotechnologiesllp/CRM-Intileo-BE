const express = require("express");
const router = express.Router();
const twoFactorController = require("../../controllers/auth/twoFactorController");
const twoFactorLoginController = require("../../controllers/auth/twoFactorLoginController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { twoFactorRateLimiter, twoFactorSetupRateLimiter } = require("../../middlewares/twoFactorMiddleware");

// Setup and management routes (require authentication)
router.post("/setup", verifyToken, twoFactorSetupRateLimiter,twoFactorController.setup2FA);
router.post("/verify-setup", verifyToken, twoFactorRateLimiter,twoFactorController.verifyAndEnable2FA);
router.post("/disable", verifyToken, twoFactorController.disable2FA);
router.get("/status", verifyToken, twoFactorController.get2FAStatus);

// Backup codes management
router.post("/regenerate-backup-codes", verifyToken, twoFactorController.regenerateBackupCodes);
router.get("/backup-codes-info", verifyToken, twoFactorController.getBackupCodesInfo);

// Login verification (no auth required - happens during login)
router.post("/verify-login", twoFactorRateLimiter, twoFactorLoginController.verify2FALogin);

module.exports = router;
