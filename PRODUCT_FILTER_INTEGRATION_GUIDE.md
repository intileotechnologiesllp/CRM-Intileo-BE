# 🎯 Product Filter Integration - Complete Guide

## Overview
The filter system has been extended to support **Product entity filtering**, allowing users to create, save, and manage filters for products just like they do for leads, deals, and other entities.

---

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Changes](#database-changes)
3. [API Endpoints](#api-endpoints)
4. [Filter Structure](#filter-structure)
5. [Creating Product Filters](#creating-product-filters)
6. [Product Fields Reference](#product-fields-reference)
7. [Usage Examples](#usage-examples)
8. [Integration with getDeals](#integration-with-getdeals)
9. [Migration Guide](#migration-guide)

---

## 1. Architecture Overview

### Filter System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    FILTER MANAGEMENT                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Lead       │  │   Deal       │  │   Product    │     │
│  │   Filters    │  │   Filters    │  │   Filters    │ ←NEW│
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           LeadFilter Table (Unified)                  │  │
│  │  - filterId                                          │  │
│  │  - filterName                                        │  │
│  │  - filterConfig (JSON)                               │  │
│  │  - filterEntityType: ENUM('lead', 'deal', 'product')│  │
│  │  - visibility: 'Private' or 'Public'                │  │
│  │  - isFavorite: BOOLEAN                               │  │
│  │  - masterUserID                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Supported Entity Types
1. ✅ **lead** - Lead management filters
2. ✅ **deal** - Deal management filters
3. ✅ **person** - Person/Contact filters
4. ✅ **organization** - Organization filters
5. ✅ **activity** - Activity filters
6. ✅ **product** - Product filters ← **NEW**

---

## 2. Database Changes

### LeadFilter Model Update

**Before:**
```javascript
filterEntityType: {
  type: DataTypes.ENUM('lead', 'deal', 'person', 'organization', 'activity'),
  allowNull: false,
  defaultValue: 'lead'
}
```

**After:**
```javascript
filterEntityType: {
  type: DataTypes.ENUM('lead', 'deal', 'person', 'organization', 'activity', 'product'),
  allowNull: false,
  defaultValue: 'lead'
}
```

### Migration SQL

```sql
-- Add 'product' to the filterEntityType ENUM
ALTER TABLE LeadFilters 
MODIFY COLUMN filterEntityType 
ENUM('lead', 'deal', 'person', 'organization', 'activity', 'product') 
NOT NULL DEFAULT 'lead';
```

---

## 3. API Endpoints

### Base URL
```
/api/lead-filters
```

### Endpoints Overview

| Method | Endpoint | Description | Entity Support |
|--------|----------|-------------|----------------|
| POST | `/create-filter` | Create new filter | All entities including 'product' |
| GET | `/get-filters` | Get all filters | Filter by `filterEntityType=product` |
| GET | `/use-filter/:filterId` | Apply filter | All entities |
| POST | `/update-filters/:filterId` | Update filter | All entities including 'product' |
| GET | `/get-lead-fields` | Get lead fields | Lead/Deal fields |
| GET | `/get-product-fields` | Get product fields | **Product fields** ← NEW |
| GET | `/get-all-contacts-persons` | Get contact persons | Person data |
| POST | `/add-to-favorites/:filterId` | Mark as favorite | All entities |
| DELETE | `/remove-from-favorites/:filterId` | Remove from favorites | All entities |
| GET | `/get-favorites` | Get favorite filters | Filter by entity type |

---

## 4. Filter Structure

### Product Filter Schema

```json
{
  "filterId": 123,
  "filterName": "High-Value Active Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "isActive",
        "operator": "eq",
        "value": true
      },
      {
        "field": "category",
        "operator": "eq",
        "value": "Software"
      }
    ],
    "any": [
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "monthly"
      },
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "quarterly"
      }
    ]
  },
  "visibility": "Public",
  "isFavorite": true,
  "masterUserID": 123,
  "columns": [
    { "key": "name", "check": true },
    { "key": "code", "check": true },
    { "key": "category", "check": true },
    { "key": "isActive", "check": true }
  ],
  "createdAt": "2024-11-29T10:00:00Z",
  "updatedAt": "2024-11-29T10:00:00Z"
}
```

### Filter Config Structure

```javascript
{
  "all": [  // AND logic - ALL conditions must match
    {
      "field": "string",      // Field name
      "operator": "string",   // eq, ne, like, gt, gte, lt, lte, etc.
      "value": "any",         // Filter value
      "entity": "string"      // Optional: entity name
    }
  ],
  "any": [  // OR logic - ANY condition can match
    {
      "field": "string",
      "operator": "string",
      "value": "any"
    }
  ]
}
```

---

## 5. Creating Product Filters

### A. Create Filter API

**Endpoint:** `POST /api/lead-filters/create-filter`

**Request:**
```json
{
  "filterName": "Active SaaS Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "category",
        "operator": "eq",
        "value": "SaaS"
      },
      {
        "field": "isActive",
        "operator": "eq",
        "value": true
      }
    ],
    "any": []
  },
  "visibility": "Private",
  "columns": [
    { "key": "name", "check": true },
    { "key": "code", "check": true },
    { "key": "category", "check": true }
  ]
}
```

**Response:**
```json
{
  "message": "Filter saved successfully",
  "filter": {
    "filterId": 456,
    "filterName": "Active SaaS Products",
    "filterConfig": { ... },
    "visibility": "Private",
    "masterUserID": 123,
    "columns": [ ... ],
    "filterEntityType": "product",
    "isFavorite": false,
    "createdAt": "2024-11-29T10:00:00Z",
    "updatedAt": "2024-11-29T10:00:00Z"
  }
}
```

### B. Get Product Filters

**Endpoint:** `GET /api/lead-filters/get-filters?filterEntityType=product`

**Response:**
```json
{
  "filters": [
    {
      "filterId": 456,
      "filterName": "Active SaaS Products",
      "filterConfig": { ... },
      "filterEntityType": "product",
      "visibility": "Private",
      "masterUserID": 123,
      "isFavorite": false,
      "columns": [ ... ],
      "createdAt": "2024-11-29T10:00:00Z",
      "updatedAt": "2024-11-29T10:00:00Z"
    }
  ],
  "totalFilters": 1,
  "availableEntityTypes": [
    "lead", "deal", "person", "organization", "activity", "product"
  ]
}
```

### C. Get Product Fields for Filter Building

**Endpoint:** `GET /api/lead-filters/get-product-fields`

**Response:**
```json
{
  "success": true,
  "fields": [
    {
      "value": "productId",
      "label": "Product Id",
      "type": "number",
      "entity": "Product",
      "entityTable": "products",
      "isCustomField": false,
      "enumValues": null,
      "comment": "Unique product ID"
    },
    {
      "value": "name",
      "label": "Name",
      "type": "text",
      "entity": "Product",
      "entityTable": "products",
      "isCustomField": false,
      "enumValues": null,
      "comment": "Product name"
    },
    {
      "value": "billingFrequency",
      "label": "Billing Frequency",
      "type": "select",
      "entity": "Product",
      "entityTable": "products",
      "isCustomField": false,
      "enumValues": [
        "one-time", "monthly", "quarterly", 
        "semi-annually", "annually", "custom"
      ],
      "comment": "How often the product is billed"
    }
  ],
  "groupedFields": {
    "product": [ ... ],
    "dealProduct": [ ... ],
    "customFields": [ ... ]
  },
  "totalFields": 50,
  "productFields": 30,
  "dealProductFields": 15,
  "customFields": 5,
  "entities": {
    "Product": {
      "description": "Master product data (name, code, category, pricing, etc.)",
      "table": "products",
      "fieldCount": 30
    },
    "DealProduct": {
      "description": "Deal-specific product data (quantity, total, discount, tax, etc.)",
      "table": "deal_products",
      "fieldCount": 15
    },
    "CustomFields": {
      "description": "Custom product fields",
      "table": "custom_field_values",
      "fieldCount": 5
    }
  }
}
```

---

## 6. Product Fields Reference

### A. Product Master Fields (products table)

| Field | Type | Description | Filterable |
|-------|------|-------------|------------|
| `productId` | number | Unique product ID | ✅ |
| `name` | text | Product name | ✅ |
| `code` | text | Product code/SKU | ✅ |
| `description` | text | Product description | ✅ |
| `category` | text | Product category | ✅ |
| `unit` | text | Unit of measurement | ✅ |
| `prices` | json | Multi-currency pricing | ❌ |
| `cost` | number | Direct cost | ✅ |
| `costCurrency` | text | Cost currency | ✅ |
| `billingFrequency` | select | Billing frequency | ✅ |
| `billingFrequencyCustom` | number | Custom billing days | ✅ |
| `taxType` | select | Tax type | ✅ |
| `taxPercentage` | number | Tax percentage | ✅ |
| `discountType` | select | Discount type | ✅ |
| `discountValue` | number | Discount value | ✅ |
| `hasVariations` | boolean | Has variations | ✅ |
| `isActive` | boolean | Active status | ✅ |
| `visibilityGroup` | text | Visibility group | ✅ |
| `ownerId` | number | Product owner | ✅ |
| `companyId` | number | Company/tenant ID | ✅ |
| `imageUrl` | text | Product image URL | ✅ |
| `metadata` | json | Additional metadata | ❌ |
| `createdAt` | date | Created timestamp | ✅ |
| `updatedAt` | date | Updated timestamp | ✅ |

### B. DealProduct Fields (deal_products table)

| Field | Type | Description | Filterable |
|-------|------|-------------|------------|
| `dealProductId` | number | Unique ID | ✅ |
| `dealId` | number | Deal reference | ✅ |
| `productId` | number | Product reference | ✅ |
| `variationId` | number | Variation reference | ✅ |
| `quantity` | number | Quantity | ✅ |
| `unitPrice` | number | Unit price | ✅ |
| `currency` | text | Currency code | ✅ |
| `discountType` | select | Discount type | ✅ |
| `discountValue` | number | Discount value | ✅ |
| `discountAmount` | number | Calculated discount | ✅ |
| `taxType` | select | Tax type | ✅ |
| `taxPercentage` | number | Tax percentage | ✅ |
| `taxAmount` | number | Calculated tax | ✅ |
| `subtotal` | number | Subtotal | ✅ |
| `total` | number | Total amount | ✅ |
| `billingFrequency` | select | Billing frequency | ✅ |
| `billingStartDate` | date | Billing start | ✅ |
| `billingEndDate` | date | Billing end | ✅ |
| `notes` | text | Additional notes | ✅ |
| `sortOrder` | number | Display order | ✅ |
| `createdAt` | date | Created timestamp | ✅ |
| `updatedAt` | date | Updated timestamp | ✅ |

### C. Enum Values

**billingFrequency:**
- `one-time`
- `monthly`
- `quarterly`
- `semi-annually`
- `annually`
- `custom`

**taxType:**
- `tax-exclusive`
- `tax-inclusive`
- `no-tax`

**discountType:**
- `percentage`
- `fixed`

---

## 7. Usage Examples

### Example 1: Filter Active Products

```json
{
  "filterName": "Active Products Only",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "isActive",
        "operator": "eq",
        "value": true
      }
    ],
    "any": []
  }
}
```

### Example 2: Filter by Category

```json
{
  "filterName": "Software Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "category",
        "operator": "eq",
        "value": "Software"
      },
      {
        "field": "isActive",
        "operator": "eq",
        "value": true
      }
    ],
    "any": []
  }
}
```

### Example 3: Filter by Billing Frequency

```json
{
  "filterName": "Recurring Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [],
    "any": [
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "monthly"
      },
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "quarterly"
      },
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "annually"
      }
    ]
  }
}
```

### Example 4: Filter by Price Range

```json
{
  "filterName": "High-Value Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "cost",
        "operator": "gte",
        "value": 10000
      },
      {
        "field": "isActive",
        "operator": "eq",
        "value": true
      }
    ],
    "any": []
  }
}
```

### Example 5: Filter by Owner

```json
{
  "filterName": "My Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "ownerId",
        "operator": "eq",
        "value": 123
      }
    ],
    "any": []
  }
}
```

### Example 6: Complex Multi-Condition Filter

```json
{
  "filterName": "Premium Active SaaS Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "category",
        "operator": "eq",
        "value": "SaaS"
      },
      {
        "field": "isActive",
        "operator": "eq",
        "value": true
      },
      {
        "field": "cost",
        "operator": "gte",
        "value": 5000
      }
    ],
    "any": [
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "monthly"
      },
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "annually"
      }
    ]
  }
}
```

### Example 7: Filter with Product Name Search

```json
{
  "filterName": "Enterprise Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "name",
        "operator": "like",
        "value": "%Enterprise%"
      },
      {
        "field": "isActive",
        "operator": "eq",
        "value": true
      }
    ],
    "any": []
  }
}
```

---

## 8. Integration with getDeals

### Using Product Filters in Deal Queries

Product filters can be used in the `getDeals` API to filter deals based on their associated products.

**Endpoint:** `GET /api/deals/get?filterId=456`

**Filter (ID: 456):**
```json
{
  "filterId": 456,
  "filterName": "Deals with Software Products",
  "filterEntityType": "product",
  "filterConfig": {
    "all": [
      {
        "field": "category",
        "operator": "eq",
        "value": "Software"
      }
    ]
  }
}
```

**How It Works:**
1. Filter is applied to Product table
2. Matching products are found
3. DealProduct associations are queried
4. Deals with matching products are returned

**Generated Query:**
```sql
SELECT Deals.*
FROM Deals
INNER JOIN deal_products ON Deals.dealId = deal_products.dealId
INNER JOIN products ON deal_products.productId = products.productId
WHERE products.category = 'Software'
  AND (Deals.masterUserID = 123 OR Deals.ownerId = 123);
```

---

## 9. Migration Guide

### Step 1: Update Database

```sql
-- Add 'product' to filterEntityType ENUM
ALTER TABLE LeadFilters 
MODIFY COLUMN filterEntityType 
ENUM('lead', 'deal', 'person', 'organization', 'activity', 'product') 
NOT NULL DEFAULT 'lead';

-- Verify the change
DESCRIBE LeadFilters;
```

### Step 2: Verify Code Changes

**Files Modified:**
1. ✅ `models/leads/leadFiltersModel.js` - Added 'product' to ENUM
2. ✅ `controllers/leads/leadFilterController.js` - Added product support
3. ✅ `routes/leads/leadFilterRoutes.js` - Added getProductFields route
4. ✅ `controllers/deals/dealsController.js` - Product filtering in getDeals

### Step 3: Test API Endpoints

**Test 1: Get Product Fields**
```bash
curl -X GET "http://localhost:3000/api/lead-filters/get-product-fields" \
  -H "Authorization: Bearer <token>"
```

**Test 2: Create Product Filter**
```bash
curl -X POST "http://localhost:3000/api/lead-filters/create-filter" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "filterName": "Test Product Filter",
    "filterEntityType": "product",
    "filterConfig": {
      "all": [{"field": "isActive", "operator": "eq", "value": true}],
      "any": []
    }
  }'
```

**Test 3: Get Product Filters**
```bash
curl -X GET "http://localhost:3000/api/lead-filters/get-filters?filterEntityType=product" \
  -H "Authorization: Bearer <token>"
```

**Test 4: Add to Favorites**
```bash
curl -X POST "http://localhost:3000/api/lead-filters/add-to-favorites/456" \
  -H "Authorization: Bearer <token>"
```

**Test 5: Get Favorite Product Filters**
```bash
curl -X GET "http://localhost:3000/api/lead-filters/get-favorites?filterEntityType=product" \
  -H "Authorization: Bearer <token>"
```

---

## 10. Frontend Integration

### Filter Builder UI Components

```javascript
// Fetch available fields for product filters
const fetchProductFields = async () => {
  const response = await fetch('/api/lead-filters/get-product-fields', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.groupedFields;
};

// Create product filter
const createProductFilter = async (filterData) => {
  const response = await fetch('/api/lead-filters/create-filter', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...filterData,
      filterEntityType: 'product'
    })
  });
  return response.json();
};

// Get product filters
const getProductFilters = async () => {
  const response = await fetch('/api/lead-filters/get-filters?filterEntityType=product', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

---

## 11. Best Practices

### ✅ DO:
- Always specify `filterEntityType: 'product'` when creating product filters
- Use specific field filters for better performance
- Group related conditions using 'all' for AND logic
- Use 'any' for OR logic across multiple values
- Mark frequently used filters as favorites
- Use descriptive filter names

### ❌ DON'T:
- Mix entity types in the same filter (keep product filters separate from deal filters)
- Filter on JSON fields (prices, metadata) - not supported
- Create overly complex filters (performance impact)
- Forget to set visibility correctly (Private vs Public)

---

## 12. Troubleshooting

### Issue 1: "Invalid filterEntityType" Error

**Problem:** Getting validation error when creating filter

**Solution:** Ensure database migration was run to add 'product' to ENUM

```sql
-- Check current ENUM values
SHOW COLUMNS FROM LeadFilters LIKE 'filterEntityType';

-- Should show: enum('lead','deal','person','organization','activity','product')
```

### Issue 2: No Product Fields Returned

**Problem:** `/get-product-fields` returns empty array

**Solution:** Ensure Product and DealProduct models are imported correctly

```javascript
// Check in leadFilterController.js
const Product = require("../../models/product/productModel");
const DealProduct = require("../../models/product/dealProductModel");
```

### Issue 3: Filter Not Applying to Deals

**Problem:** Product filter doesn't filter deals correctly

**Solution:** Ensure `getDeals` API has product filtering logic implemented

---

## Summary

### Key Features Added
✅ **Product entity support** in filter system  
✅ **getProductFields API** to fetch filterable product fields  
✅ **Product and DealProduct field categorization**  
✅ **ENUM update** in LeadFilter model  
✅ **Favorite filter support** for product filters  
✅ **Integration with getDeals** for deal filtering by products  

### API Endpoints Added
- `GET /api/lead-filters/get-product-fields` - Get product fields

### Database Changes
- Updated `filterEntityType` ENUM to include 'product'

### Files Modified
1. `models/leads/leadFiltersModel.js`
2. `controllers/leads/leadFilterController.js`
3. `routes/leads/leadFilterRoutes.js`
4. `controllers/deals/dealsController.js`

---

**Document Version:** 1.0  
**Last Updated:** November 29, 2025  
**Related Documentation:**
- `DEALS_PRODUCT_FILTER_DOCUMENTATION.md` - Product filtering in getDeals
- `DEALS_FILTERID_DOCUMENTATION.md` - Core filterId functionality
- `PRODUCT_MANAGEMENT_README.md` - Product management API

---

**Author:** CRM Development Team
