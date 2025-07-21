-- Migration: Create pipelines and pipeline_stages tables
-- Date: 2025-01-19

USE crm;

-- Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
    pipelineId INT AUTO_INCREMENT PRIMARY KEY,
    pipelineName VARCHAR(100) NOT NULL,
    description TEXT,
    isDefault BOOLEAN DEFAULT FALSE,
    isActive BOOLEAN DEFAULT TRUE,
    color VARCHAR(7) DEFAULT '#007BFF',
    displayOrder INT DEFAULT 0,
    masterUserID INT NOT NULL,
    createdBy INT NOT NULL,
    updatedBy INT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_masterUserID (masterUserID),
    INDEX idx_isActive (isActive),
    INDEX idx_isDefault (isDefault),
    FOREIGN KEY (masterUserID) REFERENCES masterusers(masterUserID) ON DELETE CASCADE
);

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
    stageId INT AUTO_INCREMENT PRIMARY KEY,
    pipelineId INT NOT NULL,
    stageName VARCHAR(100) NOT NULL,
    stageOrder INT NOT NULL DEFAULT 0,
    probability DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (probability >= 0 AND probability <= 100),
    dealRottenDays INT COMMENT 'Number of days after which deals in this stage are considered rotten',
    color VARCHAR(7) DEFAULT '#28A745',
    isActive BOOLEAN DEFAULT TRUE,
    masterUserID INT NOT NULL,
    createdBy INT NOT NULL,
    updatedBy INT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pipelineId (pipelineId),
    INDEX idx_masterUserID (masterUserID),
    INDEX idx_isActive (isActive),
    INDEX idx_stageOrder (stageOrder),
    FOREIGN KEY (pipelineId) REFERENCES pipelines(pipelineId) ON DELETE CASCADE,
    FOREIGN KEY (masterUserID) REFERENCES masterusers(masterUserID) ON DELETE CASCADE
);

-- Insert default pipeline for existing users
INSERT INTO pipelines (pipelineName, description, isDefault, isActive, color, displayOrder, masterUserID, createdBy)
SELECT 
    'Sales Pipeline' as pipelineName,
    'Default sales pipeline for managing deals' as description,
    TRUE as isDefault,
    TRUE as isActive,
    '#007BFF' as color,
    0 as displayOrder,
    masterUserID,
    masterUserID as createdBy
FROM masterusers 
WHERE NOT EXISTS (
    SELECT 1 FROM pipelines WHERE pipelines.masterUserID = masterusers.masterUserID AND isDefault = TRUE
);

-- Insert default stages for each default pipeline
INSERT INTO pipeline_stages (pipelineId, stageName, stageOrder, probability, dealRottenDays, color, isActive, masterUserID, createdBy)
SELECT 
    p.pipelineId,
    stage_data.stageName,
    stage_data.stageOrder,
    stage_data.probability,
    stage_data.dealRottenDays,
    stage_data.color,
    TRUE as isActive,
    p.masterUserID,
    p.createdBy
FROM pipelines p
CROSS JOIN (
    SELECT 'Qualified' as stageName, 1 as stageOrder, 10.00 as probability, 30 as dealRottenDays, '#FFC107' as color
    UNION ALL
    SELECT 'Contact Made', 2, 20.00, 21, '#17A2B8'
    UNION ALL
    SELECT 'Demo Scheduled', 3, 40.00, 14, '#6F42C1'
    UNION ALL
    SELECT 'Proposal Made', 4, 75.00, 7, '#FD7E14'
    UNION ALL
    SELECT 'Negotiations Started', 5, 90.00, 5, '#E83E8C'
    UNION ALL
    SELECT 'Won', 6, 100.00, NULL, '#28A745'
    UNION ALL
    SELECT 'Lost', 7, 0.00, NULL, '#DC3545'
) stage_data
WHERE p.isDefault = TRUE
AND NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps 
    WHERE ps.pipelineId = p.pipelineId 
    AND ps.stageName = stage_data.stageName
);
