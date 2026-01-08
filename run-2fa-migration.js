#!/usr/bin/env node

/**
 * Run 2FA migration to add required columns to MasterUsers table
 */

require('dotenv').config();
const sequelize = require('./config/db');

async function runMigration() {
  console.log('🚀 Starting 2FA database migration...');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Import and run the migration
    const migration = require('./migrations/add-two-factor-authentication-columns.js');
    
    // Run the migration
    await migration.up(sequelize.getQueryInterface(), sequelize);
    
    console.log('🎉 Migration completed successfully!');
    console.log('📋 The following columns have been added to MasterUsers table:');
    console.log('   • twoFactorEnabled (BOOLEAN, default: false)');
    console.log('   • twoFactorSecret (TEXT, nullable)');  
    console.log('   • twoFactorBackupCodes (TEXT, nullable)');
    console.log('   • twoFactorEnabledAt (DATE, nullable)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('❌ Error details:', error.message);
    
    if (error.message.includes('column already exists')) {
      console.log('💡 It looks like the 2FA columns already exist in your database.');
      console.log('💡 You can proceed with testing the 2FA functionality.');
    }
  } finally {
    await sequelize.close();
    console.log('📝 Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };