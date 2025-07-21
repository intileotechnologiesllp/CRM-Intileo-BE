-- Manual SQL query to add pipelineId foreign key constraint to Deals table
-- Using the exact table name as it exists in your database

-- Step 1: Check if pipelineId column exists, if not add it
-- (Skip this if the column already exists)
ALTER TABLE `Deals` 
ADD COLUMN IF NOT EXISTS `pipelineId` int DEFAULT NULL 
COMMENT 'Foreign key reference to pipelines table';

-- Step 2: Add index for better performance (recommended before adding FK)
ALTER TABLE `Deals` 
ADD INDEX IF NOT EXISTS `idx_deals_pipelineId` (`pipelineId`);

-- Step 3: Add the foreign key constraint
-- Using the exact table name 'Deals' as it exists
ALTER TABLE `Deals` 
ADD CONSTRAINT `fk_deals_pipeline` 
FOREIGN KEY (`pipelineId`) 
REFERENCES `pipelines` (`pipelineId`) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Step 4: (Optional) Add foreign key for stageId if needed
-- ALTER TABLE `deals` 
-- ADD COLUMN IF NOT EXISTS `stageId` int DEFAULT NULL 
-- COMMENT 'Foreign key reference to pipeline_stages table';

-- ALTER TABLE `deals` 
-- ADD INDEX IF NOT EXISTS `idx_deals_stageId` (`stageId`);

-- ALTER TABLE `deals` 
-- ADD CONSTRAINT `fk_deals_stage` 
-- FOREIGN KEY (`stageId`) 
-- REFERENCES `pipeline_stages` (`stageId`) 
-- ON DELETE SET NULL 
-- ON UPDATE CASCADE;
