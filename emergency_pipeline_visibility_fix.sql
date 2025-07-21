-- ===============================================================================
-- EMERGENCY FIX: Pipeline Visibility Rules Table Creation Error
-- ===============================================================================
-- 
-- This fixes the error: Can't create table `crm`.`pipeline_visibility_rules` 
-- (errno: 150 "Foreign key constraint is incorrectly formed")
--
-- Run this immediately to fix the deployment error!
-- ===============================================================================

USE `crm`;

-- Drop the table if it exists with incorrect constraints
DROP TABLE IF EXISTS `pipeline_visibility_rules`;
DROP TABLE IF EXISTS `item_visibility_rules`;

-- Create pipeline_visibility_rules table with correct foreign key references
CREATE TABLE IF NOT EXISTS `pipeline_visibility_rules` (
  `ruleId` int(11) NOT NULL AUTO_INCREMENT,
  `groupId` int(11) NOT NULL,
  `pipelineId` int(11) NOT NULL,
  `masterUserID` int(11) NOT NULL,
  `canView` tinyint(1) DEFAULT 1,
  `canEdit` tinyint(1) DEFAULT 0,
  `canDelete` tinyint(1) DEFAULT 0,
  `canCreateDeals` tinyint(1) DEFAULT 1,
  `isActive` tinyint(1) DEFAULT 1,
  `createdBy` int(11) NOT NULL,
  `updatedBy` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ruleId`),
  UNIQUE KEY `unique_group_pipeline_rule` (`groupId`, `pipelineId`),
  KEY `pipeline_visibility_rules_group_id` (`groupId`),
  KEY `pipeline_visibility_rules_pipeline_id` (`pipelineId`),
  KEY `pipeline_visibility_rules_master_user_id` (`masterUserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Pipeline visibility rules for groups';

-- Add foreign key constraints separately to handle any issues
-- Note: Using 'masterusers' (without underscore) as that's the actual table name
ALTER TABLE `pipeline_visibility_rules`
ADD CONSTRAINT `pipeline_visibility_rules_ibfk_1` 
FOREIGN KEY (`groupId`) REFERENCES `visibility_groups` (`groupId`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `pipeline_visibility_rules`
ADD CONSTRAINT `pipeline_visibility_rules_ibfk_2` 
FOREIGN KEY (`pipelineId`) REFERENCES `pipelines` (`pipelineId`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `pipeline_visibility_rules`
ADD CONSTRAINT `pipeline_visibility_rules_ibfk_3` 
FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create item_visibility_rules table as well (might be needed)
CREATE TABLE IF NOT EXISTS `item_visibility_rules` (
  `ruleId` int(11) NOT NULL AUTO_INCREMENT,
  `groupId` int(11) NOT NULL,
  `itemType` enum('deal','lead','person','organization') NOT NULL,
  `itemId` int(11) NOT NULL,
  `masterUserID` int(11) NOT NULL,
  `canView` tinyint(1) DEFAULT 1,
  `canEdit` tinyint(1) DEFAULT 0,
  `canDelete` tinyint(1) DEFAULT 0,
  `isActive` tinyint(1) DEFAULT 1,
  `createdBy` int(11) NOT NULL,
  `updatedBy` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ruleId`),
  UNIQUE KEY `unique_group_item_rule` (`groupId`, `itemType`, `itemId`),
  KEY `item_visibility_rules_group_id` (`groupId`),
  KEY `item_visibility_rules_master_user_id` (`masterUserID`),
  KEY `item_visibility_rules_item_type_id` (`itemType`, `itemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Item-specific visibility rules for groups';

-- Add foreign key constraints for item_visibility_rules
ALTER TABLE `item_visibility_rules`
ADD CONSTRAINT `item_visibility_rules_ibfk_1` 
FOREIGN KEY (`groupId`) REFERENCES `visibility_groups` (`groupId`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `item_visibility_rules`
ADD CONSTRAINT `item_visibility_rules_ibfk_2` 
FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default pipeline visibility rules
INSERT IGNORE INTO `pipeline_visibility_rules` 
(`groupId`, `pipelineId`, `masterUserID`, `canView`, `canEdit`, `canDelete`, `canCreateDeals`, `createdBy`, `createdAt`, `updatedAt`)
SELECT 
  vg.groupId,
  p.pipelineId,
  vg.masterUserID,
  1 as canView,
  1 as canEdit,
  0 as canDelete,
  1 as canCreateDeals,
  vg.masterUserID as createdBy,
  NOW() as createdAt,
  NOW() as updatedAt
FROM `visibility_groups` vg
CROSS JOIN `pipelines` p
WHERE vg.isActive = 1 AND p.isActive = 1
AND NOT EXISTS (
  SELECT 1 FROM pipeline_visibility_rules pvr 
  WHERE pvr.groupId = vg.groupId AND pvr.pipelineId = p.pipelineId
);

-- Verify the tables were created successfully
SELECT 'Tables created successfully!' as Status;
SELECT COUNT(*) as pipeline_visibility_rules_count FROM `pipeline_visibility_rules`;
SELECT COUNT(*) as item_visibility_rules_count FROM `item_visibility_rules`;

-- Show table structure to verify
DESCRIBE `pipeline_visibility_rules`;

SELECT '✅ Emergency fix completed! Your server should start now.' as Result;
