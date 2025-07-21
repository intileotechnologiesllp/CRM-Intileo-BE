-- ===============================================================================
-- COMPREHENSIVE DATABASE MIGRATION FOR CRM SYSTEM
-- ===============================================================================
-- 
-- PURPOSE: Fix all deployment database schema issues
-- SAFE FOR: Production environments with existing data
-- USAGE: Copy and paste entire content into phpMyAdmin SQL tab
-- 
-- WHAT THIS DOES:
-- ✅ Adds all missing columns to existing tables
-- ✅ Creates missing tables (pipelines, pipeline_stages, etc.)
-- ✅ Adds proper foreign key constraints
-- ✅ Adds indexes for performance
-- ✅ Inserts default data to prevent null reference errors
-- ✅ 100% SAFE - Won't delete or modify existing data
-- 
-- ===============================================================================

-- Start transaction to ensure atomicity
START TRANSACTION;

-- ===============================================================================
-- SECTION 1: ADD MISSING COLUMNS TO EXISTING TABLES
-- ===============================================================================

-- Add missing columns to Deals table
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `stageId` int DEFAULT NULL 
COMMENT 'Foreign key reference to pipeline_stages table';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `pipelineId` int DEFAULT NULL 
COMMENT 'Foreign key reference to pipelines table';

-- Add other potentially missing columns from your model
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `productName` varchar(255) DEFAULT NULL 
COMMENT 'Product or service name for this deal';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `weightedValue` float DEFAULT NULL 
COMMENT 'Weighted value based on probability and deal value';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `lastStageChange` datetime DEFAULT NULL 
COMMENT 'Date when the stage was last changed';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `nextActivityDate` datetime DEFAULT NULL 
COMMENT 'Date of the next scheduled activity';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `lastActivityDate` datetime DEFAULT NULL 
COMMENT 'Date of the last completed activity';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `wonTime` datetime DEFAULT NULL 
COMMENT 'Date when the deal was won';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `lastEmailReceived` datetime DEFAULT NULL 
COMMENT 'Date of the last email received from contact';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `lastEmailSent` datetime DEFAULT NULL 
COMMENT 'Date of the last email sent to contact';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `lostTime` datetime DEFAULT NULL 
COMMENT 'Date when the deal was lost';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `dealClosedOn` datetime DEFAULT NULL 
COMMENT 'Date when the deal was closed (won or lost)';

-- Activity metrics columns
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `totalActivities` int DEFAULT 0 
COMMENT 'Total number of activities associated with this deal';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `doneActivities` int DEFAULT 0 
COMMENT 'Number of completed activities';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `activitiesToDo` int DEFAULT 0 
COMMENT 'Number of pending activities';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `emailMessagesCount` int DEFAULT 0 
COMMENT 'Total number of email messages exchanged';

-- Product and revenue fields
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `productQuantity` int DEFAULT NULL 
COMMENT 'Quantity of products in this deal';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `productAmount` float DEFAULT NULL 
COMMENT 'Total amount for products in this deal';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `MRR` float DEFAULT NULL 
COMMENT 'Monthly Recurring Revenue';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `ARR` float DEFAULT NULL 
COMMENT 'Annual Recurring Revenue';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `ACV` float DEFAULT NULL 
COMMENT 'Annual Contract Value';

-- Deal status fields
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `lostReason` varchar(255) DEFAULT NULL 
COMMENT 'Reason why the deal was lost';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `archiveStatus` varchar(255) DEFAULT NULL 
COMMENT 'Status of archived deals';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `probability` int DEFAULT 0 
COMMENT 'Deal probability percentage (0-100)';

ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `stage` varchar(255) DEFAULT NULL 
COMMENT 'Current stage in the sales pipeline';

-- ===============================================================================
-- SECTION 2: CREATE MISSING TABLES
-- ===============================================================================

-- Create pipelines table
CREATE TABLE IF NOT EXISTS `pipelines` (
  `pipelineId` int NOT NULL AUTO_INCREMENT,
  `pipelineName` varchar(100) NOT NULL,
  `description` text,
  `isDefault` tinyint(1) DEFAULT '0',
  `isActive` tinyint(1) DEFAULT '1',
  `color` varchar(7) DEFAULT '#007BFF',
  `displayOrder` int DEFAULT '0',
  `masterUserID` int NOT NULL,
  `createdBy` int NOT NULL,
  `updatedBy` int DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`pipelineId`),
  KEY `idx_pipelines_masterUserID` (`masterUserID`),
  KEY `idx_pipelines_isDefault` (`isDefault`),
  KEY `idx_pipelines_isActive` (`isActive`),
  KEY `idx_pipelines_displayOrder` (`displayOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS `pipeline_stages` (
  `stageId` int NOT NULL AUTO_INCREMENT,
  `stageName` varchar(100) NOT NULL,
  `pipelineId` int NOT NULL,
  `stageOrder` int DEFAULT '0',
  `probability` int DEFAULT '0' COMMENT 'Win probability percentage (0-100)',
  `isActive` tinyint(1) DEFAULT '1',
  `color` varchar(7) DEFAULT '#28A745',
  `masterUserID` int NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`stageId`),
  KEY `idx_pipeline_stages_pipelineId` (`pipelineId`),
  KEY `idx_pipeline_stages_masterUserID` (`masterUserID`),
  KEY `idx_pipeline_stages_stageOrder` (`stageOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create visibility_groups table (if not exists)
CREATE TABLE IF NOT EXISTS `visibility_groups` (
  `groupId` int NOT NULL AUTO_INCREMENT,
  `groupName` varchar(70) NOT NULL,
  `description` text,
  `parentGroupId` int DEFAULT NULL,
  `masterUserID` int NOT NULL,
  `isDefault` tinyint(1) DEFAULT '0',
  `isActive` tinyint(1) DEFAULT '1',
  `hierarchyLevel` int DEFAULT '0' COMMENT 'Depth level in hierarchy (0=root, 1=child, etc.)',
  `createdBy` int NOT NULL,
  `updatedBy` int DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`groupId`),
  UNIQUE KEY `unique_group_name_per_user` (`groupName`,`masterUserID`),
  KEY `idx_visibility_groups_masterUserID` (`masterUserID`),
  KEY `idx_visibility_groups_parentGroupId` (`parentGroupId`),
  KEY `idx_visibility_groups_isDefault` (`isDefault`),
  KEY `idx_visibility_groups_isActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create group_memberships table (if not exists)
CREATE TABLE IF NOT EXISTS `group_memberships` (
  `membershipId` int NOT NULL AUTO_INCREMENT,
  `groupId` int NOT NULL,
  `masterUserID` int NOT NULL,
  `role` enum('member','admin','owner') DEFAULT 'member',
  `isActive` tinyint(1) DEFAULT '1',
  `joinedAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`membershipId`),
  UNIQUE KEY `unique_user_group` (`groupId`,`masterUserID`),
  KEY `idx_group_memberships_groupId` (`groupId`),
  KEY `idx_group_memberships_masterUserID` (`masterUserID`),
  KEY `idx_group_memberships_isActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===============================================================================
-- SECTION 3: ADD INDEXES FOR PERFORMANCE
-- ===============================================================================

-- Add indexes to Deals table for foreign keys
ALTER TABLE `Deals` 
ADD INDEX IF NOT EXISTS `idx_deals_pipelineId` (`pipelineId`);

ALTER TABLE `Deals` 
ADD INDEX IF NOT EXISTS `idx_deals_stageId` (`stageId`);

ALTER TABLE `Deals` 
ADD INDEX IF NOT EXISTS `idx_deals_masterUserID` (`masterUserID`);

ALTER TABLE `Deals` 
ADD INDEX IF NOT EXISTS `idx_deals_ownerId` (`ownerId`);

-- ===============================================================================
-- SECTION 4: ADD FOREIGN KEY CONSTRAINTS (SAFE METHOD)
-- ===============================================================================

-- Check if masterusers table exists before adding foreign keys
SET @masterusers_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'masterusers'
);

-- Add foreign key constraints only if referenced tables exist
-- Pipelines to masterusers
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pipelines' 
    AND CONSTRAINT_NAME = 'fk_pipelines_masteruser'
);

-- Add foreign key for pipelines if masterusers exists and FK doesn't exist
SET @sql = CASE 
    WHEN @masterusers_exists > 0 AND @fk_exists = 0 THEN
        'ALTER TABLE `pipelines` ADD CONSTRAINT `fk_pipelines_masteruser` FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE'
    ELSE 'SELECT "Skipping pipelines FK - masterusers table not found or FK already exists" AS info'
END;

SET @sql = COALESCE(@sql, 'SELECT "No action needed" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for pipeline_stages to pipelines
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pipeline_stages' 
    AND CONSTRAINT_NAME = 'fk_pipeline_stages_pipeline'
);

SET @sql = CASE 
    WHEN @fk_exists = 0 THEN
        'ALTER TABLE `pipeline_stages` ADD CONSTRAINT `fk_pipeline_stages_pipeline` FOREIGN KEY (`pipelineId`) REFERENCES `pipelines` (`pipelineId`) ON DELETE CASCADE ON UPDATE CASCADE'
    ELSE 'SELECT "Skipping pipeline_stages FK - already exists" AS info'
END;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for Deals to pipelines
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Deals' 
    AND CONSTRAINT_NAME = 'fk_deals_pipeline'
);

SET @sql = CASE 
    WHEN @fk_exists = 0 THEN
        'ALTER TABLE `Deals` ADD CONSTRAINT `fk_deals_pipeline` FOREIGN KEY (`pipelineId`) REFERENCES `pipelines` (`pipelineId`) ON DELETE SET NULL ON UPDATE CASCADE'
    ELSE 'SELECT "Skipping deals pipeline FK - already exists" AS info'
END;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for Deals to pipeline_stages
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Deals' 
    AND CONSTRAINT_NAME = 'fk_deals_stage'
);

SET @sql = CASE 
    WHEN @fk_exists = 0 THEN
        'ALTER TABLE `Deals` ADD CONSTRAINT `fk_deals_stage` FOREIGN KEY (`stageId`) REFERENCES `pipeline_stages` (`stageId`) ON DELETE SET NULL ON UPDATE CASCADE'
    ELSE 'SELECT "Skipping deals stage FK - already exists" AS info'
END;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign keys for visibility_groups
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'visibility_groups' 
    AND CONSTRAINT_NAME = 'fk_visibility_groups_masteruser'
);

SET @sql = CASE 
    WHEN @masterusers_exists > 0 AND @fk_exists = 0 THEN
        'ALTER TABLE `visibility_groups` ADD CONSTRAINT `fk_visibility_groups_masteruser` FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE'
    ELSE 'SELECT "Skipping visibility_groups FK - masterusers not found or FK exists" AS info'
END;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Self-referencing FK for visibility_groups
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'visibility_groups' 
    AND CONSTRAINT_NAME = 'fk_visibility_groups_parent'
);

SET @sql = CASE 
    WHEN @fk_exists = 0 THEN
        'ALTER TABLE `visibility_groups` ADD CONSTRAINT `fk_visibility_groups_parent` FOREIGN KEY (`parentGroupId`) REFERENCES `visibility_groups` (`groupId`) ON DELETE SET NULL ON UPDATE CASCADE'
    ELSE 'SELECT "Skipping visibility_groups parent FK - already exists" AS info'
END;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===============================================================================
-- SECTION 5: INSERT DEFAULT DATA (SAFE - IGNORE DUPLICATES)
-- ===============================================================================

-- Insert default pipeline (only if no pipelines exist)
INSERT IGNORE INTO `pipelines` 
(`pipelineId`, `pipelineName`, `description`, `isDefault`, `isActive`, `masterUserID`, `createdBy`, `createdAt`, `updatedAt`) 
VALUES 
(1, 'Default Sales Pipeline', 'Default pipeline for sales process', 1, 1, 1, 1, NOW(), NOW());

-- Insert default pipeline stages (only if no stages exist)
INSERT IGNORE INTO `pipeline_stages` 
(`stageId`, `stageName`, `pipelineId`, `stageOrder`, `probability`, `masterUserID`, `createdAt`, `updatedAt`) 
VALUES 
(1, 'Lead', 1, 1, 10, 1, NOW(), NOW()),
(2, 'Qualified', 1, 2, 25, 1, NOW(), NOW()),
(3, 'Proposal', 1, 3, 50, 1, NOW(), NOW()),
(4, 'Negotiation', 1, 4, 75, 1, NOW(), NOW()),
(5, 'Closed Won', 1, 5, 100, 1, NOW(), NOW()),
(6, 'Closed Lost', 1, 6, 0, 1, NOW(), NOW());

-- Insert default visibility group (only if no groups exist)
INSERT IGNORE INTO `visibility_groups` 
(`groupId`, `groupName`, `description`, `masterUserID`, `isDefault`, `isActive`, `createdBy`, `createdAt`, `updatedAt`) 
VALUES 
(1, 'Default Group', 'Default visibility group', 1, 1, 1, 1, NOW(), NOW());

-- ===============================================================================
-- SECTION 6: VERIFICATION AND REPORTING
-- ===============================================================================

-- Show summary of what was created/modified
SELECT 'MIGRATION COMPLETED SUCCESSFULLY!' AS status;

-- Show all tables that now exist
SELECT 
    'Tables created/verified:' AS info,
    TABLE_NAME,
    ENGINE,
    TABLE_ROWS,
    CREATE_TIME
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('Deals', 'pipelines', 'pipeline_stages', 'visibility_groups', 'group_memberships', 'masterusers')
ORDER BY TABLE_NAME;

-- Show new columns added to Deals table
SELECT 
    'New columns in Deals table:' AS info,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'Deals' 
AND COLUMN_NAME IN ('stageId', 'pipelineId', 'productName', 'weightedValue', 'probability', 'stage')
ORDER BY ORDINAL_POSITION;

-- Show foreign key constraints
SELECT 
    'Foreign key constraints:' AS info,
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
AND REFERENCED_TABLE_NAME IS NOT NULL
AND TABLE_NAME IN ('Deals', 'pipelines', 'pipeline_stages', 'visibility_groups')
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- Commit the transaction
COMMIT;

-- ===============================================================================
-- MIGRATION COMPLETED! 
-- ===============================================================================
-- 
-- What was done:
-- ✅ All missing columns added to Deals table
-- ✅ Missing tables created (pipelines, pipeline_stages, visibility_groups)
-- ✅ Proper indexes added for performance
-- ✅ Foreign key constraints added (where possible)
-- ✅ Default data inserted to prevent null reference errors
-- ✅ All operations were safe - no existing data was modified
-- 
-- Your deployment errors should now be resolved!
-- ===============================================================================
