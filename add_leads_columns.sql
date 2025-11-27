-- SQL queries to add new columns to the Leads table
-- Run these queries in your MySQL database to add the missing columns from deals model

-- Basic columns
ALTER TABLE Leads ADD COLUMN currency VARCHAR(255) NULL;
ALTER TABLE Leads ADD COLUMN pipeline VARCHAR(255) NULL;
ALTER TABLE Leads ADD COLUMN pipelineStage VARCHAR(255) NULL;
ALTER TABLE Leads ADD COLUMN pipelineId INT NULL;
ALTER TABLE Leads ADD COLUMN stageId INT NULL;
ALTER TABLE Leads ADD COLUMN label VARCHAR(255) NULL;
ALTER TABLE Leads ADD COLUMN sourceRequired VARCHAR(255) NULL;
ALTER TABLE Leads ADD COLUMN source VARCHAR(255) NULL;

-- Product and financial columns
ALTER TABLE Leads ADD COLUMN productName VARCHAR(255) NULL COMMENT 'Product or service name for this lead';
ALTER TABLE Leads ADD COLUMN weightedValue FLOAT NULL COMMENT 'Weighted value based on probability and lead value';
ALTER TABLE Leads ADD COLUMN productQuantity INT NULL COMMENT 'Quantity of products in this lead';
ALTER TABLE Leads ADD COLUMN productAmount FLOAT NULL COMMENT 'Total amount for products in this lead';
ALTER TABLE Leads ADD COLUMN MRR FLOAT NULL COMMENT 'Monthly Recurring Revenue';
ALTER TABLE Leads ADD COLUMN ARR FLOAT NULL COMMENT 'Annual Recurring Revenue';
ALTER TABLE Leads ADD COLUMN ACV FLOAT NULL COMMENT 'Annual Contract Value';

-- Date and time tracking columns
ALTER TABLE Leads ADD COLUMN lastStageChange DATETIME NULL COMMENT 'Date when the stage was last changed';
ALTER TABLE Leads ADD COLUMN nextActivityDate DATETIME NULL COMMENT 'Date of the next scheduled activity';
ALTER TABLE Leads ADD COLUMN lastActivityDate DATETIME NULL COMMENT 'Date of the last completed activity';
ALTER TABLE Leads ADD COLUMN wonTime DATETIME NULL COMMENT 'Date when the lead was won';
ALTER TABLE Leads ADD COLUMN lastEmailReceived DATETIME NULL COMMENT 'Date of the last email received from contact';
ALTER TABLE Leads ADD COLUMN lastEmailSent DATETIME NULL COMMENT 'Date of the last email sent to contact';
ALTER TABLE Leads ADD COLUMN lostTime DATETIME NULL COMMENT 'Date when the lead was lost';
ALTER TABLE Leads ADD COLUMN dealClosedOn DATETIME NULL COMMENT 'Date when the lead was closed (won or lost)';

-- Activity tracking columns
ALTER TABLE Leads ADD COLUMN totalActivities INT DEFAULT 0 NULL COMMENT 'Total number of activities associated with this lead';
ALTER TABLE Leads ADD COLUMN doneActivities INT DEFAULT 0 NULL COMMENT 'Number of completed activities';
ALTER TABLE Leads ADD COLUMN activitiesToDo INT DEFAULT 0 NULL COMMENT 'Number of pending activities';
ALTER TABLE Leads ADD COLUMN emailMessagesCount INT DEFAULT 0 NULL COMMENT 'Total number of email messages exchanged';

-- Lead management columns
ALTER TABLE Leads ADD COLUMN lostReason VARCHAR(255) NULL COMMENT 'Reason why the lead was lost';
ALTER TABLE Leads ADD COLUMN archiveStatus VARCHAR(255) NULL COMMENT 'Status of archived leads';
ALTER TABLE Leads ADD COLUMN probability INT DEFAULT 0 NULL COMMENT 'Lead probability percentage (0-100)';
ALTER TABLE Leads ADD COLUMN stage VARCHAR(255) NULL COMMENT 'Current stage in the sales pipeline (replaces pipelineStage)';

-- Add foreign key constraints (optional - run these after adding the columns)
-- ALTER TABLE Leads ADD CONSTRAINT fk_leads_pipeline FOREIGN KEY (pipelineId) REFERENCES pipelines(pipelineId);
-- ALTER TABLE Leads ADD CONSTRAINT fk_leads_stage FOREIGN KEY (stageId) REFERENCES pipeline_stages(stageId);
-- ALTER TABLE Leads ADD CONSTRAINT fk_leads_visibility_group FOREIGN KEY (visibilityGroupId) REFERENCES visibility_groups(groupId);
