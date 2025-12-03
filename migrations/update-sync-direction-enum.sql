-- Update syncDirection ENUM to support one_way and two_way values
-- Run this SQL in your database

ALTER TABLE `contactSyncHistories` 
MODIFY COLUMN `syncDirection` ENUM(
  'google_to_crm', 
  'crm_to_google', 
  'bidirectional', 
  'one_way', 
  'two_way'
) NOT NULL;
