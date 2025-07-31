-- Safe migration script that checks for existing columns before adding them

-- Add assignee column (if it doesn't exist)
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE Goals ADD COLUMN assignee VARCHAR(255) NULL COMMENT ''User assigned to the goal'';',
        'SELECT ''Column assignee already exists'' as Info;'
    )
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'Goals' 
    AND column_name = 'assignee'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add assignId column (if it doesn't exist)
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE Goals ADD COLUMN assignId VARCHAR(255) NULL COMMENT ''masterUserID assigned to the goal or everyone'';',
        'SELECT ''Column assignId already exists'' as Info;'
    )
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'Goals' 
    AND column_name = 'assignId'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add trackingMetric column (if it doesn't exist)
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE Goals ADD COLUMN trackingMetric VARCHAR(50) NOT NULL DEFAULT ''Count'' COMMENT ''Count or Value tracking'';',
        'SELECT ''Column trackingMetric already exists'' as Info;'
    )
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'Goals' 
    AND column_name = 'trackingMetric'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add count column (if it doesn't exist)
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE Goals ADD COLUMN count INT NULL COMMENT ''Target count when trackingMetric is Count'';',
        'SELECT ''Column count already exists'' as Info;'
    )
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'Goals' 
    AND column_name = 'count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add value column (if it doesn't exist)
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE Goals ADD COLUMN value DECIMAL(15,2) NULL COMMENT ''Target value when trackingMetric is Value'';',
        'SELECT ''Column value already exists'' as Info;'
    )
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'Goals' 
    AND column_name = 'value'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Modify dashboardId to allow NULL (if needed)
ALTER TABLE Goals MODIFY COLUMN dashboardId INT NULL COMMENT 'Dashboard ID - can be null for standalone goals';

-- Modify endDate to allow NULL (if needed)
ALTER TABLE Goals MODIFY COLUMN endDate DATETIME NULL COMMENT 'End date - can be null for indefinite goals';

-- Update existing records to have default values for trackingMetric
UPDATE Goals SET trackingMetric = 'Count' WHERE trackingMetric IS NULL OR trackingMetric = '';

-- Show final table structure
DESCRIBE Goals;
