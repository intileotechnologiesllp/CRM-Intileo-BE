const express = require("express");
const router = express.Router();
const twoFactorController = require("../../controllers/auth/twoFactorController");
const twoFactorLoginController = require("../../controllers/auth/twoFactorLoginController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { twoFactorRateLimiter, twoFactorSetupRateLimiter } = require("../../middlewares/twoFactorMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");


// Setup and management routes (require authentication)
router.post("/setup", dbContextMiddleware, verifyToken, twoFactorSetupRateLimiter,twoFactorController.setup2FA);
router.post("/verify-setup", dbContextMiddleware, verifyToken, twoFactorRateLimiter,twoFactorController.verifyAndEnable2FA);
router.post("/disable", dbContextMiddleware,  verifyToken, twoFactorController.disable2FA);
router.get("/status", dbContextMiddleware, verifyToken, twoFactorController.get2FAStatus);

// Backup codes management
router.post("/regenerate-backup-codes", dbContextMiddleware, verifyToken, twoFactorController.regenerateBackupCodes);
router.get("/backup-codes-info", dbContextMiddleware, verifyToken, twoFactorController.getBackupCodesInfo);

// Login verification (no auth required - happens during login)
router.post("/verify-login", twoFactorRateLimiter, twoFactorLoginController.verify2FALogin);

module.exports = router;
