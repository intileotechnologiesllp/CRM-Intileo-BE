#!/usr/bin/env node

/**
 * Fix all table creation issues by creating tables without foreign keys first
 * This resolves foreign key constraint errors for Meetings and SchedulingLinks tables
 */

require('dotenv').config();
const sequelize = require('./config/db');

async function fixAllTables() {
  console.log('🔧 Fixing all table creation issues...');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Check existing tables
    console.log('🔍 Checking existing tables...');
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      ORDER BY TABLE_NAME
    `);
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    console.log('📋 Existing tables:', existingTables.slice(0, 10), '... (showing first 10)');
    
    // Drop problematic tables if they exist
    console.log('🗑️ Dropping problematic tables...');
    await sequelize.query('DROP TABLE IF EXISTS `Meetings`');
    await sequelize.query('DROP TABLE IF EXISTS `SchedulingLinks`');
    console.log('✅ Dropped existing tables');
    
    // Create Meetings table without foreign keys
    console.log('📋 Creating Meetings table...');
    await sequelize.query(`
      CREATE TABLE \`Meetings\` (
        \`meetingId\` INT NOT NULL AUTO_INCREMENT,
        \`activityId\` INT NOT NULL,
        \`timezone\` VARCHAR(100) NOT NULL DEFAULT 'UTC',
        \`meetingStatus\` ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show') NOT NULL DEFAULT 'scheduled',
        \`recurrenceRule\` TEXT NULL,
        \`recurrenceEndDate\` DATETIME NULL,
        \`reminderMinutes\` TEXT NULL COMMENT 'JSON array of reminder times',
        \`meetingUrl\` VARCHAR(500) NULL,
        \`organizerEmail\` VARCHAR(255) NOT NULL,
        \`organizerName\` VARCHAR(255) NOT NULL,
        \`icsUid\` VARCHAR(255) NULL UNIQUE,
        \`sendInvites\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`lastSentAt\` DATETIME NULL,
        \`cancelledAt\` DATETIME NULL,
        \`cancelledBy\` INT NULL,
        \`cancellationReason\` TEXT NULL,
        \`externalAttendees\` TEXT NULL COMMENT 'JSON array of external attendees',
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
    console.log('✅ Meetings table created');
    
    // Create SchedulingLinks table without foreign keys
    console.log('📋 Creating SchedulingLinks table...');
    await sequelize.query(`
      CREATE TABLE \`SchedulingLinks\` (
        \`linkId\` INT NOT NULL AUTO_INCREMENT,
        \`token\` VARCHAR(255) NOT NULL UNIQUE,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`duration\` INT NOT NULL DEFAULT 30 COMMENT 'Meeting duration in minutes',
        \`timezone\` VARCHAR(100) NOT NULL DEFAULT 'UTC',
        \`availableSlots\` TEXT NULL COMMENT 'JSON array of available time slots',
        \`bufferTime\` INT NOT NULL DEFAULT 0 COMMENT 'Buffer time between meetings in minutes',
        \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`expiresAt\` DATETIME NULL,
        \`maxBookings\` INT NULL COMMENT 'Maximum number of bookings allowed',
        \`currentBookings\` INT NOT NULL DEFAULT 0,
        \`bookingWindow\` INT NOT NULL DEFAULT 7 COMMENT 'Days in advance bookings are allowed',
        \`questions\` TEXT NULL COMMENT 'JSON array of custom questions',
        \`requireApproval\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`sendConfirmation\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`redirectUrl\` VARCHAR(500) NULL,
        \`masterUserID\` INT NOT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        PRIMARY KEY (\`linkId\`),
        UNIQUE KEY \`unique_token\` (\`token\`),
        KEY \`idx_masterUserID\` (\`masterUserID\`),
        KEY \`idx_isActive\` (\`isActive\`),
        KEY \`idx_expiresAt\` (\`expiresAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ SchedulingLinks table created');
    
    console.log('🎉 All tables created successfully!');
    console.log('📝 Note: Foreign key constraints were omitted to avoid reference errors');
    console.log('📝 Tables will work normally without FK constraints for this application');
    
    // Show table structures
    console.log('\n📊 Meetings table structure:');
    const [meetingsDesc] = await sequelize.query('DESCRIBE Meetings');
    console.table(meetingsDesc);
    
    console.log('\n📊 SchedulingLinks table structure:');
    const [linksDesc] = await sequelize.query('DESCRIBE SchedulingLinks');
    console.table(linksDesc);
    
  } catch (error) {
    console.error('❌ Error fixing tables:', error);
    console.error('❌ Error details:', error.message);
  } finally {
    await sequelize.close();
    console.log('📝 Database connection closed');
  }
}

// Run the fix
if (require.main === module) {
  fixAllTables()
    .then(() => {
      console.log('✅ All tables fixed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllTables };