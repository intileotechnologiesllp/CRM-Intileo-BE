const express = require("express");
const router = express.Router();
const twoFactorController = require("../../controllers/auth/twoFactorController");
const twoFactorLoginController = require("../../controllers/auth/twoFactorLoginController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { twoFactorRateLimiter, twoFactorSetupRateLimiter } = require("../../middlewares/twoFactorMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");


// Setup and management routes (require authentication)
router.post("/setup", verifyToken, dbContextMiddleware, twoFactorSetupRateLimiter,twoFactorController.setup2FA);
router.post("/verify-setup", verifyToken, dbContextMiddleware, twoFactorRateLimiter,twoFactorController.verifyAndEnable2FA);
router.post("/disable", verifyToken, dbContextMiddleware, twoFactorController.disable2FA);
router.get("/status", verifyToken, dbContextMiddleware, twoFactorController.get2FAStatus);

// Backup codes management
router.post("/regenerate-backup-codes", verifyToken, dbContextMiddleware, twoFactorController.regenerateBackupCodes);
router.get("/backup-codes-info", verifyToken, dbContextMiddleware, twoFactorController.getBackupCodesInfo);

// Login verification (no auth required - happens during login)
router.post("/verify-login", twoFactorRateLimiter, twoFactorLoginController.verify2FALogin);

module.exports = router;
