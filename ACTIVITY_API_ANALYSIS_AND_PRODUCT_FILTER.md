# getActivities API - Complete Analysis & Product Filter Implementation

## 📋 API Overview

**Location**: `controllers/activity/activityController.js` (Line 252)  
**Method**: GET  
**Endpoint**: `/api/activities`  
**Purpose**: Fetch activities with advanced filtering, pagination, custom fields, and timeline information

---

## 🎯 Current Functionality

### 1. **Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Items per page (default: 100) |
| `search` | String | Search in subject/description |
| `type` | String/Array | Activity type filter (Meeting, Task, Call, etc.) |
| `assignedTo` | Number | Filter by assigned user ID |
| `isDone` | Boolean | Filter by completion status |
| `personId` | Number | Filter by person ID |
| `leadOrganizationId` | Number | Filter by organization ID |
| `dealId` | Number | Filter by deal ID |
| `leadId` | Number | Filter by lead ID |
| `dateFilter` | String | Date preset filter (overdue, today, tomorrow, this_week, next_week, To-do) |
| `filterId` | Number | Saved filter ID |
| `startDate` | Date | Start date for select_period |
| `endDate` | Date | End date for select_period |
| `priority` | String | Priority filter |
| `status` | String | Status filter |
| `masterUserID` | Number | Filter by specific user |
| `entityType` | String | Entity type for filter (Activity, Lead, Deal, Person, Organization) |

### 2. **Column Preferences System**

The API uses `ActivityColumnPreference` model to determine which columns to show:

```javascript
const pref = await ActivityColumnPreference.findOne();
// Extracts checked columns for Activity and Deal entities
// Handles both standard fields and custom fields
```

**Key Features**:
- Dynamically loads Activity fields based on preferences
- Supports Deal columns in activity list
- Shows NULL for deal columns if activity not linked to deal
- Filters custom fields by checked status

### 3. **Filter System (filterId)**

When `filterId` is provided:
1. Loads filter configuration from `LeadFilter` table
2. Parses `filterConfig` JSON with `all` (AND) and `any` (OR) arrays
3. Builds Sequelize WHERE conditions
4. Supports cross-entity filtering:
   - Activity fields → Direct conditions
   - Lead fields → `$ActivityLead.field$` syntax
   - Deal fields → `$ActivityDeal.field$` syntax
   - Person fields → `$ActivityPerson.field$` syntax
   - Organization fields → `$ActivityOrganization.field$` syntax

**Example filterConfig**:
```json
{
  "all": [
    {
      "entity": "Activity",
      "field": "type",
      "operator": "is",
      "value": "Meeting"
    },
    {
      "entity": "Deal",
      "field": "title",
      "operator": "contains",
      "value": "Website"
    }
  ],
  "any": []
}
```

### 4. **Date Filtering**

Sophisticated date handling with presets:

| Filter | Behavior |
|--------|----------|
| `overdue` | `startDateTime < today AND isDone = false` |
| `today` | `dueDate >= today AND dueDate < tomorrow` |
| `tomorrow` | `startDateTime >= tomorrow AND startDateTime < day after` |
| `this_week` | `dueDate >= Monday AND dueDate < Sunday` |
| `next_week` | `dueDate >= next Monday AND dueDate < Monday after` |
| `select_period` | Custom date range using startDate/endDate |
| `To-do` | `isDone = false` (+ overdue/upcoming counts) |

### 5. **Advanced Type Filtering**

Supports multiple formats:
```javascript
// Format 1: Multiple query params
?type=Meeting&type=Task

// Format 2: Comma-separated
?type=Meeting,Task

// Format 3: Single type
?type=Meeting
```

### 6. **Role-Based Access Control**

```javascript
if (masterUserID) {
  // Filter by specific user (admin can view any user)
  where.masterUserID = masterUserID;
} else if (req.role !== "admin") {
  // Regular users see:
  // 1. Activities they created (masterUserID)
  // 2. Activities assigned to them (assignedTo)
  where[Op.or] = [
    { masterUserID: req.adminId },
    { assignedTo: req.adminId }
  ];
}
// Admins see ALL activities
```

### 7. **Included Relationships**

The query includes:

1. **ActivityLead** (Lead model)
   - All Lead fields
   - Required only when entityType === "Lead"
   - Applied filter when Lead entity type

2. **ActivityDeal** (Deal model)
   - Checked Deal columns OR default [dealId]
   - Required only when entityType === "Deal"
   - Applied filter when Deal entity type

3. **ActivityOrganization** (Organizations model)
   - All Organization fields
   - Required only when entityType === "Organization"
   - Applied filter when Organization entity type

4. **ActivityPerson** (Person model)
   - All Person fields
   - Required only when entityType === "Person"
   - Applied filter when Person entity type

5. **assignedUser** (MasterUser model)
   - [masterUserID, name, email]
   - Always LEFT JOIN (not required)
   - Used to show assignedUserName

### 8. **Custom Fields System**

**Phase 1: Load Available Custom Fields**
```javascript
// Fetches custom fields for all entity types
// Filters by checked status from ActivityColumnPreference
// Supports multiple entityTypes: lead, deal, person, organization
```

**Phase 2: Fetch Custom Field Values**
```javascript
// After getting activities
// Extracts all related entity IDs (leadIds, dealIds, personIds, organizationIds)
// Fetches CustomFieldValue records for ALL related entities
// Organizes by entity type and entity ID
```

**Phase 3: Attach to Response**
```javascript
// For each activity:
// - Add lead custom fields (if activity linked to lead)
// - Add deal custom fields (ALL activities get columns, null if no deal)
// - Add person custom fields (if activity linked to person)
// - Add organization custom fields (if activity linked to organization)
```

**Naming Convention**:
- Lead custom fields: `lead_fieldName`
- Deal custom fields: `deal_cf_fieldName`
- Person custom fields: `person_fieldName`
- Organization custom fields: `org_fieldName`

### 9. **Response Transformation**

```javascript
const activitiesWithTitle = activities.map((activity) => {
  // Destructure included models
  const { ActivityLead, ActivityDeal, ActivityOrganization, ActivityPerson, assignedUser, ...rest } = activity;
  
  let result = { ...rest };
  
  // Add assignedUserName
  result.assignedUserName = assignedUser ? assignedUser.name : null;
  
  // Add title (from Lead or Deal)
  if (rest.leadId && ActivityLead) {
    result.title = ActivityLead.title;
  } else if (rest.dealId && ActivityDeal) {
    result.title = ActivityDeal.title;
  }
  
  // Add deal columns (null if no deal)
  if (hasDealColumns) {
    dealColumns.forEach(column => {
      result[`deal_${column}`] = ActivityDeal?.[column] || null;
    });
  }
  
  // Add organization, contactPerson, email
  result.organization = ActivityOrganization?.organization || null;
  result.contactPerson = ActivityPerson?.contactPerson || null;
  result.email = ActivityPerson?.email || null;
  
  // Add custom fields (see above)
  
  return result;
});
```

### 10. **To-do Counts Feature**

When `dateFilter === "To-do"`, the API returns additional counts:

```javascript
responseData.counts = {
  overdue: count,    // startDateTime < today AND isDone = false
  upcoming: count,   // startDateTime >= today AND isDone = false
  total: count       // sum of overdue + upcoming
};
```

**Important**: Counts respect same filters as main query (assignedTo, type, search, RBAC, etc.)

---

## 🎯 Product Filter Implementation

### Goal
Add product filtering to `getActivities` API following Pipedrive pattern:
- Show activities connected to deals that have specific products
- Support both AND and OR filtering logic
- Maintain existing filter architecture

### Relationship Chain
```
Activity → Deal → DealProduct → Product
```

### Implementation Steps

#### Step 1: Initialize Product WHERE Clauses
```javascript
// After line 310 (inside filterId block, after activityFields declaration)
let productWhere = {};
let dealProductWhere = {};
```

#### Step 2: Load Product Model Fields
```javascript
// After initializing WHERE clauses
let productFields = [];
let dealProductFields = [];
try {
  const Product = require("../../models/product/productModel");
  const DealProduct = require("../../models/product/dealProductModel");
  productFields = Object.keys(Product.rawAttributes);
  dealProductFields = Object.keys(DealProduct.rawAttributes);
  console.log("- Product fields:", productFields);
  console.log("- DealProduct fields:", dealProductFields);
} catch (e) {
  console.log("[DEBUG] Product models not available:", e.message);
}
```

#### Step 3: Add Product Cases to AND Filter
```javascript
// Inside the 'all.forEach' loop, after Organization case
} else if (cond.entity === "product") {
  if (productFields.includes(cond.field)) {
    if (!productWhere[Op.and]) productWhere[Op.and] = [];
    const condition = buildCondition(cond);
    if (condition && Object.keys(condition).length > 0) {
      productWhere[Op.and].push(condition);
      console.log(`[DEBUG] Added Product AND condition for field: ${cond.field}`);
    }
  }
} else if (cond.entity === "dealproduct") {
  if (dealProductFields.includes(cond.field)) {
    if (!dealProductWhere[Op.and]) dealProductWhere[Op.and] = [];
    const condition = buildCondition(cond);
    if (condition && Object.keys(condition).length > 0) {
      dealProductWhere[Op.and].push(condition);
      console.log(`[DEBUG] Added DealProduct AND condition for field: ${cond.field}`);
    }
  }
}
```

#### Step 4: Add Product Cases to OR Filter
```javascript
// Inside the 'any.forEach' loop, after Organization case
} else if (cond.entity === "product") {
  if (productFields.includes(cond.field)) {
    if (!productWhere[Op.or]) productWhere[Op.or] = [];
    const condition = buildCondition(cond);
    if (condition && Object.keys(condition).length > 0) {
      productWhere[Op.or].push(condition);
      console.log(`[DEBUG] Added Product OR condition for field: ${cond.field}`);
    }
  }
} else if (cond.entity === "dealproduct") {
  if (dealProductFields.includes(cond.field)) {
    if (!dealProductWhere[Op.or]) dealProductWhere[Op.or] = [];
    const condition = buildCondition(cond);
    if (condition && Object.keys(condition).length > 0) {
      dealProductWhere[Op.or].push(condition);
      console.log(`[DEBUG] Added DealProduct OR condition for field: ${cond.field}`);
    }
  }
}
```

#### Step 5: Apply Product Filter
```javascript
// After the finalWhere definition (around line 505)
// Before the Activity.findAndCountAll query

// Apply Product filters to get relevant activity IDs (through deals)
let productFilteredActivityIds = [];
const hasProductFilters = 
  productWhere[Op.and]?.length > 0 ||
  productWhere[Op.or]?.length > 0 ||
  dealProductWhere[Op.and]?.length > 0 ||
  dealProductWhere[Op.or]?.length > 0 ||
  Object.keys(productWhere).some((key) => typeof key === "string") ||
  Object.keys(dealProductWhere).some((key) => typeof key === "string");

console.log("[DEBUG] hasProductFilters:", hasProductFilters);

if (hasProductFilters) {
  try {
    console.log("[DEBUG] Applying Product filters to find activities through deals");
    console.log("[DEBUG] productWhere:", JSON.stringify(productWhere));
    console.log("[DEBUG] dealProductWhere:", JSON.stringify(dealProductWhere));
    
    const Product = require("../../models/product/productModel");
    const DealProduct = require("../../models/product/dealProductModel");
    
    // Build include array for product filtering
    let productInclude = [];
    
    // Add DealProduct include
    const dealProductInclude = {
      model: DealProduct,
      as: "dealProducts",
      required: true,
      attributes: []
    };
    
    // Add Product include if we have product conditions
    if (Object.keys(productWhere).length > 0) {
      dealProductInclude.include = [{
        model: Product,
        as: "product",
        where: productWhere,
        required: true,
        attributes: []
      }];
    }
    
    // Add dealProduct where if we have dealProduct conditions
    if (Object.keys(dealProductWhere).length > 0) {
      dealProductInclude.where = dealProductWhere;
    }
    
    productInclude.push(dealProductInclude);
    
    // Query deals that match product criteria
    const dealsWithProducts = await Deal.findAll({
      attributes: ["dealId"],
      include: productInclude,
      raw: true
    });
    
    console.log(`[DEBUG] Product filter results: ${dealsWithProducts.length} deals found with matching products`);
    
    if (dealsWithProducts.length > 0) {
      const dealIds = dealsWithProducts.map((deal) => deal.dealId).filter(Boolean);
      console.log(`[DEBUG] Deal IDs with matching products: ${dealIds.length}`);
      
      // Find activities connected to these deals
      const activitiesWithProducts = await Activity.findAll({
        where: {
          dealId: { [Op.in]: dealIds }
        },
        attributes: ["activityId"],
        raw: true
      });
      
      productFilteredActivityIds = activitiesWithProducts.map((a) => a.activityId).filter(Boolean);
      console.log(`[DEBUG] Product-filtered activity IDs: ${productFilteredActivityIds.length}`);
      
    } else {
      console.log("[DEBUG] No deals found with matching products - will return empty result");
      productFilteredActivityIds = [-1]; // No matching activities
    }
  } catch (e) {
    console.log("[DEBUG] Error applying Product filters:", e.message);
    console.error("[DEBUG] Full error:", e);
  }
}
```

#### Step 6: Merge Product Filter with Main Query
```javascript
// Modify the finalWhere to include product-filtered activity IDs
if (hasProductFilters && productFilteredActivityIds.length > 0) {
  if (!finalWhere[Op.and]) finalWhere[Op.and] = [];
  finalWhere[Op.and].push({
    activityId: { [Op.in]: productFilteredActivityIds }
  });
  console.log(`[DEBUG] Added ${productFilteredActivityIds.length} product-filtered activity IDs to main query`);
}

// Handle empty results case
if (hasProductFilters && productFilteredActivityIds.length === 1 && productFilteredActivityIds[0] === -1) {
  console.log("[DEBUG] Product filters resulted in no matches - returning empty result");
  return res.status(200).json({
    total: 0,
    totalPages: 0,
    currentPage: parseInt(page),
    activities: [],
  });
}
```

---

## 🧪 Testing

### Test Case 1: Product Code Filter
```javascript
// Filter: Product code = "WEB-001"
GET /api/activities?filterId=101

// Expected filterConfig in LeadFilter table (id=101):
{
  "all": [
    {
      "entity": "product",
      "field": "code",
      "operator": "is",
      "value": "WEB-001"
    }
  ],
  "any": []
}

// Expected Result:
// Only activities linked to deals that have product with code "WEB-001"
```

### Test Case 2: Product Name Contains
```javascript
GET /api/activities?filterId=102

// filterConfig:
{
  "all": [
    {
      "entity": "product",
      "field": "name",
      "operator": "contains",
      "value": "Website"
    }
  ]
}
```

### Test Case 3: Multiple Product Filters (AND)
```javascript
GET /api/activities?filterId=103

// filterConfig:
{
  "all": [
    {
      "entity": "product",
      "field": "category",
      "operator": "is",
      "value": "Services"
    },
    {
      "entity": "dealproduct",
      "field": "quantity",
      "operator": "greater than",
      "value": 0
    }
  ]
}
```

### Test Case 4: Product OR Activity Type
```javascript
GET /api/activities?filterId=104

// filterConfig:
{
  "all": [],
  "any": [
    {
      "entity": "product",
      "field": "code",
      "operator": "is",
      "value": "WEB-001"
    },
    {
      "entity": "Activity",
      "field": "type",
      "operator": "is",
      "value": "Meeting"
    }
  ]
}

// Expected: Activities that either:
// 1. Are linked to deals with product "WEB-001", OR
// 2. Are of type "Meeting"
```

### Test Case 5: Combined Deal + Product Filter
```javascript
GET /api/activities?filterId=105

// filterConfig:
{
  "all": [
    {
      "entity": "Deal",
      "field": "status",
      "operator": "is",
      "value": "open"
    },
    {
      "entity": "product",
      "field": "category",
      "operator": "is",
      "value": "Services"
    }
  ]
}

// Expected: Activities linked to open deals that have service products
```

---

## 🔍 Debug Logging

The implementation includes comprehensive logging:

```javascript
// Product fields loaded
"- Product fields: [ 'productId', 'name', 'code', 'category', ... ]"

// Filter detection
"[DEBUG] hasProductFilters: true"

// Condition building
"[DEBUG] Added Product AND condition for field: code"

// Query execution
"[DEBUG] Applying Product filters to find activities through deals"
"[DEBUG] Product filter results: 5 deals found with matching products"

// ID extraction
"[DEBUG] Deal IDs with matching products: 5"
"[DEBUG] Product-filtered activity IDs: 12"

// Integration
"[DEBUG] Added 12 product-filtered activity IDs to main query"
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    getActivities API                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Parse Query Parameters & Load Preferences          │
│  - page, limit, search, type, dateFilter, etc.              │
│  - ActivityColumnPreference for checked columns             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Load Filter Configuration (if filterId present)    │
│  - Fetch from LeadFilter table                              │
│  - Parse filterConfig JSON (all/any arrays)                 │
│  - Initialize WHERE clauses for all entity types            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Build Filter Conditions                            │
│  - Activity filters → activityWhere                         │
│  - Lead filters → $ActivityLead.field$ syntax               │
│  - Deal filters → $ActivityDeal.field$ syntax               │
│  - Person filters → $ActivityPerson.field$ syntax           │
│  - Organization filters → $ActivityOrganization.field$      │
│  - **Product filters → productWhere + dealProductWhere**    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Apply Date Filters                                 │
│  - overdue, today, tomorrow, this_week, next_week           │
│  - select_period with startDate/endDate                     │
│  - To-do (isDone = false)                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Apply Additional Filters                           │
│  - search (subject/description)                             │
│  - type (single/multiple)                                   │
│  - isDone, personId, leadOrganizationId, dealId, leadId     │
│  - assignedTo                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Apply RBAC                                         │
│  - Admin: See all activities                                │
│  - Regular users: See owned + assigned activities           │
│  - Respect masterUserID parameter if provided               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  **Step 7: Apply Product Filter (NEW)**                     │
│  1. Detect if product filters exist                         │
│  2. Query: Deal → DealProduct → Product                     │
│  3. Extract dealIds with matching products                  │
│  4. Query: Activity WHERE dealId IN (dealIds)               │
│  5. Extract productFilteredActivityIds                      │
│  6. Add to finalWhere: activityId IN (...)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 8: Execute Main Query                                 │
│  - Activity.findAndCountAll with all filters                │
│  - Include: Lead, Deal, Organization, Person, assignedUser  │
│  - Pagination: limit, offset                                │
│  - Order by startDateTime DESC                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 9: Fetch Custom Fields                                │
│  1. Extract entity IDs from activities                      │
│  2. Query CustomFieldValue for all entity types             │
│  3. Organize by entity type and entity ID                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 10: Transform Response                                │
│  - Add assignedUserName                                     │
│  - Add title (from Lead or Deal)                            │
│  - Add deal columns (null if no deal)                       │
│  - Add organization, contactPerson, email                   │
│  - Attach custom fields by entity type                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 11: Calculate To-do Counts (if dateFilter = "To-do")  │
│  - Count overdue activities                                 │
│  - Count upcoming activities                                │
│  - Respect same filters as main query                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 12: Return Response                                   │
│  {                                                          │
│    total, totalPages, currentPage,                          │
│    activities: [...],                                       │
│    counts: { overdue, upcoming, total } // if To-do         │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Differences from Person/Organization APIs

1. **Direct Activity Filter**: Activities can be filtered directly (don't need intermediate entity)
2. **Multiple Entity Relationships**: Activity can link to Lead, Deal, Person, Organization simultaneously
3. **To-do Counts**: Special feature for task management
4. **Column Preferences**: Dynamic column selection from ActivityColumnPreference
5. **Deal Columns in Activities**: Show deal fields in activity list
6. **Custom Fields from Multiple Sources**: Can show custom fields from 4 different entity types

---

## ✅ Implementation Checklist

- [ ] Initialize productWhere and dealProductWhere
- [ ] Load Product and DealProduct model fields
- [ ] Add product cases to AND filter loop
- [ ] Add product cases to OR filter loop
- [ ] Apply product filter to get activity IDs
- [ ] Merge product filter with main query
- [ ] Handle empty results case
- [ ] Add debug logging
- [ ] Test with product code filter
- [ ] Test with product name filter
- [ ] Test with combined filters
- [ ] Test empty results
- [ ] Verify RBAC still works
- [ ] Verify pagination works
- [ ] Verify custom fields still load

---

## 🚀 Next Steps

After implementation:
1. Test all date filters with product filters
2. Test type filtering with product filters
3. Test RBAC with product filters
4. Test pagination with large result sets
5. Test To-do counts with product filters
6. Verify custom fields still work
7. Test performance with multiple product conditions

