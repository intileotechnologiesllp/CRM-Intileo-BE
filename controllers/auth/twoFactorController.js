const MasterUser = require("../../models/master/masterUserModel");
const CompanySettings = require("../../models/company/companySettingsModel");
const bcrypt = require("bcrypt");
const twoFactorService = require("../../services/twoFactorService");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");

/**
 * Setup 2FA - Generate secret and QR code
 * POST /api/auth/2fa/setup
 */
exports.setup2FA = async (req, res) => {
  try {
    const userId = req.adminId; // From JWT token middleware
    
    const user = await MasterUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If already enabled, return error
    if (user.twoFactorEnabled) {
      return res.status(400).json({ 
        message: "2FA is already enabled for this account",
        enabled: true
      });
    }

    // Generate new secret
    const { secret, otpauth_url } = twoFactorService.generateSecret(
      user.email,
      "PipedriveCRM"
    );

    // Generate QR code
    const qrCodeDataUrl = await twoFactorService.generateQRCode(otpauth_url);

    // Store encrypted secret temporarily (not enabled yet)
    const encryptedSecret = twoFactorService.encrypt(secret);
    user.twoFactorSecret = encryptedSecret;
    await user.save();

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "2FA_SETUP_INITIATED",
      "User initiated 2FA setup",
      userId
    );

    res.status(200).json({
      message: "Scan this QR code with your authenticator app",
      qrCode: qrCodeDataUrl,
      secret: secret, // Send once for manual entry
      otpauth_url: otpauth_url,
    });
  } catch (error) {
    console.error("2FA Setup Error:", error);
    res.status(500).json({ message: "Failed to setup 2FA", error: error.message });
  }
};

/**
 * Verify and enable 2FA
 * POST /api/auth/2fa/verify-setup
 * Body: { token: "123456" }
 */
exports.verifyAndEnable2FA = async (req, res) => {
  try {
    const userId = req.adminId;
    const { token } = req.body;

    if (!token || token.length !== 6) {
      return res.status(400).json({ message: "Invalid token format" });
    }

    const user = await MasterUser.findByPk(userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: "2FA setup not initiated" });
    }

    // Verify the token
    const isValid = twoFactorService.verifyToken(token, user.twoFactorSecret);
    
    if (!isValid) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "2FA_VERIFICATION_FAILED",
        "Invalid token provided during setup",
        userId
      );
      return res.status(401).json({ message: "Invalid token. Please try again." });
    }

    // Generate backup codes
    const backupCodes = twoFactorService.generateBackupCodes();
    const encryptedBackupCodes = twoFactorService.prepareBackupCodesForStorage(backupCodes);

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = encryptedBackupCodes;
    user.twoFactorEnabledAt = new Date();
    await user.save();

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "2FA_ENABLED",
      "2FA successfully enabled",
      userId
    );

    res.status(200).json({
      message: "2FA enabled successfully",
      backupCodes: backupCodes,
      warning: "Save these backup codes in a safe place. They won't be shown again.",
    });
  } catch (error) {
    console.error("2FA Verification Error:", error);
    res.status(500).json({ message: "Failed to enable 2FA", error: error.message });
  }
};

/**
 * Disable 2FA
 * POST /api/auth/2fa/disable
 * Body: { password: "current_password" }
 */
exports.disable2FA = async (req, res) => {
  try {
    const userId = req.adminId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required to disable 2FA" });
    }

    const user = await MasterUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "2FA_DISABLE_FAILED",
        "Invalid password provided",
        userId
      );
      return res.status(401).json({ message: "Invalid password" });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = null;
    user.twoFactorEnabledAt = null;
    await user.save();

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "2FA_DISABLED",
      "2FA disabled by user",
      userId
    );

    res.status(200).json({ message: "2FA disabled successfully" });
  } catch (error) {
    console.error("2FA Disable Error:", error);
    res.status(500).json({ message: "Failed to disable 2FA", error: error.message });
  }
};

/**
 * Get 2FA status
 * GET /api/auth/2fa/status
 */
exports.get2FAStatus = async (req, res) => {
  try {
    const userId = req.adminId;
    
    const user = await MasterUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const companySettings = await CompanySettings.findOne();
    const isMandatory = companySettings?.twoFactorMandatory || false;
    const gracePeriodDays = companySettings?.twoFactorGracePeriodDays || 7;

    const remainingBackupCodes = user.twoFactorBackupCodes
      ? twoFactorService.getRemainingBackupCodesCount(user.twoFactorBackupCodes)
      : 0;

    res.status(200).json({
      enabled: user.twoFactorEnabled,
      enabledAt: user.twoFactorEnabledAt,
      remainingBackupCodes: remainingBackupCodes,
      companyMandatory: isMandatory,
      gracePeriodDays: gracePeriodDays,
    });
  } catch (error) {
    console.error("Get 2FA Status Error:", error);
    res.status(500).json({ message: "Failed to get 2FA status", error: error.message });
  }
};

/**
 * Regenerate backup codes
 * POST /api/auth/2fa/regenerate-backup-codes
 * Body: { password: "current_password" }
 */
exports.regenerateBackupCodes = async (req, res) => {
  try {
    const userId = req.adminId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await MasterUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "2FA_BACKUP_REGENERATE_FAILED",
        "Invalid password",
        userId
      );
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate new backup codes
    const backupCodes = twoFactorService.generateBackupCodes();
    const encryptedBackupCodes = twoFactorService.prepareBackupCodesForStorage(backupCodes);

    user.twoFactorBackupCodes = encryptedBackupCodes;
    await user.save();

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "2FA_BACKUP_CODES_REGENERATED",
      "Backup codes regenerated (old codes invalidated)",
      userId
    );

    res.status(200).json({
      message: "Backup codes regenerated successfully",
      backupCodes: backupCodes,
      warning: "Previous backup codes have been invalidated. Save these new codes securely.",
    });
  } catch (error) {
    console.error("Regenerate Backup Codes Error:", error);
    res.status(500).json({ 
      message: "Failed to regenerate backup codes", 
      error: error.message 
    });
  }
};

/**
 * Download backup codes (returns current count only for security)
 * GET /api/auth/2fa/backup-codes-info
 */
exports.getBackupCodesInfo = async (req, res) => {
  try {
    const userId = req.adminId;
    
    const user = await MasterUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled" });
    }

    const remainingCount = twoFactorService.getRemainingBackupCodesCount(
      user.twoFactorBackupCodes
    );

    res.status(200).json({
      remainingCodes: remainingCount,
      message: remainingCount === 0 
        ? "No backup codes remaining. Please regenerate." 
        : `You have ${remainingCount} backup codes remaining.`,
    });
  } catch (error) {
    console.error("Get Backup Codes Info Error:", error);
    res.status(500).json({ 
      message: "Failed to get backup codes info", 
      error: error.message 
    });
  }
};

module.exports = exports;
