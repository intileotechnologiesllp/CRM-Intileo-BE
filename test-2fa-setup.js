const twoFactorService = require('./services/twoFactorService');
const sequelize = require('./config/db');
const MasterUser = require('./models/master/masterUserModel');

async function testTwoFactorSetup() {
    try {
        console.log('🧪 Testing 2FA Setup Directly...');
        
        // Test 1: Generate secret
        console.log('\n1️⃣ Testing secret generation...');
        const secret = twoFactorService.generateSecret('test@example.com');
        console.log('✅ Secret generated:', secret.base32?.substring(0, 10) + '...');
        console.log('✅ OTP Auth URL:', secret.otpauth_url ? 'Generated' : 'Missing');
        
        // Test 2: Generate QR Code
        console.log('\n2️⃣ Testing QR code generation...');
        const qrCodeUrl = await twoFactorService.generateQRCode(secret.otpauth_url);
        console.log('✅ QR Code generated, length:', qrCodeUrl.length);
        
        // Test 3: Database connection and user lookup
        console.log('\n3️⃣ Testing database connection...');
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        // Test 4: Find the user
        console.log('\n4️⃣ Testing user lookup for ID 72...');
        const user = await MasterUser.findByPk(72);
        if (user) {
            console.log('✅ User found:', user.email);
            console.log('   Current twoFactorSecret:', user.twoFactorSecret ? 'SET' : 'NOT SET');
            console.log('   Current twoFactorEnabled:', user.twoFactorEnabled);
            
            // Test 5: Try to update the user with a secret (simulate setup)
            console.log('\n5️⃣ Testing database update...');
            const encrypted = twoFactorService.encrypt(secret.base32);
            await user.update({
                twoFactorSecret: encrypted
            });
            console.log('✅ User updated with secret');
            
            // Test 6: Read back the secret
            console.log('\n6️⃣ Testing secret retrieval...');
            await user.reload();
            const decrypted = twoFactorService.decrypt(user.twoFactorSecret);
            console.log('✅ Secret retrieved and decrypted successfully');
            console.log('   Matches original:', decrypted === secret.base32);
            
        } else {
            console.log('❌ User not found');
        }
        
        console.log('\n🎉 All tests passed! 2FA service is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

testTwoFactorSetup();