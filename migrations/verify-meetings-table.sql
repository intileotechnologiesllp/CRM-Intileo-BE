-- Verification script for Meetings table
-- Compare this with the actual table structure to ensure all fields and constraints are correct

-- Check if table exists and show structure
SHOW CREATE TABLE `Meetings`;

-- Verify all columns exist
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Meetings'
ORDER BY ORDINAL_POSITION;

-- Verify indexes
SHOW INDEXES FROM `Meetings`;

-- Verify foreign keys
SELECT 
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME,
  DELETE_RULE,
  UPDATE_RULE
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Meetings'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

