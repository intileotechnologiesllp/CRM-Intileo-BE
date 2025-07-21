-- Manual SQL query to create group_memberships table with proper foreign key constraints
-- Compatible with MySQL 5.7 and later versions

-- Step 1: Create the table without foreign key constraints
CREATE TABLE IF NOT EXISTS `group_memberships` (
  `membershipId` int NOT NULL AUTO_INCREMENT,
  `groupId` int NOT NULL,
  `userId` int NOT NULL,
  `masterUserID` int NOT NULL,
  `assignedBy` int NOT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `joinedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`membershipId`),
  UNIQUE KEY `unique_group_user_membership` (`groupId`,`userId`),
  KEY `groupId` (`groupId`),
  KEY `userId` (`userId`),
  KEY `masterUserID` (`masterUserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Add foreign key constraints separately
ALTER TABLE `group_memberships` 
ADD CONSTRAINT `group_memberships_groupId_foreign_idx` 
FOREIGN KEY (`groupId`) REFERENCES `visibility_groups` (`groupId`) 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `group_memberships` 
ADD CONSTRAINT `group_memberships_userId_foreign_idx` 
FOREIGN KEY (`userId`) REFERENCES `masterusers` (`masterUserID`) 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `group_memberships` 
ADD CONSTRAINT `group_memberships_masterUserID_foreign_idx` 
FOREIGN KEY (`masterUserID`) REFERENCES `masterusers` (`masterUserID`) 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `group_memberships` 
ADD CONSTRAINT `group_memberships_assignedBy_foreign_idx` 
FOREIGN KEY (`assignedBy`) REFERENCES `masterusers` (`masterUserID`) 
ON DELETE CASCADE ON UPDATE CASCADE;
