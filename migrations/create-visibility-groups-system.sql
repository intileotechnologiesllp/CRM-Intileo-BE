-- Migration: Create Visibility Groups System
-- Date: July 21, 2025

-- Create visibility_groups table
CREATE TABLE IF NOT EXISTS `visibility_groups` (
  `groupId` int(11) NOT NULL AUTO_INCREMENT,
  `groupName` varchar(70) NOT NULL,
  `description` text DEFAULT NULL,
  `parentGroupId` int(11) DEFAULT NULL,
  `masterUserID` int(11) NOT NULL,
  `isDefault` tinyint(1) DEFAULT 0,
  `isActive` tinyint(1) DEFAULT 1,
  `hierarchyLevel` int(11) DEFAULT 0 COMMENT 'Depth level in hierarchy (0=root, 1=child, etc.)',
  `createdBy` int(11) NOT NULL,
  `updatedBy` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`groupId`),
  UNIQUE KEY `unique_group_name_per_user` (`groupName`, `masterUserID`),
  KEY `visibility_groups_master_user_id` (`masterUserID`),
  KEY `visibility_groups_parent_group_id` (`parentGroupId`),
  KEY `visibility_groups_is_default` (`isDefault`),
  KEY `visibility_groups_is_active` (`isActive`),
  CONSTRAINT `visibility_groups_ibfk_1` FOREIGN KEY (`parentGroupId`) REFERENCES `visibility_groups` (`groupId`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `visibility_groups_ibfk_2` FOREIGN KEY (`masterUserID`) REFERENCES `master_users` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create group_memberships table
CREATE TABLE IF NOT EXISTS `group_memberships` (
  `membershipId` int(11) NOT NULL AUTO_INCREMENT,
  `groupId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `masterUserID` int(11) NOT NULL,
  `assignedBy` int(11) NOT NULL,
  `isActive` tinyint(1) DEFAULT 1,
  `joinedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`membershipId`),
  UNIQUE KEY `unique_group_user_membership` (`groupId`, `userId`),
  KEY `group_memberships_group_id` (`groupId`),
  KEY `group_memberships_user_id` (`userId`),
  KEY `group_memberships_master_user_id` (`masterUserID`),
  CONSTRAINT `group_memberships_ibfk_1` FOREIGN KEY (`groupId`) REFERENCES `visibility_groups` (`groupId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `group_memberships_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `master_users` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `group_memberships_ibfk_3` FOREIGN KEY (`masterUserID`) REFERENCES `master_users` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `group_memberships_ibfk_4` FOREIGN KEY (`assignedBy`) REFERENCES `master_users` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create pipeline_visibility_rules table
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
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`ruleId`),
  UNIQUE KEY `unique_group_pipeline_rule` (`groupId`, `pipelineId`),
  KEY `pipeline_visibility_rules_group_id` (`groupId`),
  KEY `pipeline_visibility_rules_pipeline_id` (`pipelineId`),
  KEY `pipeline_visibility_rules_master_user_id` (`masterUserID`),
  CONSTRAINT `pipeline_visibility_rules_ibfk_1` FOREIGN KEY (`groupId`) REFERENCES `visibility_groups` (`groupId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pipeline_visibility_rules_ibfk_2` FOREIGN KEY (`pipelineId`) REFERENCES `pipelines` (`pipelineId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `pipeline_visibility_rules_ibfk_3` FOREIGN KEY (`masterUserID`) REFERENCES `master_users` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create item_visibility_rules table
CREATE TABLE IF NOT EXISTS `item_visibility_rules` (
  `ruleId` int(11) NOT NULL AUTO_INCREMENT,
  `groupId` int(11) NOT NULL,
  `entityType` enum('leads','deals','people','organizations','products','activities') NOT NULL,
  `masterUserID` int(11) NOT NULL,
  `defaultVisibility` enum('owner_only','group_only','everyone','item_owners_visibility_group') DEFAULT 'item_owners_visibility_group',
  `canCreate` tinyint(1) DEFAULT 1,
  `canView` tinyint(1) DEFAULT 1,
  `canEdit` tinyint(1) DEFAULT 1,
  `canDelete` tinyint(1) DEFAULT 0,
  `canExport` tinyint(1) DEFAULT 0,
  `canBulkEdit` tinyint(1) DEFAULT 0,
  `isActive` tinyint(1) DEFAULT 1,
  `createdBy` int(11) NOT NULL,
  `updatedBy` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`ruleId`),
  UNIQUE KEY `unique_group_entity_rule` (`groupId`, `entityType`),
  KEY `item_visibility_rules_group_id` (`groupId`),
  KEY `item_visibility_rules_entity_type` (`entityType`),
  KEY `item_visibility_rules_master_user_id` (`masterUserID`),
  CONSTRAINT `item_visibility_rules_ibfk_1` FOREIGN KEY (`groupId`) REFERENCES `visibility_groups` (`groupId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `item_visibility_rules_ibfk_2` FOREIGN KEY (`masterUserID`) REFERENCES `master_users` (`masterUserID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default visibility group for each existing user
INSERT INTO `visibility_groups` (`groupName`, `description`, `masterUserID`, `isDefault`, `createdBy`, `createdAt`, `updatedAt`)
SELECT 
  'Default group' as groupName,
  'This is the default group for managing your visibility settings. New users are added automatically unless you change their group when you invite them.' as description,
  mu.masterUserID,
  1 as isDefault,
  mu.masterUserID as createdBy,
  NOW() as createdAt,
  NOW() as updatedAt
FROM master_users mu
WHERE NOT EXISTS (
  SELECT 1 FROM visibility_groups vg 
  WHERE vg.masterUserID = mu.masterUserID AND vg.isDefault = 1
);

-- Add all existing users to their default groups
INSERT INTO `group_memberships` (`groupId`, `userId`, `masterUserID`, `assignedBy`, `createdAt`, `updatedAt`)
SELECT 
  vg.groupId,
  mu.masterUserID as userId,
  mu.masterUserID,
  mu.masterUserID as assignedBy,
  NOW() as createdAt,
  NOW() as updatedAt
FROM master_users mu
INNER JOIN visibility_groups vg ON vg.masterUserID = mu.masterUserID AND vg.isDefault = 1
WHERE NOT EXISTS (
  SELECT 1 FROM group_memberships gm 
  WHERE gm.groupId = vg.groupId AND gm.userId = mu.masterUserID
);

-- Create default item visibility rules for each default group
INSERT INTO `item_visibility_rules` (`groupId`, `entityType`, `masterUserID`, `defaultVisibility`, `canCreate`, `canView`, `canEdit`, `canDelete`, `createdBy`, `createdAt`, `updatedAt`)
SELECT 
  vg.groupId,
  entity.entityType,
  vg.masterUserID,
  'item_owners_visibility_group' as defaultVisibility,
  1 as canCreate,
  1 as canView,
  1 as canEdit,
  0 as canDelete,
  vg.masterUserID as createdBy,
  NOW() as createdAt,
  NOW() as updatedAt
FROM visibility_groups vg
CROSS JOIN (
  SELECT 'leads' as entityType
  UNION SELECT 'deals'
  UNION SELECT 'people'
  UNION SELECT 'organizations'
  UNION SELECT 'products'
  UNION SELECT 'activities'
) entity
WHERE vg.isDefault = 1
AND NOT EXISTS (
  SELECT 1 FROM item_visibility_rules ivr 
  WHERE ivr.groupId = vg.groupId AND ivr.entityType = entity.entityType
);

-- Create default pipeline visibility rules (allow access to all pipelines for default groups)
INSERT INTO `pipeline_visibility_rules` (`groupId`, `pipelineId`, `masterUserID`, `canView`, `canEdit`, `canDelete`, `canCreateDeals`, `createdBy`, `createdAt`, `updatedAt`)
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
FROM visibility_groups vg
INNER JOIN pipelines p ON p.masterUserID = vg.masterUserID
WHERE vg.isDefault = 1
AND NOT EXISTS (
  SELECT 1 FROM pipeline_visibility_rules pvr 
  WHERE pvr.groupId = vg.groupId AND pvr.pipelineId = p.pipelineId
);
