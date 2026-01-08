// Load environment variables first
require('dotenv').config();

const sequelize = require('./config/db');
const MasterUser = require('./models/master/masterUserModel');

async function checkUserSecret() {
    try {
        console.log('🔍 Checking user 2FA status in database...');
        
        await sequelize.authenticate();
        console.log('✅ Database connected');
        
        const user = await MasterUser.findByPk(72);
        if (user) {
            console.log(`✅ User found: ${user.email}`);
            console.log(`🔍 twoFactorSecret exists: ${!!user.twoFactorSecret}`);
            console.log(`🔍 twoFactorSecret length: ${user.twoFactorSecret?.length || 0}`);
            console.log(`🔍 twoFactorEnabled: ${user.twoFactorEnabled}`);
            console.log(`🔍 twoFactorEnabledAt: ${user.twoFactorEnabledAt}`);
            console.log(`🔍 twoFactorBackupCodes: ${!!user.twoFactorBackupCodes}`);
            
            if (user.twoFactorSecret) {
                console.log('✅ Secret is present in database');
                // Try to decrypt it to verify it's valid
                const twoFactorService = require('./services/twoFactorService');
                const decrypted = twoFactorService.decrypt(user.twoFactorSecret);
                console.log(`✅ Secret decryption: ${decrypted ? 'SUCCESS' : 'FAILED'}`);
                console.log(`🔍 Decrypted secret length: ${decrypted?.length || 0}`);
            } else {
                console.log('❌ No secret found in database');
                console.log('💡 This explains why verify-setup fails');
            }
        } else {
            console.log('❌ User not found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

checkUserSecret();