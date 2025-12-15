-- Create SchedulingLinks table for booking/scheduling link functionality
-- This table stores configuration for public scheduling links (like Pipedrive's scheduling links)

CREATE TABLE IF NOT EXISTS `SchedulingLinks` (
  `linkId` INT NOT NULL AUTO_INCREMENT,
  `masterUserID` INT NOT NULL COMMENT 'Owner of the scheduling link',
  `uniqueToken` VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique token for the booking link',
  `title` VARCHAR(255) NOT NULL DEFAULT 'Schedule a Meeting' COMMENT 'Title displayed on the scheduling page',
  `description` TEXT NULL COMMENT 'Description shown to invitees',
  `durationMinutes` INT NOT NULL DEFAULT 30 COMMENT 'Duration of meetings in minutes',
  `timezone` VARCHAR(100) NOT NULL DEFAULT 'UTC' COMMENT 'Timezone for displaying available slots',
  `bufferTimeBefore` INT NOT NULL DEFAULT 0 COMMENT 'Buffer time in minutes before each meeting',
  `bufferTimeAfter` INT NOT NULL DEFAULT 0 COMMENT 'Buffer time in minutes after each meeting',
  `advanceBookingDays` INT NOT NULL DEFAULT 30 COMMENT 'How many days in advance can meetings be booked',
  `workingHours` TEXT NULL COMMENT 'JSON string of working hours per day of week',
  `meetingLocation` VARCHAR(500) NULL COMMENT 'Default location for meetings',
  `requireEmail` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether email is required to book',
  `requireName` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether name is required to book',
  `requirePhone` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether phone is required to book',
  `customFields` TEXT NULL COMMENT 'JSON array of custom fields to collect',
  `autoConfirm` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Automatically confirm bookings',
  `sendReminderEmail` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Send reminder email before meeting',
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether the scheduling link is active',
  `bookingCount` INT NOT NULL DEFAULT 0 COMMENT 'Number of meetings booked through this link',
  `lastUsedAt` DATETIME NULL COMMENT 'When this link was last used',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`linkId`),
  UNIQUE KEY `unique_token` (`uniqueToken`),
  KEY `idx_masterUserID` (`masterUserID`),
  KEY `idx_isActive` (`isActive`),
  CONSTRAINT `fk_scheduling_link_owner` FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Scheduling links for public meeting booking';

