-- Comprehensive deployment script to add all missing columns to production database
-- This script handles the schema differences between local and deployed environments

-- =============================================================================
-- DEALS TABLE - Add missing columns
-- =============================================================================

-- Add pipelineId column if it doesn't exist
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `pipelineId` int DEFAULT NULL 
COMMENT 'Foreign key reference to pipelines table';

-- Add stageId column if it doesn't exist  
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `stageId` int DEFAULT NULL 
COMMENT 'Foreign key reference to pipeline_stages table';

-- Add other potentially missing columns from the model
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

-- Activity metrics
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

-- =============================================================================
-- ADD INDEXES FOR PERFORMANCE
-- =============================================================================

-- Add indexes for foreign keys
ALTER TABLE `Deals` 
ADD INDEX IF NOT EXISTS `idx_deals_pipelineId` (`pipelineId`);

ALTER TABLE `Deals` 
ADD INDEX IF NOT EXISTS `idx_deals_stageId` (`stageId`);

-- =============================================================================
-- ADD FOREIGN KEY CONSTRAINTS (Optional - only if referenced tables exist)
-- =============================================================================

-- Uncomment these if you have pipelines and pipeline_stages tables
-- 
-- ALTER TABLE `Deals` 
-- ADD CONSTRAINT `fk_deals_pipeline` 
-- FOREIGN KEY (`pipelineId`) 
-- REFERENCES `pipelines` (`pipelineId`) 
-- ON DELETE SET NULL 
-- ON UPDATE CASCADE;
-- 
-- ALTER TABLE `Deals` 
-- ADD CONSTRAINT `fk_deals_stage` 
-- FOREIGN KEY (`stageId`) 
-- REFERENCES `pipeline_stages` (`stageId`) 
-- ON DELETE SET NULL 
-- ON UPDATE CASCADE;

-- =============================================================================
-- VISIBILITY GROUPS TABLE (if needed)
-- =============================================================================

-- Create visibility_groups table if it doesn't exist
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
  KEY `masterUserID` (`masterUserID`),
  KEY `parentGroupId` (`parentGroupId`),
  KEY `isDefault` (`isDefault`),
  KEY `isActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints for visibility_groups
ALTER TABLE `visibility_groups` 
ADD CONSTRAINT `visibility_groups_masterUserID_foreign_idx` 
FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) 
ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE `visibility_groups` 
ADD CONSTRAINT `visibility_groups_parentGroupId_foreign_idx` 
FOREIGN KEY (`parentGroupId`) REFERENCES `visibility_groups` (`groupId`) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- VERIFICATION QUERIES (Optional - run these to check results)
-- =============================================================================

-- Check if all columns exist in Deals table
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'crm' AND TABLE_NAME = 'Deals' 
-- ORDER BY ORDINAL_POSITION;

-- Check foreign key constraints
-- SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
-- WHERE TABLE_SCHEMA = 'crm' AND TABLE_NAME = 'Deals' 
-- AND REFERENCED_TABLE_NAME IS NOT NULL;
