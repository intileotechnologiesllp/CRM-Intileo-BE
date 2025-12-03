-- Create company_settings table
CREATE TABLE IF NOT EXISTS `company_settings` (
  `companySettingsId` INT NOT NULL AUTO_INCREMENT,
  `companyName` VARCHAR(255) NOT NULL DEFAULT 'My Company',
  `companyDomain` VARCHAR(63) DEFAULT NULL,
  `preferredMaintenanceTime` JSON DEFAULT NULL COMMENT 'JSON object with day-wise maintenance time slots in UTC. Example: {"monday": ["00:00-03:00", "03:00-06:00"], "tuesday": ["06:00-09:00"]}',
  `timezone` VARCHAR(50) DEFAULT 'UTC' COMMENT 'Company timezone for reporting and scheduling',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`companySettingsId`),
  UNIQUE KEY `company_domain_unique` (`companyDomain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Company-wide settings and configuration';

-- Insert default company settings (if table is empty)
INSERT INTO `company_settings` 
  (`companyName`, `companyDomain`, `preferredMaintenanceTime`, `timezone`, `createdAt`, `updatedAt`)
SELECT 
  'My Company', 
  NULL, 
  NULL, 
  'UTC',
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `company_settings` LIMIT 1);
