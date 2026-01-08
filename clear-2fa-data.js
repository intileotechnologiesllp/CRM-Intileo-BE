// Load environment variables first
require('dotenv').config();

const sequelize = require('./config/db');
const MasterUser = require('./models/master/masterUserModel');

async function clearAndTestFlow() {
    try {
        console.log('🧹 Clearing old 2FA data and testing fresh flow...');
        
        await sequelize.authenticate();
        console.log('✅ Database connected');
        
        const user = await MasterUser.findByPk(72);
        if (user) {
            console.log(`✅ User found: ${user.email}`);
            
            // Clear old 2FA data
            console.log('🧹 Clearing existing 2FA data...');
            await user.update({
                twoFactorSecret: null,
                twoFactorEnabled: false,
                twoFactorBackupCodes: null,
                twoFactorEnabledAt: null
            });
            console.log('✅ Old 2FA data cleared');
            
            // Verify it's cleared
            await user.reload();
            console.log(`🔍 After clear - Secret exists: ${!!user.twoFactorSecret}`);
            console.log(`🔍 After clear - 2FA enabled: ${user.twoFactorEnabled}`);
            
            console.log('\n🎯 User is now ready for fresh 2FA setup!');
            console.log('💡 Next steps:');
            console.log('   1. Call POST /api/auth/2fa/setup');
            console.log('   2. Scan QR code with authenticator app');  
            console.log('   3. Call POST /api/auth/2fa/verify-setup with 6-digit code');
            
        } else {
            console.log('❌ User not found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

clearAndTestFlow();