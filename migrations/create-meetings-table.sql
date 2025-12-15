-- Create Meetings table for meeting scheduling functionality
-- This table extends Activities with meeting-specific fields like timezone, status, recurrence, etc.

CREATE TABLE IF NOT EXISTS `Meetings` (
  `meetingId` INT NOT NULL AUTO_INCREMENT,
  `activityId` INT NOT NULL,
  `timezone` VARCHAR(100) NOT NULL DEFAULT 'UTC' COMMENT 'Timezone for the meeting (e.g., America/New_York, Asia/Kolkata)',
  `meetingStatus` ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show') NOT NULL DEFAULT 'scheduled' COMMENT 'Current status of the meeting',
  `recurrenceRule` TEXT NULL COMMENT 'iCal RRULE format string for recurring meetings',
  `recurrenceEndDate` DATETIME NULL COMMENT 'End date for recurring meetings',
  `reminderMinutes` TEXT NULL COMMENT 'JSON array of reminder times in minutes before meeting',
  `meetingUrl` VARCHAR(500) NULL COMMENT 'URL for video conference (Zoom, Teams, Google Meet, etc.)',
  `organizerEmail` VARCHAR(255) NOT NULL COMMENT 'Email of the meeting organizer',
  `organizerName` VARCHAR(255) NOT NULL COMMENT 'Name of the meeting organizer',
  `icsUid` VARCHAR(255) NULL UNIQUE COMMENT 'Unique identifier for calendar invite (ICS UID)',
  `sendInvites` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether to send email invites to attendees',
  `lastSentAt` DATETIME NULL COMMENT 'When invites were last sent',
  `cancelledAt` DATETIME NULL COMMENT 'When the meeting was cancelled',
  `cancelledBy` INT NULL COMMENT 'User who cancelled the meeting',
  `cancellationReason` TEXT NULL COMMENT 'Reason for cancellation',
  `externalAttendees` TEXT NULL COMMENT 'JSON array of external attendees not in CRM',
  `meetingNotes` TEXT NULL COMMENT 'Post-meeting notes and follow-ups',
  `followUpRequired` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether a follow-up is required',
  `masterUserID` INT NOT NULL COMMENT 'Owner of the meeting',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`meetingId`),
  UNIQUE KEY `unique_activityId` (`activityId`),
  KEY `idx_meetingStatus` (`meetingStatus`),
  KEY `idx_masterUserID` (`masterUserID`),
  KEY `idx_icsUid` (`icsUid`),
  CONSTRAINT `fk_meeting_activity` FOREIGN KEY (`activityId`) REFERENCES `Activities` (`activityId`) ON DELETE CASCADE,
  CONSTRAINT `fk_meeting_owner` FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) ON DELETE CASCADE,
  CONSTRAINT `fk_meeting_cancelledBy` FOREIGN KEY (`cancelledBy`) REFERENCES `masterusers` (`masterUserID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Meeting scheduling data extending Activities table';

