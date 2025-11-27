-- Add body_fetch_status column to emails table
-- Run this manually in your MySQL database

-- First, check if the column already exists
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'emails' AND COLUMN_NAME = 'body_fetch_status';

-- Add the column if it doesn't exist
ALTER TABLE emails 
ADD COLUMN body_fetch_status ENUM('pending', 'completed', 'failed') 
DEFAULT 'pending' 
COMMENT 'Status of email body fetching for on-demand loading';

-- Update existing emails to have 'completed' status if they already have body content
UPDATE emails 
SET body_fetch_status = 'completed' 
WHERE body IS NOT NULL AND body != '';

-- Verify the column was added
DESCRIBE emails;