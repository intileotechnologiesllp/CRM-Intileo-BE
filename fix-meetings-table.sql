-- Fix Meetings table creation - Check and create with correct foreign key references
-- This script will check your actual table names and create the Meetings table accordingly

-- First, let's check what tables exist and their exact names
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('Activities', 'activities', 'MasterUsers', 'masterusers', 'masterUsers');

-- Drop the Meetings table if it exists (to recreate with correct constraints)
DROP TABLE IF EXISTS `Meetings`;

-- Create Meetings table with corrected foreign key references
-- Note: Adjust table names based on your actual database schema
CREATE TABLE `Meetings` (
  `meetingId` INT NOT NULL AUTO_INCREMENT,
  `activityId` INT NOT NULL,
  `timezone` VARCHAR(100) NOT NULL DEFAULT 'UTC' COMMENT 'Timezone for the meeting',
  `meetingStatus` ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show') NOT NULL DEFAULT 'scheduled',
  `recurrenceRule` TEXT NULL COMMENT 'iCal RRULE format for recurring meetings',
  `recurrenceEndDate` DATETIME NULL,
  `reminderMinutes` TEXT NULL COMMENT 'JSON array of reminder times',
  `meetingUrl` VARCHAR(500) NULL COMMENT 'Video conference URL',
  `organizerEmail` VARCHAR(255) NOT NULL,
  `organizerName` VARCHAR(255) NOT NULL,
  `icsUid` VARCHAR(255) NULL UNIQUE COMMENT 'Calendar invite UID',
  `sendInvites` BOOLEAN NOT NULL DEFAULT TRUE,
  `lastSentAt` DATETIME NULL,
  `cancelledAt` DATETIME NULL,
  `cancelledBy` INT NULL,
  `cancellationReason` TEXT NULL,
  `externalAttendees` TEXT NULL COMMENT 'JSON array of external attendees',
  `meetingNotes` TEXT NULL,
  `followUpRequired` BOOLEAN NOT NULL DEFAULT FALSE,
  `masterUserID` INT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`meetingId`),
  UNIQUE KEY `unique_activityId` (`activityId`),
  KEY `idx_meetingStatus` (`meetingStatus`),
  KEY `idx_masterUserID` (`masterUserID`),
  KEY `idx_icsUid` (`icsUid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Meeting scheduling data';

-- Note: Foreign key constraints will be added separately after verifying table names