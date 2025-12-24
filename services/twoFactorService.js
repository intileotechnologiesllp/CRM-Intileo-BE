const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");

// Encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY || 
  crypto.scryptSync(process.env.JWT_SECRET || "default-secret", "salt", 32);
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (secrets, backup codes)
 */
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypt sensitive data
 */
function decrypt(text) {
  try {
    const parts = text.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}

/**
 * Generate a new TOTP secret for a user
 */
function generateSecret(userEmail, companyName = "PipedriveCRM") {
  const secret = speakeasy.generateSecret({
    name: `${companyName} (${userEmail})`,
    length: 32,
  });

  return {
    base32: secret.base32,
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
}

/**
 * Generate QR code as Data URL
 */
async function generateQRCode(otpauthUrl) {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw new Error("Failed to generate QR code");
  }
}

/**
 * Verify TOTP token
 * @param {string} token - 6-digit code from authenticator app
 * @param {string} encryptedSecret - Encrypted secret from database
 * @param {number} window - Time window for validation (default: 1 = ±30 seconds)
 */
function verifyToken(token, encryptedSecret, window = 1) {
  const secret = decrypt(encryptedSecret);
  if (!secret) {
    return false;
  }

  return speakeasy.totp.verify({
    secret: secret,
    encoding: "base32",
    token: token,
    window: window, // Allows for time drift
  });
}

/**
 * Generate 10 backup codes
 */
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash a backup code for storage
 */
function hashBackupCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Verify a backup code against stored hashed codes
 * @returns {object} { valid: boolean, remainingCodes: array }
 */
function verifyBackupCode(code, encryptedBackupCodes) {
  try {
    const decrypted = decrypt(encryptedBackupCodes);
    if (!decrypted) {
      return { valid: false, remainingCodes: [] };
    }

    const backupCodes = JSON.parse(decrypted);
    const hashedCode = hashBackupCode(code.toUpperCase());

    const index = backupCodes.findIndex((storedCode) => storedCode === hashedCode);

    if (index === -1) {
      return { valid: false, remainingCodes: backupCodes };
    }

    // Remove used code
    backupCodes.splice(index, 1);

    return {
      valid: true,
      remainingCodes: backupCodes,
    };
  } catch (error) {
    console.error("Backup code verification error:", error);
    return { valid: false, remainingCodes: [] };
  }
}

/**
 * Prepare backup codes for storage (hash and encrypt)
 */
function prepareBackupCodesForStorage(codes) {
  const hashedCodes = codes.map((code) => hashBackupCode(code));
  const encrypted = encrypt(JSON.stringify(hashedCodes));
  return encrypted;
}

/**
 * Get count of remaining backup codes
 */
function getRemainingBackupCodesCount(encryptedBackupCodes) {
  try {
    if (!encryptedBackupCodes) return 0;
    const decrypted = decrypt(encryptedBackupCodes);
    if (!decrypted) return 0;
    const codes = JSON.parse(decrypted);
    return codes.length;
  } catch (error) {
    return 0;
  }
}

module.exports = {
  encrypt,
  decrypt,
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  prepareBackupCodesForStorage,
  getRemainingBackupCodesCount,
};
