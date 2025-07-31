-- Manual SQL queries to add missing columns to Goals table
-- Run these queries one by one in your MySQL database

-- First, let's check the current structure of the Goals table
-- DESCRIBE Goals;

-- Add the missing columns to the Goals table
ALTER TABLE Goals 
ADD COLUMN assignee VARCHAR(255) NULL COMMENT 'User assigned to the goal';

ALTER TABLE Goals 
ADD COLUMN assignId VARCHAR(255) NULL COMMENT 'masterUserID assigned to the goal or everyone';

ALTER TABLE Goals 
ADD COLUMN pipeline VARCHAR(255) NULL COMMENT 'Pipeline filter for deals';

ALTER TABLE Goals 
ADD COLUMN trackingMetric VARCHAR(50) NOT NULL DEFAULT 'Count' COMMENT 'Count or Value tracking';

ALTER TABLE Goals 
ADD COLUMN count INT NULL COMMENT 'Target count when trackingMetric is Count';

ALTER TABLE Goals 
ADD COLUMN value DECIMAL(15,2) NULL COMMENT 'Target value when trackingMetric is Value';

-- Modify existing columns to allow NULL values where needed
ALTER TABLE Goals 
MODIFY COLUMN dashboardId INT NULL COMMENT 'Dashboard ID - can be null for standalone goals';

ALTER TABLE Goals 
MODIFY COLUMN endDate DATETIME NULL COMMENT 'End date - can be null for indefinite goals';

-- Update existing records to have default values for new columns
UPDATE Goals SET trackingMetric = 'Count' WHERE trackingMetric IS NULL OR trackingMetric = '';

-- Optional: Check the updated structure
-- DESCRIBE Goals;
