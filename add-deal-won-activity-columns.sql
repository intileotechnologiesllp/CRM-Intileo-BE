-- Add deal won popup columns to activity_settings table

ALTER TABLE `activity_settings` 
ADD COLUMN `showDealWonPopup` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Show schedule activity popup after marking deal as won' AFTER `allowUserDisable`,
ADD COLUMN `dealWonActivityType` VARCHAR(255) NOT NULL DEFAULT 'Task' COMMENT 'Default activity type for deal won popup' AFTER `showDealWonPopup`,
ADD COLUMN `dealWonFollowUpTime` VARCHAR(255) NOT NULL DEFAULT 'in 3 months' COMMENT 'Default follow-up time for deal won popup' AFTER `dealWonActivityType`,
ADD COLUMN `allowUserDisableDealWon` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Allow users to disable deal won popup' AFTER `dealWonFollowUpTime`;

-- Verify the changes
DESC activity_settings;
