-- =============================================
-- Create Notification Tables
-- Run these queries in your MySQL database (crm)
-- =============================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS `Notifications` (
  `notificationId` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL COMMENT 'User who receives this notification',
  `type` ENUM(
    'deal_created', 'deal_updated', 'deal_won', 'deal_lost', 'deal_assigned', 'deal_stage_changed',
    'lead_created', 'lead_updated', 'lead_assigned', 'lead_converted',
    'activity_created', 'activity_assigned', 'activity_completed', 'activity_due', 'activity_overdue',
    'email_received', 'email_sent', 'email_replied',
    'contact_created', 'contact_updated',
    'organization_created', 'organization_updated',
    'mention', 'comment', 'task_assigned',
    'goal_achieved', 'report_generated', 'system'
  ) NOT NULL COMMENT 'Type of notification event',
  `title` VARCHAR(255) NOT NULL COMMENT 'Notification title/heading',
  `message` TEXT NOT NULL COMMENT 'Notification message body',
  `isRead` TINYINT(1) DEFAULT 0 COMMENT 'Whether notification has been read',
  `priority` ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' COMMENT 'Notification priority level',
  `entityType` ENUM('deal', 'lead', 'activity', 'email', 'contact', 'organization', 'goal', 'report', 'system') COMMENT 'Related entity type',
  `entityId` INT COMMENT 'Related entity ID (dealId, leadId, etc.)',
  `actionUrl` VARCHAR(500) COMMENT 'URL to navigate when notification is clicked',
  `actionBy` INT COMMENT 'User who triggered this notification',
  `metadata` JSON COMMENT 'Additional data (e.g., old value, new value, etc.)',
  `readAt` DATETIME COMMENT 'Timestamp when notification was read',
  `expiresAt` DATETIME COMMENT 'Expiration timestamp for auto-deletion',
  `isDeleted` TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag',
  `deletedAt` DATETIME,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT `fk_notification_user` 
    FOREIGN KEY (`userId`) REFERENCES `MasterUsers` (`masterUserID`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  CONSTRAINT `fk_notification_actor` 
    FOREIGN KEY (`actionBy`) REFERENCES `MasterUsers` (`masterUserID`) 
    ON DELETE SET NULL ON UPDATE CASCADE,
  
  -- Indexes
  INDEX `idx_user_read` (`userId`, `isRead`),
  INDEX `idx_user_created` (`userId`, `createdAt`),
  INDEX `idx_type` (`type`),
  INDEX `idx_entity` (`entityType`, `entityId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2. Create NotificationPreferences Table
CREATE TABLE IF NOT EXISTS `NotificationPreferences` (
  `preferenceId` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE COMMENT 'User who owns these preferences',
  
  -- In-App Notification Preferences
  `inAppEnabled` TINYINT(1) DEFAULT 1 COMMENT 'Master toggle for in-app notifications',
  `inAppDealCreated` TINYINT(1) DEFAULT 1,
  `inAppDealUpdated` TINYINT(1) DEFAULT 1,
  `inAppDealAssigned` TINYINT(1) DEFAULT 1,
  `inAppDealWon` TINYINT(1) DEFAULT 1,
  `inAppDealLost` TINYINT(1) DEFAULT 1,
  `inAppLeadCreated` TINYINT(1) DEFAULT 1,
  `inAppLeadAssigned` TINYINT(1) DEFAULT 1,
  `inAppActivityCreated` TINYINT(1) DEFAULT 1,
  `inAppActivityAssigned` TINYINT(1) DEFAULT 1,
  `inAppActivityDue` TINYINT(1) DEFAULT 1,
  `inAppEmailReceived` TINYINT(1) DEFAULT 1,
  `inAppMention` TINYINT(1) DEFAULT 1,
  `inAppComment` TINYINT(1) DEFAULT 1,
  
  -- Push Notification Preferences
  `pushEnabled` TINYINT(1) DEFAULT 1 COMMENT 'Master toggle for push notifications',
  `pushDealCreated` TINYINT(1) DEFAULT 0,
  `pushDealAssigned` TINYINT(1) DEFAULT 1,
  `pushDealWon` TINYINT(1) DEFAULT 1,
  `pushActivityAssigned` TINYINT(1) DEFAULT 1,
  `pushActivityDue` TINYINT(1) DEFAULT 1,
  `pushEmailReceived` TINYINT(1) DEFAULT 0,
  `pushMention` TINYINT(1) DEFAULT 1,
  
  -- Email Notification Preferences
  `emailEnabled` TINYINT(1) DEFAULT 1 COMMENT 'Master toggle for email notifications',
  `emailDigestFrequency` ENUM('instant', 'hourly', 'daily', 'weekly', 'never') DEFAULT 'daily',
  `emailDealAssigned` TINYINT(1) DEFAULT 1,
  `emailActivityDue` TINYINT(1) DEFAULT 1,
  `emailMention` TINYINT(1) DEFAULT 1,
  
  -- Advanced Settings
  `groupSimilarNotifications` TINYINT(1) DEFAULT 1 COMMENT 'Group similar notifications together',
  `muteUntil` DATETIME COMMENT 'Mute all notifications until this time',
  `quietHoursStart` TIME COMMENT 'Start of quiet hours (e.g., 22:00)',
  `quietHoursEnd` TIME COMMENT 'End of quiet hours (e.g., 08:00)',
  
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Key
  CONSTRAINT `fk_preference_user` 
    FOREIGN KEY (`userId`) REFERENCES `MasterUsers` (`masterUserID`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Index
  INDEX `idx_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. Create PushSubscriptions Table
CREATE TABLE IF NOT EXISTS `PushSubscriptions` (
  `subscriptionId` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL COMMENT 'User who owns this subscription',
  `endpoint` TEXT NOT NULL COMMENT 'Push service endpoint URL',
  `keys` JSON NOT NULL COMMENT 'Subscription keys (p256dh and auth)',
  `deviceInfo` JSON COMMENT 'Device/browser information',
  `isActive` TINYINT(1) DEFAULT 1 COMMENT 'Whether subscription is active',
  `lastUsed` DATETIME COMMENT 'Last time this subscription received a push',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Key
  CONSTRAINT `fk_subscription_user` 
    FOREIGN KEY (`userId`) REFERENCES `MasterUsers` (`masterUserID`) 
    ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Indexes
  INDEX `idx_user` (`userId`),
  INDEX `idx_endpoint_unique` (`endpoint`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================
-- Verification Queries
-- =============================================

-- Check if tables were created
SHOW TABLES LIKE 'Notification%';

-- Check table structures
DESCRIBE Notifications;
DESCRIBE NotificationPreferences;
DESCRIBE PushSubscriptions;
