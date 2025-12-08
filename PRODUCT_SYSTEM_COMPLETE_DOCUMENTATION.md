# Complete Product Management System - Technical Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Tax Calculation System](#tax-calculation-system)
4. [Discount System](#discount-system)
5. [Revenue Calculations](#revenue-calculations)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Code Architecture](#code-architecture)
8. [Implementation Details](#implementation-details)

---

## 1. System Overview

### What Was Built
A complete product management system for CRM similar to Pipedrive, allowing:
- Product catalog management (CRUD operations)
- Product variations/tiers (Basic, Pro, Enterprise plans)
- Flexible pricing with multiple currencies
- Connection of products to deals
- Automatic tax and discount calculations
- Revenue metrics (MRR, ARR, ACV, TCV)
- Billing frequency management (one-time, monthly, quarterly, annually, etc.)

### Key Features
✅ Multi-currency pricing stored as JSON  
✅ Three tax calculation modes (exclusive, inclusive, no-tax)  
✅ Two discount types (percentage, fixed amount)  
✅ Product variations for different tiers  
✅ Automatic revenue calculations  
✅ Deal-level tax settings  
✅ Product search with autocomplete  

---

## 2. Database Schema

### 2.1 Products Table
Main product catalog storing all product information.

```sql
CREATE TABLE `products` (
  `productId` INT(11) AUTO_INCREMENT PRIMARY KEY,
  
  -- Basic Information
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) UNIQUE,
  `description` TEXT,
  `category` VARCHAR(100),
  `unit` VARCHAR(50),  -- e.g., "pcs", "hours", "subscription"
  
  -- Pricing (JSON array for multi-currency)
  `prices` JSON,  -- [{"currency": "INR", "amount": 10000}, {"currency": "USD", "amount": 120}]
  `cost` DECIMAL(15, 2),  -- Direct cost/purchase price
  `costCurrency` VARCHAR(10) DEFAULT 'INR',
  
  -- Billing Configuration
  `billingFrequency` ENUM('one-time', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom') DEFAULT 'one-time',
  `billingFrequencyCustom` INT(11),  -- Custom frequency in days
  
  -- Tax Settings (Default for this product)
  `taxType` ENUM('tax-exclusive', 'tax-inclusive', 'no-tax') DEFAULT 'tax-exclusive',
  `taxPercentage` DECIMAL(5, 2) DEFAULT 0.00,
  
  -- Discount Settings (Default for this product)
  `discountType` ENUM('percentage', 'fixed'),
  `discountValue` DECIMAL(10, 2),
  
  -- Variations
  `hasVariations` TINYINT(1) DEFAULT 0,
  
  -- Status & Permissions
  `isActive` TINYINT(1) DEFAULT 1,
  `visibilityGroup` VARCHAR(100),
  `ownerId` INT(11) NOT NULL,  -- FK to MasterUsers
  `companyId` INT(11),  -- For multi-tenancy
  
  -- Additional
  `imageUrl` VARCHAR(500),
  `metadata` JSON,  -- Custom fields
  
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`ownerId`) REFERENCES `MasterUsers` (`masterUserId`) ON DELETE CASCADE
);
```

**Key Design Decisions:**
- **JSON for prices**: Allows multiple currencies per product without additional tables
- **ENUM for tax/billing**: Ensures data consistency and prevents invalid values
- **Soft delete via isActive**: Preserves historical data
- **metadata JSON**: Allows custom fields without schema changes

### 2.2 Product Variations Table
Stores different tiers/options for a product (e.g., Basic/Pro/Enterprise).

```sql
CREATE TABLE `product_variations` (
  `variationId` INT(11) AUTO_INCREMENT PRIMARY KEY,
  `productId` INT(11) NOT NULL,  -- FK to products
  
  `name` VARCHAR(255) NOT NULL,  -- e.g., "Pro Plan", "Red Color"
  `sku` VARCHAR(100),  -- Stock keeping unit
  `description` TEXT,
  
  -- Pricing specific to this variation
  `prices` JSON,  -- [{"currency": "INR", "amount": 5000}]
  `cost` DECIMAL(15, 2),
  
  -- Variation attributes (flexible JSON)
  `attributes` JSON,  -- {"storage": "100GB", "users": "10", "color": "red"}
  
  `sortOrder` INT(11) DEFAULT 0,
  `isActive` TINYINT(1) DEFAULT 1,
  
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`productId`) REFERENCES `products` (`productId`) ON DELETE CASCADE
);
```

**Why Variations?**
- SaaS products: Basic, Pro, Enterprise plans
- Physical products: Different colors, sizes, materials
- Services: Different service levels

### 2.3 Deal Products Table (Junction Table)
Links products to deals with snapshot of pricing at time of sale.

```sql
CREATE TABLE `deal_products` (
  `dealProductId` INT(11) AUTO_INCREMENT PRIMARY KEY,
  
  -- Relationships
  `dealId` INT(11) NOT NULL,  -- FK to Deals
  `productId` INT(11) NOT NULL,  -- FK to products
  `variationId` INT(11),  -- FK to product_variations (optional)
  
  -- Quantity & Pricing (snapshot at time of adding)
  `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  `unitPrice` DECIMAL(15, 2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  
  -- Discount (can differ from product default)
  `discountType` ENUM('percentage', 'fixed'),
  `discountValue` DECIMAL(10, 2) DEFAULT 0.00,
  `discountAmount` DECIMAL(15, 2) DEFAULT 0.00,  -- Calculated
  
  -- Tax (can differ from product default)
  `taxType` ENUM('tax-exclusive', 'tax-inclusive', 'no-tax') DEFAULT 'tax-exclusive',
  `taxPercentage` DECIMAL(5, 2) DEFAULT 0.00,
  `taxAmount` DECIMAL(15, 2) DEFAULT 0.00,  -- Calculated
  
  -- Calculated Totals
  `subtotal` DECIMAL(15, 2),  -- quantity × unitPrice
  `total` DECIMAL(15, 2),  -- After discount and tax
  
  -- Billing
  `billingFrequency` ENUM('one-time', 'monthly', 'quarterly', 'semi-annually', 'annually', 'custom') DEFAULT 'one-time',
  `billingStartDate` DATE,
  `billingEndDate` DATE,
  
  `notes` TEXT,
  `sortOrder` INT(11) DEFAULT 0,
  
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`dealId`) REFERENCES `Deals` (`dealId`) ON DELETE CASCADE,
  FOREIGN KEY (`productId`) REFERENCES `products` (`productId`) ON DELETE RESTRICT,
  FOREIGN KEY (`variationId`) REFERENCES `product_variations` (`variationId`) ON DELETE SET NULL
);
```

**Why Snapshot Pricing?**
- Product prices may change over time
- Deals need historical pricing accuracy
- Allows custom pricing per deal
- Audit trail for sales

---

## 3. Tax Calculation System

### 3.1 Tax Types

#### **Tax-Exclusive** (Tax Added On Top)
Tax is calculated and **added to** the base price.

**Formula:**
```
Base Price = Quantity × Unit Price - Discount
Tax Amount = Base Price × (Tax Percentage / 100)
Total = Base Price + Tax Amount
```

**Example:**
```javascript
// Input
quantity = 5
unitPrice = 100
discount = 10% = 10
taxPercentage = 18%

// Calculation
subtotal = 5 × 100 = 500
discountAmount = 500 × 0.10 = 50
basePrice = 500 - 50 = 450
taxAmount = 450 × 0.18 = 81
total = 450 + 81 = 531

// Result: Customer pays $531
// (Base: $450 + Tax: $81)
```

**Code Implementation:**
```javascript
if (taxType === "tax-exclusive") {
  const amountAfterDiscount = subtotal - discountAmount;
  taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 100;
  total = amountAfterDiscount + taxAmount;
}
```

**Use Cases:**
- Most common in B2B sales
- USA sales tax
- Indian GST (shown separately)
- When tax must be itemized on invoice

#### **Tax-Inclusive** (Tax Included In Price)
Tax is **already included** in the stated price.

**Formula:**
```
Total Price = Quantity × Unit Price - Discount
Tax Amount = Total Price × (Tax Percentage / (100 + Tax Percentage))
Base Price = Total Price - Tax Amount
```

**Example:**
```javascript
// Input
quantity = 1
unitPrice = 118  // Already includes 18% tax
discount = 0
taxPercentage = 18%

// Calculation
subtotal = 1 × 118 = 118
discountAmount = 0
total = 118  // This is the final price
taxAmount = 118 × (18 / 118) = 18
basePrice = 118 - 18 = 100

// Result: Customer pays $118
// (Base: $100, Tax: $18 hidden inside)
```

**Code Implementation:**
```javascript
if (taxType === "tax-inclusive") {
  const amountAfterDiscount = subtotal - discountAmount;
  taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 
              (100 + parseFloat(taxPercentage || 0));
  total = amountAfterDiscount;  // Tax already included
}
```

**Use Cases:**
- B2C (Business to Consumer)
- European VAT
- Australian GST
- Retail pricing where "price shown is price paid"

#### **No Tax**
No tax is applied.

**Formula:**
```
Total = Quantity × Unit Price - Discount
Tax Amount = 0
```

**Example:**
```javascript
// Input
quantity = 2
unitPrice = 100
discount = 20 (fixed)
taxPercentage = 0

// Calculation
subtotal = 2 × 100 = 200
discountAmount = 20
total = 200 - 20 = 180
taxAmount = 0

// Result: Customer pays $180
```

**Code Implementation:**
```javascript
if (taxType === "no-tax") {
  const amountAfterDiscount = subtotal - discountAmount;
  taxAmount = 0;
  total = amountAfterDiscount;
}
```

**Use Cases:**
- Tax-exempt organizations
- International sales (some cases)
- Educational institutions
- Government contracts

### 3.2 Tax Configuration

#### Product-Level Tax (Default)
Set when creating/editing product:
```json
{
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}
```

#### Deal-Level Tax Override
When adding product to deal, can override:
```json
{
  "productId": 1,
  "quantity": 5,
  "taxType": "tax-inclusive",  // Override
  "taxPercentage": 12           // Override
}
```

#### Deal-Wide Tax Settings
Update all products in a deal at once:
```http
POST /api/products/deal/123/tax-settings
{
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}
```

---

## 4. Discount System

### 4.1 Discount Types

#### **Percentage Discount**
Discount calculated as a percentage of the subtotal.

**Formula:**
```
Discount Amount = Subtotal × (Discount Percentage / 100)
Amount After Discount = Subtotal - Discount Amount
```

**Example:**
```javascript
// Input
subtotal = 1000
discountType = "percentage"
discountValue = 15  // 15%

// Calculation
discountAmount = 1000 × 0.15 = 150
amountAfterDiscount = 1000 - 150 = 850

// Savings: $150 (15% off)
```

**Code Implementation:**
```javascript
if (discountType === "percentage") {
  discountAmount = (subtotal * parseFloat(discountValue)) / 100;
}
```

**Use Cases:**
- Volume discounts (10% off for 100+ units)
- Seasonal sales (20% off)
- Early bird discounts
- Loyalty programs

#### **Fixed Discount**
Fixed amount deducted from subtotal.

**Formula:**
```
Discount Amount = Discount Value (fixed)
Amount After Discount = Subtotal - Discount Amount
```

**Example:**
```javascript
// Input
subtotal = 1000
discountType = "fixed"
discountValue = 200  // $200 off

// Calculation
discountAmount = 200
amountAfterDiscount = 1000 - 200 = 800

// Savings: $200
```

**Code Implementation:**
```javascript
if (discountType === "fixed") {
  discountAmount = parseFloat(discountValue);
}
```

**Use Cases:**
- Coupon codes ($50 off)
- Negotiated discounts
- Promotional offers
- Referral bonuses

### 4.2 Discount Configuration

#### Product-Level Discount (Default)
```json
{
  "discountType": "percentage",
  "discountValue": 10
}
```

#### Per-Deal Product Discount
```json
{
  "productId": 1,
  "quantity": 5,
  "discountType": "fixed",
  "discountValue": 500
}
```

#### Discount Description Field
Rich text field for explaining discount:
```json
{
  "notes": "Enterprise discount - 15% off annual subscription"
}
```

### 4.3 Complete Calculation Flow

**Order of Operations:**
1. Calculate Subtotal (Quantity × Unit Price)
2. Apply Discount (Percentage or Fixed)
3. Calculate Tax (on discounted amount)
4. Get Final Total

**Example with Both:**
```javascript
// Input
quantity = 10
unitPrice = 100
discountType = "percentage"
discountValue = 20  // 20% off
taxType = "tax-exclusive"
taxPercentage = 18

// Step 1: Subtotal
subtotal = 10 × 100 = 1000

// Step 2: Discount
discountAmount = 1000 × 0.20 = 200
afterDiscount = 1000 - 200 = 800

// Step 3: Tax
taxAmount = 800 × 0.18 = 144

// Step 4: Total
total = 800 + 144 = 944

// Summary:
// Subtotal:  $1,000
// Discount:  -$200
// Subtotal:  $800
// Tax (18%): +$144
// Total:     $944
```

**Code Implementation:**
```javascript
// 1. Calculate subtotal
const subtotal = parseFloat(quantity) * parseFloat(unitPrice);

// 2. Calculate discount
let discountAmount = 0;
if (discountType === "percentage") {
  discountAmount = (subtotal * parseFloat(discountValue)) / 100;
} else if (discountType === "fixed") {
  discountAmount = parseFloat(discountValue);
}

// 3. Amount after discount
const amountAfterDiscount = subtotal - discountAmount;

// 4. Calculate tax
let taxAmount = 0;
let total = amountAfterDiscount;

if (taxType === "tax-exclusive") {
  taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 100;
  total = amountAfterDiscount + taxAmount;
} else if (taxType === "tax-inclusive") {
  taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 
              (100 + parseFloat(taxPercentage || 0));
  total = amountAfterDiscount;
} else if (taxType === "no-tax") {
  taxAmount = 0;
  total = amountAfterDiscount;
}

// 5. Store all calculated values
await DealProduct.create({
  subtotal,
  discountAmount,
  taxAmount,
  total,
  // ... other fields
});
```

---

## 5. Revenue Calculations

### 5.1 Revenue Metrics

#### **MRR (Monthly Recurring Revenue)**
Total monthly income from recurring subscriptions.

**Calculation:**
```javascript
// For each product in deal
if (billingFrequency === "monthly") {
  MRR += productTotal;
} else if (billingFrequency === "quarterly") {
  MRR += productTotal / 3;
} else if (billingFrequency === "semi-annually") {
  MRR += productTotal / 6;
} else if (billingFrequency === "annually") {
  MRR += productTotal / 12;
}
// one-time products don't contribute to MRR
```

**Example:**
```javascript
// Deal has:
// Product A: $300/month (monthly)
// Product B: $1,200/quarter (quarterly)
// Product C: $2,000 one-time

MRR = 300 + (1200 / 3) + 0 = 700

// Total MRR: $700/month
```

#### **ARR (Annual Recurring Revenue)**
Total annual income from recurring subscriptions.

**Formula:**
```
ARR = MRR × 12
```

**Example:**
```javascript
MRR = 700
ARR = 700 × 12 = 8,400

// Total ARR: $8,400/year
```

#### **ACV (Annual Contract Value)**
Total value expected in first year (recurring + one-time).

**Formula:**
```
ACV = ARR + One-time Revenue
```

**Example:**
```javascript
ARR = 8,400
oneTimeRevenue = 2,000
ACV = 8,400 + 2,000 = 10,400

// Total ACV: $10,400
```

#### **TCV (Total Contract Value)**
Total value over entire contract period.

**Calculation:**
```javascript
// If has billing start/end dates
const monthsDiff = (endDate - startDate) in months;

if (billingFrequency === "monthly") {
  TCV += productTotal × monthsDiff;
} else if (billingFrequency === "quarterly") {
  TCV += productTotal × Math.ceil(monthsDiff / 3);
} else if (billingFrequency === "annually") {
  TCV += productTotal × Math.ceil(monthsDiff / 12);
}
```

**Example:**
```javascript
// Product: $300/month
// Contract: Jan 1, 2025 - Dec 31, 2026 (24 months)

TCV = 300 × 24 = 7,200

// Total TCV: $7,200
```

### 5.2 Code Implementation

```javascript
exports.getDealProducts = async (req, res) => {
  const dealProducts = await DealProduct.findAll({ where: { dealId } });
  
  const calculations = dealProducts.reduce((acc, dp) => {
    const total = parseFloat(dp.total || 0);
    const billingFrequency = dp.billingFrequency;
    
    // MRR Calculation
    if (billingFrequency === "monthly") {
      acc.monthlyRecurringRevenue += total;
      acc.annualRecurringRevenue += total * 12;
    } else if (billingFrequency === "quarterly") {
      acc.monthlyRecurringRevenue += total / 3;
      acc.annualRecurringRevenue += total * 4;
    } else if (billingFrequency === "semi-annually") {
      acc.monthlyRecurringRevenue += total / 6;
      acc.annualRecurringRevenue += total * 2;
    } else if (billingFrequency === "annually") {
      acc.monthlyRecurringRevenue += total / 12;
      acc.annualRecurringRevenue += total;
    } else {
      // one-time
      acc.oneTimeRevenue += total;
    }
    
    // TCV Calculation
    if (dp.billingStartDate && dp.billingEndDate) {
      const startDate = new Date(dp.billingStartDate);
      const endDate = new Date(dp.billingEndDate);
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 
        + (endDate.getMonth() - startDate.getMonth());
      
      if (billingFrequency === "monthly" && monthsDiff > 0) {
        acc.totalContractValue += total * monthsDiff;
      } else if (billingFrequency === "quarterly" && monthsDiff > 0) {
        acc.totalContractValue += total * Math.ceil(monthsDiff / 3);
      } else if (billingFrequency === "annually" && monthsDiff > 0) {
        acc.totalContractValue += total * Math.ceil(monthsDiff / 12);
      }
    }
    
    return acc;
  }, {
    monthlyRecurringRevenue: 0,
    annualRecurringRevenue: 0,
    oneTimeRevenue: 0,
    totalContractValue: 0,
  });
  
  // ACV = ARR + One-time
  calculations.annualContractValue = 
    calculations.annualRecurringRevenue + calculations.oneTimeRevenue;
  
  return calculations;
};
```

---

## 6. API Endpoints Reference

### 6.1 Product Management

#### Create Product
```http
POST /api/products/create
Authorization: Bearer <token>

{
  "name": "CRM Software",
  "code": "CRM-001",
  "category": "Software",
  "unit": "license",
  "prices": [
    {"currency": "INR", "amount": 50000},
    {"currency": "USD", "amount": 600}
  ],
  "cost": 10000,
  "costCurrency": "INR",
  "billingFrequency": "monthly",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "discountType": "percentage",
  "discountValue": 10,
  "hasVariations": true,
  "variations": [
    {
      "name": "Basic Plan",
      "sku": "CRM-001-BASIC",
      "prices": [{"currency": "INR", "amount": 25000}],
      "attributes": {"users": "5", "storage": "10GB"}
    },
    {
      "name": "Pro Plan",
      "sku": "CRM-001-PRO",
      "prices": [{"currency": "INR", "amount": 50000}],
      "attributes": {"users": "25", "storage": "100GB"}
    }
  ]
}
```

#### Get Products
```http
GET /api/products/get?page=1&limit=20&search=crm&category=Software
Authorization: Bearer <token>
```

#### Get Single Product
```http
GET /api/products/get/1
Authorization: Bearer <token>
```

#### Update Product
```http
POST /api/products/update/1
Authorization: Bearer <token>

{
  "taxPercentage": 18,
  "discountValue": 15
}
```

#### Delete Product
```http
POST /api/products/delete/1
Authorization: Bearer <token>
```

#### Get Categories
```http
GET /api/products/categories
Authorization: Bearer <token>
```

### 6.2 Deal-Product Integration

#### Search Products
```http
GET /api/products/search?query=crm&limit=10
Authorization: Bearer <token>
```

#### Add Product to Deal
```http
POST /api/products/deal/add
Authorization: Bearer <token>

{
  "dealId": 123,
  "productId": 1,
  "variationId": 2,
  "quantity": 10,
  "unitPrice": 50000,
  "currency": "INR",
  "discountType": "percentage",
  "discountValue": 15,
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "monthly",
  "billingStartDate": "2025-01-01",
  "billingEndDate": "2026-12-31",
  "notes": "Enterprise discount"
}
```

**Automatic Calculations:**
```
Subtotal: 10 × 50,000 = 500,000
Discount (15%): 500,000 × 0.15 = 75,000
After Discount: 500,000 - 75,000 = 425,000
Tax (18%): 425,000 × 0.18 = 76,500
Total: 425,000 + 76,500 = 501,500
```

#### Get Deal Products
```http
GET /api/products/deal/123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "products": [
      {
        "dealProductId": 1,
        "productId": 1,
        "quantity": 10,
        "unitPrice": 50000,
        "subtotal": 500000,
        "discountAmount": 75000,
        "taxAmount": 76500,
        "total": 501500,
        "billingFrequency": "monthly",
        "product": {
          "name": "CRM Software",
          "code": "CRM-001"
        }
      }
    ],
    "summary": {
      "subtotalExcludingTax": "500000.00",
      "totalDiscount": "75000.00",
      "totalTax": "76500.00",
      "totalWithTax": "501500.00"
    },
    "revenue": {
      "monthlyRecurringRevenue": "501500.00",
      "annualRecurringRevenue": "6018000.00",
      "annualContractValue": "6018000.00",
      "totalContractValue": "12036000.00"
    }
  }
}
```

#### Update Deal Product
```http
POST /api/products/deal/update/1
Authorization: Bearer <token>

{
  "quantity": 15,
  "discountValue": 20
}
```

**Automatic Recalculation:**
```
New Subtotal: 15 × 50,000 = 750,000
New Discount (20%): 750,000 × 0.20 = 150,000
After Discount: 750,000 - 150,000 = 600,000
Tax (18%): 600,000 × 0.18 = 108,000
New Total: 600,000 + 108,000 = 708,000
```

#### Update Deal Tax Settings
```http
POST /api/products/deal/123/tax-settings
Authorization: Bearer <token>

{
  "taxType": "tax-inclusive",
  "taxPercentage": 12
}
```

#### Remove Product from Deal
```http
POST /api/products/deal/remove/1
Authorization: Bearer <token>
```

---

## 7. Code Architecture

### 7.1 File Structure
```
crm-intileo/
├── models/
│   └── product/
│       ├── productModel.js           # Product catalog
│       ├── productVariationModel.js  # Product tiers
│       └── dealProductModel.js       # Deal-product junction
├── controllers/
│   └── product/
│       └── productController.js      # All business logic
├── routes/
│   └── product/
│       └── productRoutes.js          # API endpoints
├── migrations/
│   ├── create_product_tables.sql    # Original migration
│   └── MANUAL_PRODUCT_MIGRATION.sql # Corrected migration
└── documentation/
    ├── PRODUCT_MANAGEMENT_README.md
    ├── PRODUCT_API_REQUEST_BODIES.md
    ├── PRODUCT_SETUP_GUIDE.md
    ├── PRODUCT_API_TESTING_GUIDE.md
    └── DEAL_PRODUCT_INTEGRATION.md
```

### 7.2 Model Associations

```javascript
// Product → ProductVariation (One-to-Many)
Product.hasMany(ProductVariation, {
  foreignKey: "productId",
  as: "variations",
});

// Product → DealProduct (One-to-Many)
Product.hasMany(DealProduct, {
  foreignKey: "productId",
  as: "dealProducts",
});

// Deal → DealProduct (One-to-Many)
Deal.hasMany(DealProduct, {
  foreignKey: "dealId",
  as: "products",
});

// ProductVariation → DealProduct (One-to-Many)
ProductVariation.hasMany(DealProduct, {
  foreignKey: "variationId",
  as: "dealProducts",
});

// MasterUser → Product (One-to-Many)
Product.belongsTo(MasterUser, {
  foreignKey: "ownerId",
  as: "owner",
});
```

### 7.3 Controller Functions

```javascript
// Product CRUD
exports.createProduct         // POST /api/products/create
exports.getProducts           // GET /api/products/get
exports.getProductById        // GET /api/products/get/:id
exports.updateProduct         // POST /api/products/update/:id
exports.deleteProduct         // POST /api/products/delete/:id
exports.getCategories         // GET /api/products/categories

// Deal Integration
exports.addProductToDeal      // POST /api/products/deal/add
exports.getDealProducts       // GET /api/products/deal/:dealId
exports.updateDealProduct     // POST /api/products/deal/update/:id
exports.removeDealProduct     // POST /api/products/deal/remove/:id
exports.updateDealTaxSettings // POST /api/products/deal/:dealId/tax-settings
exports.searchProducts        // GET /api/products/search
```

---

## 8. Implementation Details

### 8.1 Tax Calculation Function

```javascript
function calculateTax(amountAfterDiscount, taxType, taxPercentage) {
  let taxAmount = 0;
  let total = amountAfterDiscount;
  
  if (taxType === "tax-exclusive") {
    // Tax added on top
    taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 100;
    total = amountAfterDiscount + taxAmount;
    
  } else if (taxType === "tax-inclusive") {
    // Tax already included
    taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 
                (100 + parseFloat(taxPercentage || 0));
    total = amountAfterDiscount; // No change to total
    
  } else if (taxType === "no-tax") {
    // No tax
    taxAmount = 0;
    total = amountAfterDiscount;
  }
  
  return { taxAmount, total };
}
```

### 8.2 Discount Calculation Function

```javascript
function calculateDiscount(subtotal, discountType, discountValue) {
  let discountAmount = 0;
  
  if (discountType === "percentage") {
    // Percentage of subtotal
    discountAmount = (subtotal * parseFloat(discountValue)) / 100;
    
  } else if (discountType === "fixed") {
    // Fixed amount
    discountAmount = parseFloat(discountValue);
  }
  
  return discountAmount;
}
```

### 8.3 Complete Add Product Flow

```javascript
exports.addProductToDeal = async (req, res) => {
  const {
    dealId, productId, variationId, quantity, unitPrice,
    currency, discountType, discountValue,
    taxType, taxPercentage, billingFrequency,
    billingStartDate, billingEndDate, notes
  } = req.body;
  
  // Step 1: Calculate subtotal
  const subtotal = parseFloat(quantity) * parseFloat(unitPrice);
  
  // Step 2: Calculate discount
  let discountAmount = 0;
  if (discountType === "percentage") {
    discountAmount = (subtotal * parseFloat(discountValue)) / 100;
  } else if (discountType === "fixed") {
    discountAmount = parseFloat(discountValue);
  }
  
  // Step 3: Amount after discount
  const amountAfterDiscount = subtotal - discountAmount;
  
  // Step 4: Calculate tax
  let taxAmount = 0;
  let total = amountAfterDiscount;
  
  if (taxType === "tax-exclusive") {
    taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 100;
    total = amountAfterDiscount + taxAmount;
  } else if (taxType === "tax-inclusive") {
    taxAmount = (amountAfterDiscount * parseFloat(taxPercentage || 0)) / 
                (100 + parseFloat(taxPercentage || 0));
    total = amountAfterDiscount;
  }
  
  // Step 5: Save to database
  const dealProduct = await DealProduct.create({
    dealId, productId, variationId, quantity, unitPrice, currency,
    discountType, discountValue, discountAmount,
    taxType, taxPercentage, taxAmount,
    subtotal, total,
    billingFrequency, billingStartDate, billingEndDate, notes
  });
  
  // Step 6: Return with product details
  const result = await DealProduct.findByPk(dealProduct.dealProductId, {
    include: [
      { model: Product, as: "product" },
      { model: ProductVariation, as: "variation" }
    ]
  });
  
  res.status(201).json({
    status: "success",
    message: "Product added to deal successfully",
    data: result
  });
};
```

### 8.4 Revenue Calculation Function

```javascript
function calculateRevenue(dealProducts) {
  const metrics = {
    monthlyRecurringRevenue: 0,
    annualRecurringRevenue: 0,
    oneTimeRevenue: 0,
    totalContractValue: 0
  };
  
  dealProducts.forEach(dp => {
    const total = parseFloat(dp.total || 0);
    const freq = dp.billingFrequency;
    
    // MRR & ARR
    if (freq === "monthly") {
      metrics.monthlyRecurringRevenue += total;
      metrics.annualRecurringRevenue += total * 12;
    } else if (freq === "quarterly") {
      metrics.monthlyRecurringRevenue += total / 3;
      metrics.annualRecurringRevenue += total * 4;
    } else if (freq === "semi-annually") {
      metrics.monthlyRecurringRevenue += total / 6;
      metrics.annualRecurringRevenue += total * 2;
    } else if (freq === "annually") {
      metrics.monthlyRecurringRevenue += total / 12;
      metrics.annualRecurringRevenue += total;
    } else {
      metrics.oneTimeRevenue += total;
    }
    
    // TCV (if has contract dates)
    if (dp.billingStartDate && dp.billingEndDate) {
      const start = new Date(dp.billingStartDate);
      const end = new Date(dp.billingEndDate);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                     (end.getMonth() - start.getMonth());
      
      if (freq === "monthly") {
        metrics.totalContractValue += total * months;
      } else if (freq === "quarterly") {
        metrics.totalContractValue += total * Math.ceil(months / 3);
      } else if (freq === "annually") {
        metrics.totalContractValue += total * Math.ceil(months / 12);
      }
    }
  });
  
  // ACV = ARR + One-time
  metrics.annualContractValue = 
    metrics.annualRecurringRevenue + metrics.oneTimeRevenue;
  
  return metrics;
}
```

---

## 9. Real-World Examples

### Example 1: SaaS Monthly Subscription

**Product Setup:**
```json
{
  "name": "CRM Pro Plan",
  "code": "CRM-PRO-001",
  "prices": [{"currency": "USD", "amount": 99}],
  "billingFrequency": "monthly",
  "taxType": "tax-exclusive",
  "taxPercentage": 10
}
```

**Add to Deal:**
```json
{
  "quantity": 5,
  "unitPrice": 99,
  "discountType": "percentage",
  "discountValue": 20,
  "billingStartDate": "2025-01-01",
  "billingEndDate": "2025-12-31"
}
```

**Calculations:**
```
Subtotal: 5 × $99 = $495
Discount (20%): $495 × 0.20 = $99
After Discount: $495 - $99 = $396
Tax (10%): $396 × 0.10 = $39.60
Monthly Total: $435.60

MRR: $435.60
ARR: $435.60 × 12 = $5,227.20
TCV (12 months): $435.60 × 12 = $5,227.20
```

### Example 2: Annual License with Discount

**Product:**
```json
{
  "name": "Software License",
  "prices": [{"currency": "USD", "amount": 10000}],
  "billingFrequency": "annually",
  "taxType": "tax-inclusive",
  "taxPercentage": 18
}
```

**Add to Deal:**
```json
{
  "quantity": 1,
  "unitPrice": 10000,
  "discountType": "fixed",
  "discountValue": 1500
}
```

**Calculations:**
```
Subtotal: $10,000
Discount (fixed): $1,500
After Discount: $8,500
Tax (18% inclusive): $8,500 × (18/118) = $1,297.46
Annual Total: $8,500

MRR: $8,500 / 12 = $708.33
ARR: $8,500
```

### Example 3: Mixed Products

**Deal has:**
1. Monthly SaaS: $500/month
2. Quarterly Service: $3,000/quarter
3. One-time Setup: $5,000

**Revenue:**
```
MRR: $500 + ($3,000/3) = $1,500
ARR: $1,500 × 12 = $18,000
One-time: $5,000
ACV: $18,000 + $5,000 = $23,000
```

---

## 10. Testing Scenarios

### Test Case 1: Tax-Exclusive
```json
Input:
- Quantity: 10
- Unit Price: 100
- Discount: 10%
- Tax: 18% (exclusive)

Expected:
- Subtotal: 1000
- Discount: 100
- After Discount: 900
- Tax: 162
- Total: 1062
```

### Test Case 2: Tax-Inclusive
```json
Input:
- Quantity: 1
- Unit Price: 1180
- Discount: 0
- Tax: 18% (inclusive)

Expected:
- Subtotal: 1180
- Discount: 0
- After Discount: 1180
- Tax: 180
- Total: 1180
```

### Test Case 3: Fixed Discount
```json
Input:
- Quantity: 5
- Unit Price: 200
- Discount: $150 (fixed)
- Tax: 18% (exclusive)

Expected:
- Subtotal: 1000
- Discount: 150
- After Discount: 850
- Tax: 153
- Total: 1003
```

---

## 11. Key Takeaways

### ✅ Tax System
- **Three types**: Exclusive (add), Inclusive (included), None
- **Flexible**: Can override per deal/product
- **Accurate**: Mathematical formulas match real-world tax calculations

### ✅ Discount System
- **Two types**: Percentage, Fixed amount
- **Order**: Applied before tax
- **Flexible**: Can override default product discount

### ✅ Revenue Metrics
- **MRR**: Monthly recurring revenue (normalized)
- **ARR**: Annual recurring revenue (MRR × 12)
- **ACV**: Annual contract value (ARR + one-time)
- **TCV**: Total contract value (based on dates)

### ✅ Architecture
- **Snapshot pricing**: Historical accuracy
- **JSON flexibility**: Multi-currency, attributes
- **Automatic calculations**: No manual math needed
- **Rich associations**: Products, variations, deals linked

---

## 12. Migration & Setup

### Run Migration
```sql
-- Execute in MySQL
source MANUAL_PRODUCT_MIGRATION.sql
```

### Verify Tables
```sql
SHOW TABLES LIKE '%product%';
-- Should show: products, product_variations, deal_products

DESCRIBE products;
DESCRIBE product_variations;
DESCRIBE deal_products;
```

### Test API
```bash
# 1. Create product
curl -X POST http://213.136.77.55:4001/api/products/create \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Test","prices":[{"currency":"USD","amount":100}]}'

# 2. Add to deal
curl -X POST http://213.136.77.55:4001/api/products/deal/add \
  -H "Authorization: Bearer TOKEN" \
  -d '{"dealId":1,"productId":1,"quantity":5,"unitPrice":100}'
```

---

**End of Documentation**

For API testing examples, see: `PRODUCT_API_TESTING_GUIDE.md`  
For frontend integration, see: `DEAL_PRODUCT_INTEGRATION.md`  
For setup instructions, see: `PRODUCT_SETUP_GUIDE.md`
