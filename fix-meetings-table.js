#!/usr/bin/env node

/**
 * Fix Meetings table creation by checking actual table names and creating with correct foreign keys
 */

require('dotenv').config();
const sequelize = require('./config/db');

async function fixMeetingsTable() {
  console.log('🔧 Fixing Meetings table creation...');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Check what tables exist and their exact names
    console.log('🔍 Checking existing table names...');
    const [results] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME REGEXP '^(Activities|activities|MasterUsers|masterusers|masterUsers)$'
    `);
    
    console.log('📋 Found tables:', results.map(r => r.TABLE_NAME));
    
    // Determine correct table names
    const activitiesTable = results.find(r => 
      r.TABLE_NAME.toLowerCase().includes('activit')
    )?.TABLE_NAME;
    
    const usersTable = results.find(r => 
      r.TABLE_NAME.toLowerCase().includes('master') && r.TABLE_NAME.toLowerCase().includes('user')
    )?.TABLE_NAME;
    
    console.log(`🎯 Activities table: ${activitiesTable || 'NOT FOUND'}`);
    console.log(`🎯 Users table: ${usersTable || 'NOT FOUND'}`);
    
    // Drop existing Meetings table if it exists
    console.log('🗑️ Dropping existing Meetings table if it exists...');
    await sequelize.query('DROP TABLE IF EXISTS `Meetings`');
    
    // Create Meetings table without foreign keys first
    console.log('📋 Creating Meetings table structure...');
    await sequelize.query(`
      CREATE TABLE \`Meetings\` (
        \`meetingId\` INT NOT NULL AUTO_INCREMENT,
        \`activityId\` INT NOT NULL,
        \`timezone\` VARCHAR(100) NOT NULL DEFAULT 'UTC',
        \`meetingStatus\` ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show') NOT NULL DEFAULT 'scheduled',
        \`recurrenceRule\` TEXT NULL,
        \`recurrenceEndDate\` DATETIME NULL,
        \`reminderMinutes\` TEXT NULL,
        \`meetingUrl\` VARCHAR(500) NULL,
        \`organizerEmail\` VARCHAR(255) NOT NULL,
        \`organizerName\` VARCHAR(255) NOT NULL,
        \`icsUid\` VARCHAR(255) NULL UNIQUE,
        \`sendInvites\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`lastSentAt\` DATETIME NULL,
        \`cancelledAt\` DATETIME NULL,
        \`cancelledBy\` INT NULL,
        \`cancellationReason\` TEXT NULL,
        \`externalAttendees\` TEXT NULL,
        \`meetingNotes\` TEXT NULL,
        \`followUpRequired\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`masterUserID\` INT NOT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        PRIMARY KEY (\`meetingId\`),
        UNIQUE KEY \`unique_activityId\` (\`activityId\`),
        KEY \`idx_meetingStatus\` (\`meetingStatus\`),
        KEY \`idx_masterUserID\` (\`masterUserID\`),
        KEY \`idx_icsUid\` (\`icsUid\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Meetings table created successfully!');
    
    // Add foreign key constraints if referenced tables exist
    if (activitiesTable) {
      console.log(`🔗 Adding foreign key constraint to ${activitiesTable}...`);
      try {
        await sequelize.query(`
          ALTER TABLE \`Meetings\` 
          ADD CONSTRAINT \`fk_meeting_activity\` 
          FOREIGN KEY (\`activityId\`) REFERENCES \`${activitiesTable}\` (\`activityId\`) 
          ON DELETE CASCADE
        `);
        console.log('✅ Activities foreign key added');
      } catch (error) {
        console.log('⚠️ Could not add Activities foreign key:', error.message);
      }
    }
    
    if (usersTable) {
      console.log(`🔗 Adding foreign key constraints to ${usersTable}...`);
      try {
        await sequelize.query(`
          ALTER TABLE \`Meetings\` 
          ADD CONSTRAINT \`fk_meeting_owner\` 
          FOREIGN KEY (\`masterUserID\`) REFERENCES \`${usersTable}\` (\`masterUserID\`) 
          ON DELETE CASCADE
        `);
        console.log('✅ Owner foreign key added');
        
        await sequelize.query(`
          ALTER TABLE \`Meetings\` 
          ADD CONSTRAINT \`fk_meeting_cancelledBy\` 
          FOREIGN KEY (\`cancelledBy\`) REFERENCES \`${usersTable}\` (\`masterUserID\`) 
          ON DELETE SET NULL
        `);
        console.log('✅ CancelledBy foreign key added');
      } catch (error) {
        console.log('⚠️ Could not add user foreign keys:', error.message);
      }
    }
    
    console.log('🎉 Meetings table setup completed!');
    console.log('📊 Table structure:');
    const [tableInfo] = await sequelize.query('DESCRIBE Meetings');
    console.table(tableInfo);
    
  } catch (error) {
    console.error('❌ Error fixing Meetings table:', error);
    console.error('❌ Error details:', error.message);
  } finally {
    await sequelize.close();
    console.log('📝 Database connection closed');
  }
}

// Run the fix
if (require.main === module) {
  fixMeetingsTable()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixMeetingsTable };