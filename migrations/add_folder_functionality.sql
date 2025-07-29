-- =====================================================
-- Folder Functionality Migration SQL
-- Run this in phpMyAdmin to add folder functionality
-- to the existing Dashboards table
-- =====================================================

-- Add new columns to Dashboards table for folder/file functionality
ALTER TABLE `Dashboards` 
ADD COLUMN IF NOT EXISTS `type` varchar(50) NOT NULL DEFAULT 'dashboard' AFTER `folder`,
ADD COLUMN IF NOT EXISTS `parentId` int(11) DEFAULT NULL AFTER `type`;

-- Add index for better performance
ALTER TABLE `Dashboards` 
ADD INDEX IF NOT EXISTS `idx_type` (`type`),
ADD INDEX IF NOT EXISTS `idx_parentId` (`parentId`),
ADD INDEX IF NOT EXISTS `idx_ownerId_type` (`ownerId`, `type`);

-- Add foreign key constraint for parentId (self-referencing)
-- Note: This will only work if no orphaned records exist
ALTER TABLE `Dashboards` 
ADD CONSTRAINT `Dashboards_parentId_foreign` 
FOREIGN KEY (`parentId`) REFERENCES `Dashboards` (`dashboardId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- Sample Data for Testing (Optional - Remove if not needed)
-- =====================================================

-- Sample Folder
-- INSERT INTO `Dashboards` (`name`, `folder`, `type`, `parentId`, `ownerId`, `createdAt`, `updatedAt`) 
-- VALUES ('Sales Folder', 'My dashboards', 'folder', NULL, 1, NOW(), NOW());

-- Sample Dashboard inside folder (assuming folder ID is 1)
-- INSERT INTO `Dashboards` (`name`, `folder`, `type`, `parentId`, `ownerId`, `createdAt`, `updatedAt`) 
-- VALUES ('Q4 Sales Dashboard', 'My dashboards', 'dashboard', 1, 1, NOW(), NOW());

-- =====================================================
-- Verification Queries (Run these to check if everything worked)
-- =====================================================

-- Check if new columns were added
-- DESCRIBE Dashboards;

-- Check folder structure
-- SELECT 
--   d1.dashboardId,
--   d1.name,
--   d1.type,
--   d1.parentId,
--   d2.name AS parentName
-- FROM Dashboards d1
-- LEFT JOIN Dashboards d2 ON d1.parentId = d2.dashboardId
-- ORDER BY d1.type, d1.name;

-- =====================================================
-- Notes:
-- 1. Make sure your Dashboards table exists before running this
-- 2. The foreign key constraint may fail if there are orphaned parentId references
-- 3. The sample data section is commented out - uncomment if you want test data
-- 4. Run the verification queries to ensure everything was created correctly
-- =====================================================
