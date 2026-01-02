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
  const { MasterUser, AuditTrail, History } = req.models;
  console.log(`🚀 [2FA Setup] FUNCTION ENTRY - setup2FA called`);
  console.log(`🚀 [2FA Setup] Request method: ${req.method}`);
  console.log(`🚀 [2FA Setup] Request path: ${req.path}`);
  console.log(`🚀 [2FA Setup] Request headers: ${JSON.stringify(req.headers)}`);
  
  try {
    const userId = req.adminId; // From JWT token middleware
    console.log(`🔍 [2FA Setup] Starting 2FA setup for userId: ${userId}`);
    
    const user = await MasterUser.findByPk(userId);
    if (!user) {
      console.log(`❌ [2FA Setup] User not found for ID: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`✅ [2FA Setup] User found - Email: ${user.email}, ID: ${user.masterUserID}`);
    console.log(`🔍 [2FA Setup] Current 2FA status - Enabled: ${user.twoFactorEnabled}, HasSecret: ${!!user.twoFactorSecret}`);

    // If already enabled, return error
    if (user.twoFactorEnabled) {
      console.log(`❌ [2FA Setup] 2FA already enabled for user ${userId}`);
      return res.status(400).json({ 
        message: "2FA is already enabled for this account",
        enabled: true
      });
    }

    console.log(`🔍 [2FA Setup] Generating new TOTP secret...`);
    // Generate new secret
    const { secret, otpauth_url } = twoFactorService.generateSecret(
      user.email,
      "PipedriveCRM"
    );
    console.log(`✅ [2FA Setup] Secret generated - Length: ${secret.length}`);

    console.log(`🔍 [2FA Setup] Generating QR code...`);
    // Generate QR code
    const qrCodeDataUrl = await twoFactorService.generateQRCode(otpauth_url);
    console.log(`✅ [2FA Setup] QR code generated - Length: ${qrCodeDataUrl.length}`);

    console.log(`🔍 [2FA Setup] Encrypting secret for storage...`);
    // Store encrypted secret temporarily (not enabled yet)
    const encryptedSecret = twoFactorService.encrypt(secret);
    console.log(`✅ [2FA Setup] Secret encrypted - Length: ${encryptedSecret.length}`);
    
    console.log(`🔍 [2FA Setup] Saving encrypted secret to database...`);
    user.twoFactorSecret = encryptedSecret;
    await user.save();
    console.log(`✅ [2FA Setup] Secret saved successfully to user record`);

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.AUTHENTICATION,
      "2FA_SETUP_INITIATED",
      "User initiated 2FA setup",
      userId
    );

    console.log(`✅ [2FA Setup] Setup completed successfully for user ${userId}`);
    res.status(200).json({
      message: "Scan this QR code with your authenticator app",
      qrCode: qrCodeDataUrl,
      secret: secret, // Send once for manual entry
      otpauth_url: otpauth_url,
    });
  } catch (error) {
    console.error("❌ [2FA Setup] Error during 2FA setup:", error);
    console.error("❌ [2FA Setup] Error stack:", error.stack);
    console.error("❌ [2FA Setup] Setup failed for userId:", req.adminId);
    res.status(500).json({ message: "Failed to setup 2FA", error: error.message });
  }
};

/**
 * Verify and enable 2FA
 * POST /api/auth/2fa/verify-setup
 * Body: { token: "123456" }
 */
exports.verifyAndEnable2FA = async (req, res) => {
  const { MasterUser, AuditTrail, History } = req.models;
  try {
    const userId = req.adminId;
    const { token } = req.body;

    console.log(`🔍 [2FA Verify] Starting verification for userId: ${userId}`);
    console.log(`🔍 [2FA Verify] Token received: ${token ? `${token.substring(0,2)}****` : 'null/undefined'}`);

    if (!token || token.length !== 6) {
      console.log(`❌ [2FA Verify] Invalid token format - Length: ${token?.length || 0}, Value: ${token || 'null'}`);
      return res.status(400).json({ message: "Invalid token format" });
    }

    console.log(`🔍 [2FA Verify] Looking up user with ID: ${userId}`);
    const user = await MasterUser.findByPk(userId);
    
    if (!user) {
      console.log(`❌ [2FA Verify] User not found in database for ID: ${userId}`);
      return res.status(400).json({ message: "2FA setup not initiated" });
    }

    console.log(`✅ [2FA Verify] User found - Email: ${user.email}, ID: ${user.masterUserID}`);
    console.log(`🔍 [2FA Verify] Checking twoFactorSecret...`);
    console.log(`🔍 [2FA Verify] twoFactorSecret exists: ${!!user.twoFactorSecret}`);
    console.log(`🔍 [2FA Verify] twoFactorSecret length: ${user.twoFactorSecret?.length || 0}`);
    console.log(`🔍 [2FA Verify] twoFactorEnabled: ${user.twoFactorEnabled}`);

    if (!user.twoFactorSecret) {
      console.log(`❌ [2FA Verify] No twoFactorSecret found - setup was not completed properly`);
      console.log(`💡 [2FA Verify] Possible causes:`);
      console.log(`   - /setup endpoint was never called successfully`);
      console.log(`   - /setup endpoint failed to save the secret`);
      console.log(`   - Different user JWT was used for setup vs verify`);
      console.log(`   - Database transaction rollback occurred`);
      return res.status(400).json({ message: "2FA setup not initiated" });
    }

    console.log(`🔍 [2FA Verify] Attempting to verify token with secret...`);
    // Verify the token
    const isValid = twoFactorService.verifyToken(token, user.twoFactorSecret);
    console.log(`🔍 [2FA Verify] Token verification result: ${isValid}`);
    
    if (!isValid) {
      console.log(`❌ [2FA Verify] Token verification failed for user ${userId}`);
      console.log(`💡 [2FA Verify] Possible causes:`);
      console.log(`   - Incorrect token entered`);
      console.log(`   - Time synchronization issue`);
      console.log(`   - Secret decryption failed`);
      console.log(`   - Token already used (replay attack protection)`);
      
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.AUTHENTICATION,
        "2FA_VERIFICATION_FAILED",
        "Invalid token provided during setup",
        userId
      );
      return res.status(401).json({ message: "Invalid token. Please try again." });
    }

    console.log(`✅ [2FA Verify] Token verification successful - proceeding with 2FA enablement`);
    
    // Generate backup codes
    console.log(`🔍 [2FA Verify] Generating backup codes...`);
    const backupCodes = twoFactorService.generateBackupCodes();
    const encryptedBackupCodes = twoFactorService.prepareBackupCodesForStorage(backupCodes);
    console.log(`✅ [2FA Verify] Generated ${backupCodes.length} backup codes`);

    // Enable 2FA
    console.log(`🔍 [2FA Verify] Updating user record to enable 2FA...`);
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = encryptedBackupCodes;
    user.twoFactorEnabledAt = new Date();
    await user.save();
    console.log(`✅ [2FA Verify] 2FA enabled successfully for user ${userId}`);

    await logAuditTrail(
      AuditTrail,
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
    console.error("❌ [2FA Verify] Unexpected error during 2FA verification:", error);
    console.error("❌ [2FA Verify] Error stack:", error.stack);
    console.error("❌ [2FA Verify] Error details:", {
      userId: req.adminId,
      tokenProvided: !!req.body?.token,
      tokenLength: req.body?.token?.length || 0,
      errorMessage: error.message
    });
    res.status(500).json({ message: "Failed to enable 2FA", error: error.message });
  }
};

/**
 * Disable 2FA
 * POST /api/auth/2fa/disable
 * Body: { password: "current_password" }
 */
exports.disable2FA = async (req, res) => {
  const { MasterUser, AuditTrail, History } = req.models;
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
        AuditTrail,
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
      AuditTrail,
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
  const { MasterUser, AuditTrail, History, CompanySetting } = req.models;
  try {
    const userId = req.adminId;
    
    const user = await MasterUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const companySettings = await CompanySetting.findOne();
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
  const { MasterUser, AuditTrail, History } = req.models;
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
        AuditTrail,
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
      AuditTrail,
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
  const { MasterUser, AuditTrail, History } = req.models;
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
