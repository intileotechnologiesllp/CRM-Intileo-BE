-- Simple individual commands to add missing columns
-- Run these one by one, and skip any that give "Duplicate column name" errors

-- 1. Add assignee column
ALTER TABLE Goals ADD COLUMN assignee VARCHAR(255) NULL COMMENT 'User assigned to the goal';

-- 2. Add assignId column  
ALTER TABLE Goals ADD COLUMN assignId VARCHAR(255) NULL COMMENT 'masterUserID assigned to the goal or everyone';

-- 3. Add trackingMetric column
ALTER TABLE Goals ADD COLUMN trackingMetric VARCHAR(50) NOT NULL DEFAULT 'Count' COMMENT 'Count or Value tracking';

-- 4. Add count column
ALTER TABLE Goals ADD COLUMN count INT NULL COMMENT 'Target count when trackingMetric is Count';

-- 5. Add value column
ALTER TABLE Goals ADD COLUMN value DECIMAL(15,2) NULL COMMENT 'Target value when trackingMetric is Value';

-- 6. Modify dashboardId to allow NULL (this should work without error)
ALTER TABLE Goals MODIFY COLUMN dashboardId INT NULL COMMENT 'Dashboard ID - can be null for standalone goals';

-- 7. Modify endDate to allow NULL (this should work without error)
ALTER TABLE Goals MODIFY COLUMN endDate DATETIME NULL COMMENT 'End date - can be null for indefinite goals';

-- 8. Update existing records (this should work without error)
UPDATE Goals SET trackingMetric = 'Count' WHERE trackingMetric IS NULL OR trackingMetric = '';

-- 9. Check the final structure
DESCRIBE Goals;
