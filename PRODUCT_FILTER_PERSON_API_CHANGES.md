# Product Filtering in getPersonsAndOrganizations API

## 🎯 Objective
Add product filtering to the `getPersonsAndOrganizations` API following the Pipedrive pattern:

**"Show all persons connected to deals that have specific products"**

## 📋 Implementation Plan

### Step 1: Initialize Product WHERE Clauses

**Location**: After line 6429 in `leadContactController.js`

```javascript
let productWhere = {};
let dealProductWhere = {};
```

**Already Done** ✅ - Added in previous edit

### Step 2: Load Product Model Fields

**Location**: After Activity model loading (around line 6595)

```javascript
// Get product and dealProduct field names for product filtering
let productFields = [];
let dealProductFields = [];
try {
  const Product = require("../../models/product/productModel");
  const DealProduct = require("../../models/product/dealProductModel");
  productFields = Object.keys(Product.rawAttributes);
  dealProductFields = Object.keys(DealProduct.rawAttributes);
} catch (e) {
  console.log("[DEBUG] Product models not available:", e.message);
}

console.log("- Product fields:", productFields.slice(0, 5), "...");
console.log("- DealProduct fields:", dealProductFields.slice(0, 5), "...");
```

###Step 3: Add Product Entity Cases to Switch Statement

**Location**: In the `filterConfig.all.forEach()` loop (around line 6623-6700)

Add these cases to the `switch (cond.entity.toLowerCase())` statement:

```javascript
case "product":
  if (productFields.includes(cond.field)) {
    if (!productWhere[Op.and]) productWhere[Op.and] = [];
    productWhere[Op.and].push(buildCondition(cond));
    console.log(
      `[DEBUG] Added Product AND condition for field: ${cond.field}`
    );
  }
  break;

case "dealproduct":
  if (dealProductFields.includes(cond.field)) {
    if (!dealProductWhere[Op.and]) dealProductWhere[Op.and] = [];
    dealProductWhere[Op.and].push(buildCondition(cond));
    console.log(
      `[DEBUG] Added DealProduct AND condition for field: ${cond.field}`
    );
  }
  break;
```

And in the auto-detect section (around line 6760):

```javascript
} else if (productFields.includes(cond.field)) {
  if (!productWhere[Op.and]) productWhere[Op.and] = [];
  productWhere[Op.and].push(buildCondition(cond));
  console.log(
    `[DEBUG] Auto-detected Product AND condition for field: ${cond.field}`
  );
} else if (dealProductFields.includes(cond.field)) {
  if (!dealProductWhere[Op.and]) dealProductWhere[Op.and] = [];
  dealProductWhere[Op.and].push(buildCondition(cond));
  console.log(
    `[DEBUG] Auto-detected DealProduct AND condition for field: ${cond.field}`
  );
}
```

### Step 4: Add Product OR Conditions

**Location**: In the `filterConfig.any.forEach()` loop (around line 6833-6900)

Add same cases for OR conditions:

```javascript
case "product":
  if (productFields.includes(cond.field)) {
    if (!productWhere[Op.or]) productWhere[Op.or] = [];
    productWhere[Op.or].push(buildCondition(cond));
    console.log(
      `[DEBUG] Added Product OR condition for field: ${cond.field}`
    );
  }
  break;

case "dealproduct":
  if (dealProductFields.includes(cond.field)) {
    if (!dealProductWhere[Op.or]) dealProductWhere[Op.or] = [];
    dealProductWhere[Op.or].push(buildCondition(cond));
    console.log(
      `[DEBUG] Added DealProduct OR condition for field: ${cond.field}`
    );
  }
  break;
```

And auto-detect section:

```javascript
} else if (productFields.includes(cond.field)) {
  if (!productWhere[Op.or]) productWhere[Op.or] = [];
  productWhere[Op.or].push(buildCondition(cond));
  console.log(
    `[DEBUG] Auto-detected Product OR condition for field: ${cond.field}`
  );
} else if (dealProductFields.includes(cond.field)) {
  if (!dealProductWhere[Op.or]) dealProductWhere[Op.or] = [];
  dealProductWhere[Op.or].push(buildCondition(cond));
  console.log(
    `[DEBUG] Auto-detected DealProduct OR condition for field: ${cond.field}`
  );
}
```

### Step 5: Add Product Filter Detection

**Location**: After `hasOrgFilters` declaration (around line 6960)

```javascript
const hasProductFilters =
  Object.keys(productWhere).length > 0 ||
  (productWhere[Op.and] && productWhere[Op.and].length > 0) ||
  (productWhere[Op.or] && productWhere[Op.or].length > 0);

const hasDealProductFilters =
  Object.keys(dealProductWhere).length > 0 ||
  (dealProductWhere[Op.and] && dealProductWhere[Op.and].length > 0) ||
  (dealProductWhere[Op.or] && dealProductWhere[Op.or].length > 0);

console.log("[DEBUG] Filter detection:");
console.log("- hasProductFilters:", hasProductFilters);
console.log("- hasDealProductFilters:", hasDealProductFilters);
```

### Step 6: Apply Product Filters to Find Person IDs

**Location**: After Organization filter application (around line 7220)

```javascript
// Apply Product filters to get relevant person IDs via deals
let productFilteredPersonIds = [];
const hasProductFiltersSymbol =
  productWhere[Op.and]?.length > 0 ||
  productWhere[Op.or]?.length > 0 ||
  dealProductWhere[Op.and]?.length > 0 ||
  dealProductWhere[Op.or]?.length > 0 ||
  Object.keys(productWhere).some((key) => typeof key === "string") ||
  Object.keys(dealProductWhere).some((key) => typeof key === "string");

if (hasProductFiltersSymbol) {
  console.log("[DEBUG] Applying Product filters to find persons via deals");
  console.log("[DEBUG] productWhere:", JSON.stringify(productWhere, null, 2));
  console.log("[DEBUG] dealProductWhere:", JSON.stringify(dealProductWhere, null, 2));

  try {
    const Product = require("../../models/product/productModel");
    const DealProduct = require("../../models/product/dealProductModel");

    // Find deals that have products matching the filter
    const dealProductIncludes = [];

    // Build include for DealProduct -> Product
    const dealProductInclude = {
      model: DealProduct,
      as: "dealProducts",
      required: true,
      attributes: ["dealProductId", "dealId", "productId"]
    };

    // Add Product include if product WHERE conditions exist
    if (Object.keys(productWhere).length > 0 || 
        productWhere[Op.and]?.length > 0 || 
        productWhere[Op.or]?.length > 0) {
      dealProductInclude.include = [{
        model: Product,
        as: "product",
        where: productWhere,
        required: true
      }];
    }

    // Apply DealProduct WHERE conditions if they exist
    if (Object.keys(dealProductWhere).length > 0 || 
        dealProductWhere[Op.and]?.length > 0 || 
        dealProductWhere[Op.or]?.length > 0) {
      dealProductInclude.where = dealProductWhere;
    }

    let dealsWithProductsWhere = {};
    if (req.role !== "admin") {
      dealsWithProductsWhere = {
        [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }]
      };
    }

    const dealsWithProducts = await Deal.findAll({
      where: dealsWithProductsWhere,
      attributes: ["dealId", "personId", "leadOrganizationId"],
      include: [dealProductInclude],
      subQuery: false,
      distinct: true,
      raw: false
    });

    console.log(
      "[DEBUG] Product filter results:",
      dealsWithProducts.length,
      "deals found with matching products"
    );

    // Get person IDs directly from deals
    const directPersonIds = dealsWithProducts
      .map((deal) => deal.personId)
      .filter(Boolean);

    // Get organization IDs from deals, then find persons in those organizations
    const dealOrgIds = dealsWithProducts
      .map((deal) => deal.leadOrganizationId)
      .filter(Boolean);

    let orgPersonIds = [];
    if (dealOrgIds.length > 0) {
      const personsInOrgs = await Person.findAll({
        where: { leadOrganizationId: { [Op.in]: dealOrgIds } },
        attributes: ["personId"],
        raw: true,
      });
      orgPersonIds = personsInOrgs.map((p) => p.personId);
    }

    productFilteredPersonIds = [
      ...new Set([...directPersonIds, ...orgPersonIds]),
    ];

    console.log(
      "[DEBUG] Product-filtered person IDs:",
      productFilteredPersonIds.length
    );
  } catch (e) {
    console.log("[DEBUG] Error applying Product filters:", e.message);
  }
}
```

### Step 7: Include Product Filtered Person IDs in Final Filter

**Location**: Update `allFilteredPersonIds` array (around line 7320)

```javascript
const allFilteredPersonIds = [
  ...new Set([
    ...leadFilteredPersonIds,
    ...activityFilteredPersonIds,
    ...dealFilteredPersonIds,
    ...orgFilteredPersonIds,
    ...personFilteredPersonIds,
    ...productFilteredPersonIds, // ADD THIS LINE
    ...specificPersonIds,
  ]),
];
```

### Step 8: Update Debug Logging

**Location**: After allFilteredPersonIds (around line 7335)

```javascript
console.log(
  "[DEBUG] - From products:",
  productFilteredPersonIds.length,
  "person IDs"
);
```

### Step 9: Update Empty Results Check

**Location**: In the empty results check (around line 7385)

```javascript
} else if (
  hasLeadFiltersSymbol ||
  hasActivityFiltersSymbol ||
  hasDealFiltersSymbol ||
  hasOrgFiltersSymbol ||
  hasPersonFiltersSymbol ||
  hasProductFiltersSymbol // ADD THIS LINE
) {
```

## 🧪 Testing

### Test Case 1: Filter by Product Name
```javascript
{
  "filterId": {
    "all": [
      {
        "entity": "Product",
        "field": "name",
        "operator": "is",
        "value": "Website Development Service"
      }
    ]
  }
}
```

**Expected Result**: Returns all persons connected to deals that have the product "Website Development Service"

### Test Case 2: Filter by Product Code
```javascript
{
  "filterId": {
    "all": [
      {
        "entity": "Product",
        "field": "code",
        "operator": "contains",
        "value": "WEB"
      }
    ]
  }
}
```

**Expected Result**: Returns all persons connected to deals with products whose code contains "WEB"

### Test Case 3: Filter by Product Category
```javascript
{
  "filterId": {
    "all": [
      {
        "entity": "Product",
        "field": "category",
        "operator": "is",
        "value": "Services"
      }
    ]
  }
}
```

### Test Case 4: Filter by Deal Product Quantity
```javascript
{
  "filterId": {
    "all": [
      {
        "entity": "DealProduct",
        "field": "quantity",
        "operator": "greater than",
        "value": 1
      }
    ]
  }
}
```

## 📊 How It Works

```
┌─────────────────┐
│  Filter Request │
│  product.name = │
│ "Website Dev"   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Find Products  │
│  WHERE name =   │
│ "Website Dev"   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Find Deals     │
│  WITH those     │
│  products       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract Person  │
│ IDs from those  │
│ deals           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Persons │
│  matching those │
│  IDs            │
└─────────────────┘
```

## ✅ Benefits

1. **Pipedrive Pattern**: Matches Pipedrive's behavior exactly
2. **Flexible Filtering**: Can filter by any product field (name, code, category, price, etc.)
3. **Deal Product Filtering**: Can also filter by deal-specific product data (quantity, discount, etc.)
4. **Consistent Logic**: Uses same pattern as Lead/Activity/Deal/Organization filtering
5. **Organization Support**: Includes persons from same organization as filtered deals

## 🔧 Key Concepts

- **Product → DealProduct → Deal → Person**: The chain of relationships
- **Role-Based Access**: Respects admin vs regular user permissions
- **Organization Inclusion**: Shows all persons in same org as filtered deals
- **Symbol Operators**: Properly detects `Op.and` and `Op.or` conditions
- **Error Handling**: Gracefully handles missing Product models
