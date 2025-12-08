# 🛒 Product Filtering in getDeals API

## Overview
The `getDeals` API now supports **product-based filtering**, allowing users to filter deals based on:
1. **DealProduct fields** - Product quantities, pricing, discounts, tax, billing in deals
2. **Product fields** - Product name, code, category, status, and other master data

This feature seamlessly integrates with the existing `filterId` filtering system, supporting both standard fields and custom fields.

---

## 📋 Table of Contents
1. [Product Filter Architecture](#product-filter-architecture)
2. [Filterable Product Fields](#filterable-product-fields)
3. [Filter Examples](#filter-examples)
4. [Integration with Existing Filters](#integration-with-existing-filters)
5. [Query Performance](#query-performance)
6. [API Usage Examples](#api-usage-examples)

---

## 1. Product Filter Architecture

### Database Structure
```
Deals (Main)
  ├── DealDetails (1:1)
  ├── DealProduct (1:N) - Junction table
  │     └── Product (N:1) - Master product data
  └── CustomFields (1:N)
```

### Filter Flow
```
Filter Condition → Field Detection → Table Assignment → JOIN Construction → Query Execution

Example:
{
  field: "quantity",      → DealProduct field → dealProductWhere
  operator: "gte", 
  value: 5
}

{
  field: "name",          → Product field → productWhere
  operator: "contains",
  value: "Software"
}
```

---

## 2. Filterable Product Fields

### A. DealProduct Fields (Junction Table)
These fields represent product data **specific to each deal**.

| Field | Type | Description | Example Filter |
|-------|------|-------------|----------------|
| `dealProductId` | INTEGER | Unique ID | `dealProductId = 123` |
| `productId` | INTEGER | Product reference | `productId = 45` |
| `variationId` | INTEGER | Product variation | `variationId = 10` |
| `quantity` | DECIMAL | Product quantity | `quantity >= 5` |
| `unitPrice` | DECIMAL | Unit price at time of adding | `unitPrice >= 1000` |
| `currency` | STRING | Currency code | `currency = 'USD'` |
| `discountType` | ENUM | 'percentage' or 'fixed' | `discountType = 'percentage'` |
| `discountValue` | DECIMAL | Discount amount | `discountValue >= 10` |
| `discountAmount` | DECIMAL | Calculated discount | `discountAmount >= 500` |
| `taxType` | ENUM | 'tax-exclusive', 'tax-inclusive', 'no-tax' | `taxType = 'tax-exclusive'` |
| `taxPercentage` | DECIMAL | Tax rate | `taxPercentage = 18` |
| `taxAmount` | DECIMAL | Calculated tax | `taxAmount >= 100` |
| `subtotal` | DECIMAL | Subtotal before discount/tax | `subtotal >= 5000` |
| `total` | DECIMAL | Final total | `total >= 10000` |
| `billingFrequency` | ENUM | 'one-time', 'monthly', 'quarterly', etc. | `billingFrequency = 'monthly'` |
| `billingStartDate` | DATE | Billing start | `billingStartDate >= '2024-01-01'` |
| `billingEndDate` | DATE | Billing end | `billingEndDate <= '2024-12-31'` |
| `notes` | TEXT | Additional notes | `notes LIKE '%urgent%'` |
| `sortOrder` | INTEGER | Display order | `sortOrder = 1` |
| `createdAt` | DATE | When added to deal | `createdAt >= '2024-01-01'` |
| `updatedAt` | DATE | Last modified | `updatedAt >= '2024-01-01'` |

**Use Cases:**
- Find deals with high-value products: `total >= 50000`
- Find deals with recurring billing: `billingFrequency IN ('monthly', 'quarterly')`
- Find deals with high quantities: `quantity >= 100`
- Find deals with tax-inclusive pricing: `taxType = 'tax-inclusive'`

---

### B. Product Fields (Master Data)
These fields represent **master product information** shared across all deals.

| Field | Type | Description | Example Filter |
|-------|------|-------------|----------------|
| `productId` | INTEGER | Unique product ID | `productId = 45` |
| `name` | STRING | Product name | `name LIKE '%Software%'` |
| `code` | STRING | Product code/SKU | `code = 'PROD-001'` |
| `description` | TEXT | Product description | `description LIKE '%cloud%'` |
| `category` | STRING | Product category | `category = 'Software'` |
| `unit` | STRING | Unit of measurement | `unit = 'licenses'` |
| `prices` | JSON | Multi-currency pricing | N/A (JSON field) |
| `cost` | DECIMAL | Direct cost | `cost >= 500` |
| `costCurrency` | STRING | Cost currency | `costCurrency = 'INR'` |
| `billingFrequency` | ENUM | Default billing frequency | `billingFrequency = 'monthly'` |
| `billingFrequencyCustom` | INTEGER | Custom billing days | `billingFrequencyCustom = 90` |
| `taxType` | ENUM | Default tax type | `taxType = 'tax-exclusive'` |
| `taxPercentage` | DECIMAL | Default tax rate | `taxPercentage = 18` |
| `discountType` | ENUM | Default discount type | `discountType = 'percentage'` |
| `discountValue` | DECIMAL | Default discount value | `discountValue >= 10` |
| `hasVariations` | BOOLEAN | Has product variations | `hasVariations = true` |
| `isActive` | BOOLEAN | Product status | `isActive = true` |
| `visibilityGroup` | STRING | Visibility group | `visibilityGroup = 'Premium'` |
| `ownerId` | INTEGER | Product owner | `ownerId = 123` |
| `companyId` | INTEGER | Company/tenant ID | `companyId = 1` |
| `imageUrl` | STRING | Product image | `imageUrl IS NOT NULL` |
| `metadata` | JSON | Custom metadata | N/A (JSON field) |
| `createdAt` | DATE | Product created | `createdAt >= '2023-01-01'` |
| `updatedAt` | DATE | Product modified | `updatedAt >= '2024-01-01'` |

**Use Cases:**
- Find deals with specific product category: `category = 'SaaS'`
- Find deals with active products only: `isActive = true`
- Find deals with specific product name: `name LIKE '%Enterprise%'`
- Find deals with products by owner: `ownerId = 123`

---

## 3. Filter Examples

### Example 1: Filter by Product Quantity
**Use Case:** Find deals with bulk orders (quantity >= 10)

**Filter Configuration:**
```json
{
  "filterName": "Bulk Orders",
  "filterConfig": {
    "all": [
      {
        "field": "quantity",
        "operator": "gte",
        "value": 10
      }
    ],
    "any": []
  }
}
```

**Generated SQL:**
```sql
SELECT Deals.*, DealProduct.*
FROM Deals
INNER JOIN deal_products AS products ON Deals.dealId = products.dealId
WHERE products.quantity >= 10
  AND (Deals.masterUserID = 123 OR Deals.ownerId = 123);
```

**Result:** Returns all deals containing at least one product with quantity ≥ 10

---

### Example 2: Filter by Product Name
**Use Case:** Find deals containing "Software" products

**Filter Configuration:**
```json
{
  "filterName": "Software Deals",
  "filterConfig": {
    "all": [
      {
        "field": "name",
        "operator": "contains",
        "value": "Software"
      }
    ],
    "any": []
  }
}
```

**Generated SQL:**
```sql
SELECT Deals.*, DealProduct.*, Product.*
FROM Deals
INNER JOIN deal_products AS products ON Deals.dealId = products.dealId
INNER JOIN products AS product ON products.productId = product.productId
WHERE product.name LIKE '%Software%'
  AND (Deals.masterUserID = 123 OR Deals.ownerId = 123);
```

---

### Example 3: Filter by Product Category and Active Status
**Use Case:** Find deals with active SaaS products

**Filter Configuration:**
```json
{
  "filterName": "Active SaaS Deals",
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
  }
}
```

**Generated WHERE:**
```javascript
{
  productWhere: {
    [Op.and]: [
      { category: { [Op.eq]: "SaaS" } },
      { isActive: { [Op.eq]: true } }
    ]
  }
}
```

---

### Example 4: Filter by Product Total Value
**Use Case:** Find deals with high-value product lines (total >= 50000)

**Filter Configuration:**
```json
{
  "filterName": "High-Value Product Lines",
  "filterConfig": {
    "all": [
      {
        "field": "total",
        "operator": "gte",
        "value": 50000
      }
    ],
    "any": []
  }
}
```

---

### Example 5: Filter by Billing Frequency
**Use Case:** Find deals with recurring (monthly or quarterly) products

**Filter Configuration:**
```json
{
  "filterName": "Recurring Revenue Deals",
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
      }
    ]
  }
}
```

**Generated WHERE:**
```javascript
{
  dealProductWhere: {
    [Op.or]: [
      { billingFrequency: { [Op.eq]: "monthly" } },
      { billingFrequency: { [Op.eq]: "quarterly" } }
    ]
  }
}
```

---

### Example 6: Complex Filter - Multiple Tables
**Use Case:** Find high-value deals (>10000) with Software products in Proposal stage

**Filter Configuration:**
```json
{
  "filterName": "High-Value Software Proposals",
  "filterConfig": {
    "all": [
      {
        "field": "pipelineStage",
        "operator": "eq",
        "value": "Proposal"
      },
      {
        "field": "value",
        "operator": "gte",
        "value": 10000
      },
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

**Processing:**
```
Field Detection:
- pipelineStage → Deal table
- value → Deal table
- category → Product table
- isActive → Product table

Generated Query:
- Deal WHERE: pipelineStage = 'Proposal' AND value >= 10000
- Product WHERE: category = 'Software' AND isActive = true
- JOIN: Deals → DealProduct → Product
```

---

### Example 7: Filter by Tax Settings
**Use Case:** Find deals with tax-exclusive products and high tax

**Filter Configuration:**
```json
{
  "filterName": "High Tax Deals",
  "filterConfig": {
    "all": [
      {
        "field": "taxType",
        "operator": "eq",
        "value": "tax-exclusive"
      },
      {
        "field": "taxPercentage",
        "operator": "gte",
        "value": 15
      }
    ],
    "any": []
  }
}
```

---

### Example 8: Filter by Discount
**Use Case:** Find deals with percentage discounts >= 20%

**Filter Configuration:**
```json
{
  "filterName": "High Discount Deals",
  "filterConfig": {
    "all": [
      {
        "field": "discountType",
        "operator": "eq",
        "value": "percentage"
      },
      {
        "field": "discountValue",
        "operator": "gte",
        "value": 20
      }
    ],
    "any": []
  }
}
```

---

### Example 9: Filter by Billing Date Range
**Use Case:** Find deals with products starting billing in Q1 2024

**Filter Configuration:**
```json
{
  "filterName": "Q1 2024 Billing Start",
  "filterConfig": {
    "all": [
      {
        "field": "billingStartDate",
        "operator": "gte",
        "value": "2024-01-01"
      },
      {
        "field": "billingStartDate",
        "operator": "lte",
        "value": "2024-03-31"
      }
    ],
    "any": []
  }
}
```

---

### Example 10: Mixed Filter - Deal + Product + Custom Fields
**Use Case:** Complex filter combining multiple dimensions

**Filter Configuration:**
```json
{
  "filterName": "Premium Enterprise Deals",
  "filterConfig": {
    "all": [
      {
        "field": "value",
        "operator": "gte",
        "value": 100000
      },
      {
        "field": "category",
        "operator": "eq",
        "value": "Enterprise Software"
      },
      {
        "field": "quantity",
        "operator": "gte",
        "value": 50
      },
      {
        "field": "industry",
        "operator": "eq",
        "value": "Technology"
      }
    ],
    "any": []
  }
}
```

**Processing:**
```
Field Routing:
- value → Deal table (filterWhere)
- category → Product table (productWhere)
- quantity → DealProduct table (dealProductWhere)
- industry → CustomField (customFieldsConditions)

Generated Includes:
1. DealProduct (INNER JOIN with quantity filter)
   └── Product (INNER JOIN with category filter)
2. CustomFieldValue (filter by industry)
```

---

## 4. Integration with Existing Filters

### Filter Processing Priority

```
1. Parse filterConfig (all/any conditions)
2. Categorize fields by table:
   - dealFields → filterWhere
   - dealDetailsFields → dealDetailsWhere
   - dealProductFields → dealProductWhere  ← NEW
   - productFields → productWhere          ← NEW
   - unknown fields → customFieldsConditions
3. Build WHERE clauses for each table
4. Construct includes with nested JOINs
5. Apply permission filters
6. Execute query
```

### JOIN Strategy

**Without Product Filters:**
```sql
SELECT * FROM Deals
LEFT JOIN DealDetails ON ...
```

**With Product Filters:**
```sql
SELECT * FROM Deals
LEFT JOIN DealDetails ON ...
INNER JOIN deal_products ON ...  -- INNER JOIN when filtering
  INNER JOIN products ON ...     -- Nested INNER JOIN if filtering Product fields
```

**Key Points:**
- ✅ **INNER JOIN** when product filtering is active (required: true)
- ✅ **Nested includes** for Product table when filtering Product fields
- ✅ **Combines** with existing Deal, DealDetails, and CustomField filters
- ✅ **AND/OR logic** works across all table filters

---

## 5. Query Performance

### Optimization Strategies

#### 1. **Indexes**
```sql
-- DealProduct indexes
CREATE INDEX idx_dealproduct_dealid ON deal_products(dealId);
CREATE INDEX idx_dealproduct_productid ON deal_products(productId);
CREATE INDEX idx_dealproduct_quantity ON deal_products(quantity);
CREATE INDEX idx_dealproduct_total ON deal_products(total);
CREATE INDEX idx_dealproduct_billing ON deal_products(billingFrequency);

-- Product indexes
CREATE INDEX idx_product_name ON products(name);
CREATE INDEX idx_product_category ON products(category);
CREATE INDEX idx_product_isactive ON products(isActive);
CREATE INDEX idx_product_code ON products(code);
```

#### 2. **Query Efficiency**
```javascript
// Good: Specific product filters
{
  "field": "productId",
  "operator": "eq",
  "value": 123
}

// Less efficient: Text search on large fields
{
  "field": "description",
  "operator": "contains",
  "value": "cloud"
}
```

#### 3. **Limit Result Sets**
```javascript
// Always use pagination
GET /api/deals/get?filterId=123&page=1&limit=20
```

---

## 6. API Usage Examples

### A. Basic Product Filter Request

**Request:**
```http
GET /api/deals/get?filterId=45&page=1&limit=20
Authorization: Bearer <token>
```

**Filter (ID: 45):**
```json
{
  "filterId": 45,
  "filterName": "Software Products",
  "filterConfig": {
    "all": [
      {
        "field": "category",
        "operator": "eq",
        "value": "Software"
      }
    ],
    "any": []
  }
}
```

**Response:**
```json
{
  "message": "Deals fetched successfully",
  "totalDeals": 15,
  "totalPages": 1,
  "currentPage": 1,
  "deals": [
    {
      "dealId": 123,
      "title": "Acme Corp - Enterprise License",
      "value": 50000,
      "currency": "USD",
      "pipelineStage": "Proposal",
      "products": [
        {
          "dealProductId": 456,
          "productId": 789,
          "quantity": 100,
          "unitPrice": 500,
          "total": 50000,
          "billingFrequency": "monthly",
          "product": {
            "productId": 789,
            "name": "Enterprise Software License",
            "category": "Software",
            "code": "SOFT-001",
            "isActive": true
          }
        }
      ],
      "customFields": { ... }
    }
  ],
  "summary": { ... }
}
```

---

### B. Multiple Product Filters

**Filter Configuration:**
```json
{
  "filterName": "High-Value Monthly Products",
  "filterConfig": {
    "all": [
      {
        "field": "total",
        "operator": "gte",
        "value": 10000
      },
      {
        "field": "billingFrequency",
        "operator": "eq",
        "value": "monthly"
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

### C. Product + Deal Combined Filter

**Filter Configuration:**
```json
{
  "filterName": "Proposal Stage with Software Products",
  "filterConfig": {
    "all": [
      {
        "field": "pipelineStage",
        "operator": "eq",
        "value": "Proposal"
      },
      {
        "field": "category",
        "operator": "eq",
        "value": "Software"
      },
      {
        "field": "quantity",
        "operator": "gte",
        "value": 10
      }
    ],
    "any": []
  }
}
```

**Processing:**
```
Deal Filter: pipelineStage = 'Proposal'
Product Filter: category = 'Software'
DealProduct Filter: quantity >= 10

Result: Deals in Proposal stage containing Software products with quantity >= 10
```

---

### D. OR Logic with Products

**Filter Configuration:**
```json
{
  "filterName": "Multiple Product Categories",
  "filterConfig": {
    "all": [],
    "any": [
      {
        "field": "category",
        "operator": "eq",
        "value": "Software"
      },
      {
        "field": "category",
        "operator": "eq",
        "value": "Hardware"
      },
      {
        "field": "category",
        "operator": "eq",
        "value": "Services"
      }
    ]
  }
}
```

---

## 7. Field Detection Logic

### Code Flow
```javascript
// 1. Get all model fields
const dealProductFields = Object.keys(DealProduct.rawAttributes);
const productFields = Object.keys(Product.rawAttributes);

// 2. Check each condition
all.forEach((cond) => {
  if (dealFields.includes(cond.field)) {
    filterWhere[Op.and].push(buildCondition(cond));
  } else if (dealDetailsFields.includes(cond.field)) {
    dealDetailsWhere[Op.and].push(buildCondition(cond));
  } else if (dealProductFields.includes(cond.field)) {
    dealProductWhere[Op.and].push(buildCondition(cond));  // ← NEW
  } else if (productFields.includes(cond.field)) {
    productWhere[Op.and].push(buildCondition(cond));      // ← NEW
  } else {
    customFieldsConditions.all.push(cond);
  }
});

// 3. Build includes
if (dealProductWhere or productWhere have conditions) {
  include.push({
    model: DealProduct,
    as: "products",
    where: dealProductWhere,
    required: true,  // INNER JOIN
    include: [
      {
        model: Product,
        as: "product",
        where: productWhere,
        required: productWhere has conditions
      }
    ]
  });
}
```

---

## 8. Common Use Cases

### 1. **Revenue Analysis**
- Filter by `billingFrequency = 'monthly'` to find MRR deals
- Filter by `total >= 10000` to find high-value product lines

### 2. **Product Performance**
- Filter by `category = 'Software'` to analyze software sales
- Filter by `productId = 123` to track specific product adoption

### 3. **Discount Analysis**
- Filter by `discountType = 'percentage'` AND `discountValue >= 20` for high-discount deals
- Filter by `discountAmount >= 5000` for significant discounts

### 4. **Tax Reporting**
- Filter by `taxType = 'tax-exclusive'` to separate tax calculations
- Filter by `taxPercentage >= 18` for high-tax products

### 5. **Inventory Management**
- Filter by `quantity >= 100` for bulk orders
- Filter by `isActive = true` to exclude discontinued products

### 6. **Billing Management**
- Filter by `billingStartDate >= '2024-01-01'` for upcoming billings
- Filter by `billingFrequency = 'one-time'` for one-off sales

---

## 9. Troubleshooting

### Issue 1: No Results with Product Filter
**Problem:** Filter returns empty results when product filter is added

**Possible Causes:**
1. No products attached to deals
2. Product filter too restrictive
3. INNER JOIN excluding deals without products

**Solution:**
```javascript
// Check if deals have products
SELECT Deals.dealId, COUNT(deal_products.dealProductId) as productCount
FROM Deals
LEFT JOIN deal_products ON Deals.dealId = deal_products.dealId
GROUP BY Deals.dealId
HAVING productCount = 0;
```

### Issue 2: Duplicate Results
**Problem:** Same deal returned multiple times

**Cause:** Deal has multiple products matching filter

**Solution:** This is expected behavior. Each deal-product combination is returned.

---

## 10. Best Practices

### ✅ DO:
- Use specific product filters (productId, code) for better performance
- Combine product filters with deal filters for precise targeting
- Use pagination for large result sets
- Index frequently filtered product fields

### ❌ DON'T:
- Filter on JSON fields (prices, metadata) - not supported
- Use text search on large description fields without necessity
- Combine too many product filters without testing performance
- Filter without considering data volume

---

## Summary

### Key Features
✅ **Filter by DealProduct fields** - Quantity, pricing, discounts, tax, billing  
✅ **Filter by Product fields** - Name, code, category, status  
✅ **Seamless integration** - Works with existing Deal, DealDetails, and CustomField filters  
✅ **AND/OR logic** - Complex filtering across multiple tables  
✅ **Automatic JOINs** - Smart INNER JOIN when filtering  
✅ **Date support** - Full date range filtering for billing dates  

### Filter Categories Supported
1. Deal fields (title, value, pipeline, etc.)
2. DealDetails fields (status, responsible person, etc.)
3. **DealProduct fields** (quantity, total, billing, etc.) ← NEW
4. **Product fields** (name, category, isActive, etc.) ← NEW
5. CustomFields (any custom fields)

### Example Use Cases
- 🔍 Find deals with high-value product lines
- 🔍 Find deals with specific product categories
- 🔍 Find deals with recurring billing
- 🔍 Find deals with active products only
- 🔍 Find deals with bulk quantities
- 🔍 Find deals with high discounts

---

**Document Version:** 1.0  
**Last Updated:** November 29, 2025  
**Related Documentation:**
- `DEALS_FILTERID_DOCUMENTATION.md` - Core filterId functionality
- `PRODUCT_MANAGEMENT_README.md` - Product management API
- `DEAL_PRODUCT_INTEGRATION.md` - Deal-product integration

---

**Author:** CRM Development Team
