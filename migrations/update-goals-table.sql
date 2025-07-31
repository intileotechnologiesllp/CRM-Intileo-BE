-- Migration to update Goals table with new fields for enhanced goal functionality
-- Add new columns to support multi-step goal creation flow

ALTER TABLE Goals 
MODIFY COLUMN dashboardId INT NULL;

ALTER TABLE Goals 
ADD COLUMN assignee VARCHAR(255) NULL COMMENT 'User assigned to the goal';

ALTER TABLE Goals 
ADD COLUMN pipeline VARCHAR(255) NULL COMMENT 'Pipeline filter for deals';

ALTER TABLE Goals 
ADD COLUMN trackingMetric VARCHAR(50) NOT NULL DEFAULT 'Count' COMMENT 'Count or Value tracking';

ALTER TABLE Goals 
ADD COLUMN assignId VARCHAR(255) NULL COMMENT 'masterUserID assigned to the goal or everyone';

ALTER TABLE Goals 
ADD COLUMN count INT NULL COMMENT 'Target count when trackingMetric is Count';

ALTER TABLE Goals 
ADD COLUMN value DECIMAL(15,2) NULL COMMENT 'Target value when trackingMetric is Value';

-- Update existing records to have default values
UPDATE Goals SET trackingMetric = 'Count' WHERE trackingMetric IS NULL;
