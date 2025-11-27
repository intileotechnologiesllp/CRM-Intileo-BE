-- Migration to add textBody and htmlBody columns to emails table
-- Created: 2025-08-29

ALTER TABLE emails
ADD COLUMN textBody LONGTEXT NULL COMMENT 'Plain text version of email body',
ADD COLUMN htmlBody LONGTEXT NULL COMMENT 'HTML version of email body';

-- Add index for better query performance if needed
-- CREATE INDEX idx_emails_textBody ON emails(textBody(255));
-- CREATE INDEX idx_emails_htmlBody ON emails(htmlBody(255));
