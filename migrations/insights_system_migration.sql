-- =====================================================
-- Insights System Migration SQL
-- Run this in phpMyAdmin to create the Goals table
-- and update the Reports table for the Insights Dashboard
-- =====================================================

-- Add new columns to Dashboards table for folder/file functionality
ALTER TABLE `Dashboards` 
ADD COLUMN IF NOT EXISTS `type` varchar(255) NOT NULL DEFAULT 'dashboard' AFTER `folder`,
ADD COLUMN IF NOT EXISTS `parentId` int(11) DEFAULT NULL AFTER `type`,
ADD INDEX IF NOT EXISTS `idx_dashboard_type` (`type`),
ADD INDEX IF NOT EXISTS `idx_dashboard_parent` (`parentId`);

-- Add foreign key constraint for parentId (self-referencing)
ALTER TABLE `Dashboards` 
ADD CONSTRAINT IF NOT EXISTS `Dashboards_parentId_foreign` 
FOREIGN KEY (`parentId`) REFERENCES `Dashboards` (`dashboardId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Goals table
CREATE TABLE IF NOT EXISTS `Goals` (
  `goalId` int(11) NOT NULL AUTO_INCREMENT,
  `dashboardId` int(11) NOT NULL,
  `entity` varchar(255) NOT NULL,
  `goalType` varchar(255) NOT NULL,
  `targetValue` decimal(15,2) NOT NULL,
  `targetType` varchar(255) NOT NULL DEFAULT 'number',
  `period` varchar(255) NOT NULL DEFAULT 'monthly',
  `startDate` datetime NOT NULL,
  `endDate` datetime NOT NULL,
  `description` text DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT 1,
  `ownerId` int(11) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`goalId`),
  KEY `dashboardId` (`dashboardId`),
  KEY `ownerId` (`ownerId`),
  KEY `entity` (`entity`),
  KEY `goalType` (`goalType`),
  KEY `isActive` (`isActive`),
  CONSTRAINT `Goals_dashboardId_foreign` FOREIGN KEY (`dashboardId`) REFERENCES `Dashboards` (`dashboardId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add new columns to Reports table if they don't exist
ALTER TABLE `Reports` 
ADD COLUMN IF NOT EXISTS `name` varchar(255) NOT NULL DEFAULT 'Untitled Report' AFTER `reportId`,
ADD COLUMN IF NOT EXISTS `description` text DEFAULT NULL AFTER `name`;

-- Update position column to have default value if it doesn't already
ALTER TABLE `Reports` 
MODIFY COLUMN `position` int(11) DEFAULT 0;

-- Add new columns to Dashboards table for folder/file functionality
ALTER TABLE `Dashboards` 
ADD COLUMN IF NOT EXISTS `type` varchar(50) NOT NULL DEFAULT 'dashboard' AFTER `folder`,
ADD COLUMN IF NOT EXISTS `parentId` int(11) DEFAULT NULL AFTER `type`;

-- Add foreign key constraint for parentId (self-referencing)
ALTER TABLE `Dashboards` 
ADD CONSTRAINT IF NOT EXISTS `Dashboards_parentId_foreign` 
FOREIGN KEY (`parentId`) REFERENCES `Dashboards` (`dashboardId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- Sample Data (Optional - Remove if not needed)
-- =====================================================

-- Sample Dashboard (if you want test data)
-- INSERT INTO `Dashboards` (`name`, `folder`, `ownerId`, `createdAt`, `updatedAt`) 
-- VALUES ('Sales Performance Dashboard', 'My dashboards', 1, NOW(), NOW());

-- Sample Goal (if you want test data)
-- INSERT INTO `Goals` (`dashboardId`, `entity`, `goalType`, `targetValue`, `targetType`, `period`, `startDate`, `endDate`, `description`, `ownerId`, `createdAt`, `updatedAt`) 
-- VALUES (1, 'Deal', 'Won', 50.00, 'number', 'monthly', '2025-07-01 00:00:00', '2025-07-31 23:59:59', 'Win 50 deals this month', 1, NOW(), NOW());

-- Sample Report (if you want test data)
-- INSERT INTO `Reports` (`dashboardId`, `entity`, `type`, `config`, `position`, `name`, `description`, `createdAt`, `updatedAt`) 
-- VALUES (1, 'Deal', 'Performance', '{"chartType":"pie","metrics":["win_rate","loss_rate"],"period":"this_month","groupBy":"status"}', 0, 'Deal Performance Report', 'Shows deal win/loss rates', NOW(), NOW());

-- =====================================================
-- Verification Queries (Run these to check if everything worked)
-- =====================================================

-- Check if Goals table was created
-- SHOW TABLES LIKE 'Goals';

-- Check Goals table structure
-- DESCRIBE Goals;

-- Check if Reports table has new columns
-- DESCRIBE Reports;

-- Check foreign key constraints
-- SELECT 
--   TABLE_NAME,
--   COLUMN_NAME,
--   CONSTRAINT_NAME,
--   REFERENCED_TABLE_NAME,
--   REFERENCED_COLUMN_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'Goals'
--   AND REFERENCED_TABLE_NAME IS NOT NULL;

-- =====================================================
-- Notes:
-- 1. Make sure your Dashboards table exists before running this
-- 2. Adjust the foreign key constraint if your Dashboards table has a different structure
-- 3. The sample data section is commented out - uncomment if you want test data
-- 4. Run the verification queries to ensure everything was created correctly
-- =====================================================
