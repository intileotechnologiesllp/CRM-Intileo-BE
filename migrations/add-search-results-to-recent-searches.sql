-- Migration: Add searchResults column to RecentSearches table
-- Date: 2025-07-21
-- Purpose: Store search results with recent searches for quick access

-- Add searchResults column to store JSON data of search results
ALTER TABLE `RecentSearches` 
ADD COLUMN `searchResults` TEXT NULL 
COMMENT 'JSON string containing the search results for quick access'
AFTER `resultsCount`;

-- Update existing records to have NULL searchResults (they can be populated on next search)
-- No action needed as new column is nullable

-- Create index for better performance when filtering by results availability
ALTER TABLE `RecentSearches` 
ADD INDEX `idx_recent_searches_has_results` (`masterUserID`, `resultsCount`, `searchedAt`);

-- Optional: Clean up old searches without results to make room for new enhanced searches
-- DELETE FROM `RecentSearches` WHERE `resultsCount` = 0 AND `searchedAt` < DATE_SUB(NOW(), INTERVAL 7 DAY);

COMMIT;
