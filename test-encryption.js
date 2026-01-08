// Test encryption consistency
const crypto = require("crypto");

console.log('🧪 Testing encryption key consistency...');

// Test 1: Check if JWT_SECRET is available
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('TWO_FACTOR_ENCRYPTION_KEY:', process.env.TWO_FACTOR_ENCRYPTION_KEY ? 'SET' : 'NOT SET');

// Test 2: Generate key the same way as service does
const ENCRYPTION_KEY1 = process.env.TWO_FACTOR_ENCRYPTION_KEY || 
  crypto.scryptSync(process.env.JWT_SECRET || "default-secret", "salt", 32);

// Test 3: Generate again to see if it's the same
const ENCRYPTION_KEY2 = process.env.TWO_FACTOR_ENCRYPTION_KEY || 
  crypto.scryptSync(process.env.JWT_SECRET || "default-secret", "salt", 32);

console.log('Key 1 hex:', ENCRYPTION_KEY1.toString('hex'));
console.log('Key 2 hex:', ENCRYPTION_KEY2.toString('hex'));
console.log('Keys match:', ENCRYPTION_KEY1.equals(ENCRYPTION_KEY2));

// Test 4: Try encrypt/decrypt with same key
const testText = "test-secret-123";
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY1), iv);
let encrypted = cipher.update(testText);
encrypted = Buffer.concat([encrypted, cipher.final()]);
const encryptedString = iv.toString("hex") + ":" + encrypted.toString("hex");

console.log('Encrypted:', encryptedString);

// Try to decrypt
try {
    const parts = encryptedString.split(":");
    const ivDecrypt = Buffer.from(parts.shift(), "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY1), ivDecrypt);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    console.log('Decrypted:', decrypted.toString());
    console.log('Match:', decrypted.toString() === testText);
} catch (error) {
    console.error('Decrypt error:', error.message);
}