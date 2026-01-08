-- ===================================================================
-- FOLLOWERS TABLE MIGRATION
-- ===================================================================
-- This script creates the Followers table for tracking which users
-- are following deals, leads, persons, and organizations in the CRM.
-- 
-- Usage:
-- 1. Connect to your database
-- 2. Run this SQL script
-- 3. Restart your Node.js application to sync the model
-- ===================================================================

-- Create Followers table
CREATE TABLE IF NOT EXISTS `Followers` (
  `followerId` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `entityType` ENUM('deal', 'lead', 'person', 'organization') NOT NULL COMMENT 'Type of entity being followed (deal, lead, person, organization)',
  `entityId` INT NOT NULL COMMENT 'ID of the entity being followed',
  `userId` INT NOT NULL COMMENT 'ID of the user who is following',
  `masterUserID` INT NOT NULL COMMENT 'Master user/organization ID for multi-tenancy',
  `addedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the user started following',
  `addedBy` INT NULL COMMENT 'User ID who added this follower (may be different from userId for bulk adds)',
  
  -- Indexes for performance
  UNIQUE KEY `unique_follower_per_entity` (`entityType`, `entityId`, `userId`),
  KEY `idx_entity_followers` (`entityType`, `entityId`),
  KEY `idx_user_following` (`userId`),
  KEY `idx_follower_master_user` (`masterUserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks followers for deals, leads, persons, and organizations';

-- Note: Foreign key constraints are managed by Sequelize associations in the application
-- This avoids database-level foreign key constraint errors during table creation

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check if table was created successfully
SELECT 
  TABLE_NAME, 
  TABLE_ROWS, 
  CREATE_TIME
FROM 
  INFORMATION_SCHEMA.TABLES 
WHERE 
  TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'Followers';

-- Check table structure
DESCRIBE Followers;

-- Check indexes
SHOW INDEX FROM Followers;

-- ===================================================================
-- EXAMPLE USAGE (Optional - for testing)
-- ===================================================================

-- Add a follower to a deal
-- INSERT INTO Followers (entityType, entityId, userId, masterUserID, addedBy)
-- VALUES ('deal', 1, 5, 5, 5);

-- Add a follower to a lead
-- INSERT INTO Followers (entityType, entityId, userId, masterUserID, addedBy)
-- VALUES ('lead', 10, 5, 5, 5);

-- Get all followers for a deal
-- SELECT f.*, u.name, u.email
-- FROM Followers f
-- JOIN MasterUsers u ON f.userId = u.masterUserID
-- WHERE f.entityType = 'deal' AND f.entityId = 1;

-- Get all entities a user is following
-- SELECT entityType, entityId, addedAt
-- FROM Followers
-- WHERE userId = 5
-- ORDER BY addedAt DESC;

-- Count followers by entity type
-- SELECT entityType, COUNT(*) as total_followers
-- FROM Followers
-- GROUP BY entityType;

-- ===================================================================
-- ROLLBACK (if needed)
-- ===================================================================
-- DROP TABLE IF EXISTS Followers;
