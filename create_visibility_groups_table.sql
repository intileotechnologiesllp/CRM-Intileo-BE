-- Manual SQL query to create visibility_groups table with proper foreign key constraints
-- Compatible with MySQL 5.7 and later versions

-- Step 1: Create the table without foreign key constraints
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

-- Step 2: Add foreign key constraints separately
ALTER TABLE `visibility_groups` 
ADD CONSTRAINT `visibility_groups_masterUserID_foreign_idx` 
FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) 
ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE `visibility_groups` 
ADD CONSTRAINT `visibility_groups_parentGroupId_foreign_idx` 
FOREIGN KEY (`parentGroupId`) REFERENCES `visibility_groups` (`groupId`) 
ON DELETE SET NULL ON UPDATE CASCADE;
