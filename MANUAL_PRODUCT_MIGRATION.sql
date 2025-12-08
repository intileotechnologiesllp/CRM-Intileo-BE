-- =====================================================
-- MANUAL SQL MIGRATION FOR PRODUCT MANAGEMENT
-- Execute these queries one by one in your MySQL client
-- =====================================================

-- Step 1: Create products table
CREATE TABLE IF NOT EXISTS `products` (
  `productId` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT 'Product name',
  `code` VARCHAR(100) DEFAULT NULL COMMENT 'Product code/SKU',
  `description` TEXT DEFAULT NULL COMMENT 'Product description',
  `category` VARCHAR(100) DEFAULT NULL COMMENT 'Product category',
  `unit` VARCHAR(50) DEFAULT NULL COMMENT 'Unit of measurement',
  `prices` JSON DEFAULT NULL COMMENT 'Array of price objects with currency and amount',
  `cost` DECIMAL(15, 2) DEFAULT NULL COMMENT 'Direct cost/purchase price',
  `costCurrency` VARCHAR(10) DEFAULT 'INR' COMMENT 'Currency for cost',
  `billingFrequency` ENUM('one-time', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom') DEFAULT 'one-time' COMMENT 'Billing frequency',
  `billingFrequencyCustom` INT(11) DEFAULT NULL COMMENT 'Custom billing frequency in days',
  `taxType` ENUM('tax-exclusive', 'tax-inclusive', 'no-tax') DEFAULT 'tax-exclusive' COMMENT 'Tax calculation type',
  `taxPercentage` DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Tax percentage',
  `discountType` ENUM('percentage', 'fixed') DEFAULT NULL COMMENT 'Discount type',
  `discountValue` DECIMAL(10, 2) DEFAULT NULL COMMENT 'Discount value',
  `hasVariations` TINYINT(1) DEFAULT 0 COMMENT 'Whether product has variations',
  `isActive` TINYINT(1) DEFAULT 1 COMMENT 'Active status',
  `visibilityGroup` VARCHAR(100) DEFAULT NULL COMMENT 'Visibility group',
  `ownerId` INT(11) NOT NULL COMMENT 'Product owner',
  `companyId` INT(11) DEFAULT NULL COMMENT 'Company/tenant ID',
  `imageUrl` VARCHAR(500) DEFAULT NULL COMMENT 'Product image URL',
  `metadata` JSON DEFAULT NULL COMMENT 'Additional custom fields',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`productId`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_category` (`category`),
  KEY `idx_ownerId` (`ownerId`),
  KEY `idx_isActive` (`isActive`),
  KEY `idx_companyId` (`companyId`),
  CONSTRAINT `fk_products_ownerId` FOREIGN KEY (`ownerId`) REFERENCES `MasterUsers` (`masterUserId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Product catalog table';

-- Step 2: Create product_variations table
CREATE TABLE IF NOT EXISTS `product_variations` (
  `variationId` INT(11) NOT NULL AUTO_INCREMENT,
  `productId` INT(11) NOT NULL COMMENT 'Parent product ID',
  `name` VARCHAR(255) NOT NULL COMMENT 'Variation name',
  `sku` VARCHAR(100) DEFAULT NULL COMMENT 'Stock keeping unit',
  `description` TEXT DEFAULT NULL COMMENT 'Variation description',
  `prices` JSON DEFAULT NULL COMMENT 'Array of price objects',
  `cost` DECIMAL(15, 2) DEFAULT NULL COMMENT 'Direct cost for variation',
  `attributes` JSON DEFAULT NULL COMMENT 'Variation attributes',
  `sortOrder` INT(11) DEFAULT 0 COMMENT 'Display order',
  `isActive` TINYINT(1) DEFAULT 1 COMMENT 'Active status',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`variationId`),
  KEY `idx_productId` (`productId`),
  KEY `idx_sku` (`sku`),
  KEY `idx_isActive` (`isActive`),
  CONSTRAINT `fk_product_variations_productId` FOREIGN KEY (`productId`) REFERENCES `products` (`productId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Product variations/tiers';

-- Step 3: Create deal_products table
CREATE TABLE IF NOT EXISTS `deal_products` (
  `dealProductId` INT(11) NOT NULL AUTO_INCREMENT,
  `dealId` INT(11) NOT NULL COMMENT 'Associated deal ID',
  `productId` INT(11) NOT NULL COMMENT 'Product ID',
  `variationId` INT(11) DEFAULT NULL COMMENT 'Product variation ID',
  `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1.00 COMMENT 'Quantity',
  `unitPrice` DECIMAL(15, 2) NOT NULL COMMENT 'Unit price at time of adding',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR' COMMENT 'Currency code',
  `discountType` ENUM('percentage', 'fixed') DEFAULT NULL COMMENT 'Discount type',
  `discountValue` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Discount value',
  `discountAmount` DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Calculated discount amount',
  `taxType` ENUM('tax-exclusive', 'tax-inclusive', 'no-tax') DEFAULT 'tax-exclusive' COMMENT 'Tax type',
  `taxPercentage` DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Tax percentage',
  `taxAmount` DECIMAL(15, 2) DEFAULT 0.00 COMMENT 'Calculated tax amount',
  `subtotal` DECIMAL(15, 2) DEFAULT NULL COMMENT 'Subtotal (quantity * unitPrice)',
  `total` DECIMAL(15, 2) DEFAULT NULL COMMENT 'Total after discount and tax',
  `billingFrequency` ENUM('one-time', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom') DEFAULT 'one-time' COMMENT 'Billing frequency',
  `billingStartDate` DATE DEFAULT NULL COMMENT 'Billing start date',
  `billingEndDate` DATE DEFAULT NULL COMMENT 'Billing end date',
  `notes` TEXT DEFAULT NULL COMMENT 'Additional notes',
  `sortOrder` INT(11) DEFAULT 0 COMMENT 'Display order',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`dealProductId`),
  KEY `idx_dealId` (`dealId`),
  KEY `idx_productId` (`productId`),
  KEY `idx_variationId` (`variationId`),
  CONSTRAINT `fk_deal_products_dealId` FOREIGN KEY (`dealId`) REFERENCES `Deals` (`dealId`) ON DELETE CASCADE,
  CONSTRAINT `fk_deal_products_productId` FOREIGN KEY (`productId`) REFERENCES `products` (`productId`) ON DELETE RESTRICT,
  CONSTRAINT `fk_deal_products_variationId` FOREIGN KEY (`variationId`) REFERENCES `product_variations` (`variationId`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Products associated with deals';

-- =====================================================
-- VERIFICATION QUERIES (Run after creating tables)
-- =====================================================

-- Verify tables were created
SHOW TABLES LIKE '%product%';

-- Check products table structure
DESCRIBE products;

-- Check product_variations table structure
DESCRIBE product_variations;

-- Check deal_products table structure
DESCRIBE deal_products;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert a sample product (replace ownerId with actual masterUserId)
-- INSERT INTO products (name, code, category, unit, prices, cost, costCurrency, billingFrequency, taxType, taxPercentage, ownerId)
-- VALUES (
--   'Sample Product',
--   'SAMPLE-001',
--   'Software',
--   'license',
--   '[{"currency": "INR", "amount": 10000}, {"currency": "USD", "amount": 120}]',
--   5000,
--   'INR',
--   'monthly',
--   'tax-exclusive',
--   18.00,
--   1  -- Replace with actual masterUserId
-- );

-- =====================================================
-- ROLLBACK QUERIES (Use only if you need to undo)
-- =====================================================

-- DROP TABLE IF EXISTS deal_products;
-- DROP TABLE IF EXISTS product_variations;
-- DROP TABLE IF EXISTS products;
