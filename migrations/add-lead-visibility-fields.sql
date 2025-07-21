-- Migration: Add visibility fields to Lead table
-- This migration adds visibility management fields to support the visibility groups system

ALTER TABLE leads 
ADD COLUMN visibilityLevel ENUM('owner_only', 'group_only', 'everyone', 'item_owners_visibility_group') 
DEFAULT 'item_owners_visibility_group' 
COMMENT 'Visibility level for the lead';

ALTER TABLE leads 
ADD COLUMN visibilityGroupId INT NULL 
COMMENT 'Reference to the owner\'s visibility group';

-- Add foreign key constraint for visibilityGroupId
ALTER TABLE leads 
ADD CONSTRAINT fk_leads_visibility_group 
FOREIGN KEY (visibilityGroupId) REFERENCES visibility_groups(id) 
ON DELETE SET NULL ON UPDATE CASCADE;

-- Update existing leads to have default visibility settings
-- Set visibilityGroupId based on the owner's current group membership
UPDATE leads l
LEFT JOIN group_memberships gm ON l.ownerId = gm.userId AND gm.isActive = 1
SET l.visibilityGroupId = gm.groupId
WHERE l.visibilityGroupId IS NULL;

-- For leads without group membership, keep visibilityGroupId as NULL
-- These will use the default visibility behavior
