-- Migration to add pipelineStage column to Goals table for "Progressed" goal type tracking
-- Run this SQL script in your MySQL database

-- Add pipelineStage column to Goals table
ALTER TABLE Goals 
ADD COLUMN pipelineStage VARCHAR(255) NULL COMMENT 'Specific pipeline stage for Progressed goals - tracks deals entering this stage';

-- Update the description of existing columns for clarity
ALTER TABLE Goals 
MODIFY COLUMN pipeline VARCHAR(255) NULL COMMENT 'Pipeline filter for deals (all goal types)';

-- Add index for better performance on pipeline stage queries
CREATE INDEX idx_goals_pipeline_stage ON Goals(pipelineStage);
CREATE INDEX idx_goals_goal_type_entity ON Goals(goalType, entity);

-- Optional: View updated table structure
-- DESCRIBE Goals;

-- Sample data check (uncomment to verify)
-- SELECT goalId, entity, goalType, pipeline, pipelineStage, trackingMetric, targetValue 
-- FROM Goals 
-- WHERE goalType = 'Progressed' 
-- LIMIT 5;
