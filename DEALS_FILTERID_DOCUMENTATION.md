# 🔍 Deep Dive: filterId in getDeals API

## Overview
The `filterId` parameter in the `getDeals` API enables **advanced dynamic filtering** using saved filter configurations. It allows users to create complex filter conditions with AND/OR logic for standard fields, related table fields, and custom fields.

---

## 📋 Table of Contents
1. [Filter Structure](#filter-structure)
2. [How filterId Works](#how-filterid-works)
3. [Filter Processing Flow](#filter-processing-flow)
4. [Field Types & Processing](#field-types--processing)
5. [Custom Field Filtering](#custom-field-filtering)
6. [Operator Mapping](#operator-mapping)
7. [Permission Handling](#permission-handling)
8. [Complete Examples](#complete-examples)
9. [Technical Implementation](#technical-implementation)

---

## 1. Filter Structure

### LeadFilter Model Schema
```javascript
{
  filterId: INTEGER (Primary Key),
  filterName: STRING,
  filterConfig: JSON,  // Core filter conditions
  visibility: STRING,  // "Private" or "Public"
  masterUserID: INTEGER,
  columns: JSON,       // Optional: selected columns
  filterEntityType: ENUM('lead', 'deal', 'person', 'organization', 'activity'),
  isFavorite: BOOLEAN
}
```

### FilterConfig Structure
```javascript
{
  "all": [   // AND logic - ALL conditions must match
    {
      "field": "pipeline",
      "operator": "eq",
      "value": "Sales Pipeline"
    },
    {
      "field": "expectedCloseDate",
      "operator": "gte",
      "value": "2024-01-01"
    }
  ],
  "any": [   // OR logic - ANY condition can match
    {
      "field": "pipelineStage",
      "operator": "eq",
      "value": "Proposal"
    },
    {
      "field": "pipelineStage",
      "operator": "eq",
      "value": "Negotiation"
    }
  ]
}
```

---

## 2. How filterId Works

### API Request
```http
GET /api/deals/get?filterId=123&page=1&limit=20
```

### High-Level Processing Steps

1. **Fetch Filter**: Retrieve saved filter from `LeadFilter` table by `filterId`
2. **Parse Config**: Extract `all` and `any` conditions from `filterConfig` JSON
3. **Categorize Fields**: Separate conditions into:
   - Deal model fields (e.g., `title`, `pipeline`)
   - DealDetails model fields (e.g., `responsiblePerson`, `ownerName`)
   - Custom fields (anything not in standard models)
4. **Build WHERE Clauses**: Construct Sequelize WHERE conditions
5. **Apply Permissions**: Add user-specific filtering (admin vs non-admin)
6. **Execute Query**: Run filtered query with joins
7. **Return Results**: Paginated deals with custom fields attached

---

## 3. Filter Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. RECEIVE FILTER ID                                            │
│    GET /api/deals/get?filterId=123                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FETCH SAVED FILTER                                           │
│    SELECT * FROM LeadFilter WHERE filterId = 123                │
│    Result: { filterName: "Hot Deals", filterConfig: {...} }    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PARSE FILTER CONFIG                                          │
│    all: [cond1, cond2]  ← AND logic (ALL must match)           │
│    any: [cond3, cond4]  ← OR logic (ANY can match)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CATEGORIZE CONDITIONS BY FIELD TYPE                          │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Deal Fields     │  │ DealDetails      │  │ Custom Fields  │ │
│  │ • pipeline      │  │ • responsiblePer │  │ • industry     │ │
│  │ • title         │  │ • ownerName      │  │ • leadScore    │ │
│  │ • value         │  │ • status         │  │ • customField1 │ │
│  └─────────────────┘  └──────────────────┘  └────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. BUILD SEQUELIZE WHERE CLAUSES                                │
│                                                                  │
│  filterWhere (Deal table):                                      │
│  {                                                               │
│    [Op.and]: [                                                  │
│      { pipeline: { [Op.eq]: "Sales Pipeline" } },              │
│      { value: { [Op.gte]: 10000 } }                            │
│    ],                                                           │
│    [Op.or]: [                                                   │
│      { pipelineStage: "Proposal" },                            │
│      { pipelineStage: "Negotiation" }                          │
│    ]                                                            │
│  }                                                              │
│                                                                  │
│  dealDetailsWhere (DealDetails table):                          │
│  {                                                               │
│    [Op.and]: [                                                  │
│      { status: { [Op.eq]: "active" } }                         │
│    ]                                                            │
│  }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. PROCESS CUSTOM FIELD CONDITIONS                              │
│                                                                  │
│  Step 6.1: buildCustomFieldFilters()                            │
│    - Find custom field definitions by fieldName/fieldId         │
│    - Return: [{ fieldId, condition, logicType, entityType }]   │
│                                                                  │
│  Step 6.2: getDealIdsByCustomFieldFilters()                     │
│    - Query CustomFieldValue table with conditions               │
│    - Handle entityType: "deal" and "lead" (unified fields)     │
│    - Apply AND/OR logic across conditions                       │
│    - Return: [dealId1, dealId2, ...]                           │
│                                                                  │
│  Step 6.3: Add to WHERE clause                                  │
│    filterWhere.dealId = { [Op.in]: matchingDealIds }           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. APPLY USER PERMISSIONS                                       │
│                                                                  │
│  if (req.role === "admin" && masterUserID !== "all") {         │
│    filterWhere[Op.or] = [                                      │
│      { masterUserID: masterUserID },                           │
│      { ownerId: masterUserID }                                 │
│    ]                                                            │
│  } else if (req.role !== "admin") {                            │
│    filterWhere[Op.or] = [                                      │
│      { masterUserID: req.adminId },                            │
│      { ownerId: req.adminId }                                  │
│    ]                                                            │
│  }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. BUILD SEQUELIZE INCLUDE (JOINS)                              │
│                                                                  │
│  include: [                                                      │
│    {                                                             │
│      model: DealDetails,                                        │
│      as: "details",                                             │
│      where: dealDetailsWhere,                                   │
│      required: true/false,                                      │
│      attributes: dealDetailsAttributes                          │
│    }                                                             │
│  ]                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. EXECUTE FINAL QUERY                                          │
│                                                                  │
│  Deal.findAndCountAll({                                         │
│    where: filterWhere,                                          │
│    include: include,                                            │
│    limit: 20,                                                   │
│    offset: 0,                                                   │
│    order: [['createdAt', 'DESC']],                             │
│    attributes: [...selectedColumns]                            │
│  })                                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. POST-PROCESS RESULTS                                        │
│    - Fetch currency descriptions                                │
│    - Attach custom field values to each deal                    │
│    - Calculate deal summary (totalValue, weightedValue)         │
│    - Add conversion flags for lead conversions                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 11. RETURN JSON RESPONSE                                        │
│    {                                                             │
│      totalDeals: 45,                                            │
│      totalPages: 3,                                             │
│      currentPage: 1,                                            │
│      deals: [...],  // with customFields attached              │
│      summary: {...} // totalValue, weightedValue by currency   │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Field Types & Processing

### A. Standard Deal Fields
```javascript
// Examples from Deal model
const dealFields = [
  'dealId', 'title', 'pipeline', 'pipelineStage', 
  'value', 'currency', 'expectedCloseDate', 
  'contactPerson', 'organization', 'email', 'phone',
  'sourceChannel', 'serviceType', 'ownerId', 'masterUserID'
];

// Processing
if (dealFields.includes(cond.field)) {
  filterWhere[Op.and].push(buildCondition(cond));
}
```

**Example Condition:**
```javascript
{
  "field": "pipeline",
  "operator": "eq",
  "value": "Sales Pipeline"
}
```

**Generated WHERE:**
```javascript
{ pipeline: { [Op.eq]: "Sales Pipeline" } }
```

---

### B. DealDetails Fields
```javascript
// Examples from DealDetails model
const dealDetailsFields = [
  'responsiblePerson', 'ownerName', 'status',
  'scopeOfServiceType', 'nextActivityDate'
];

// Processing
if (dealDetailsFields.includes(cond.field)) {
  dealDetailsWhere[Op.and].push(buildCondition(cond));
}

// Added to include with JOIN
include.push({
  model: DealDetails,
  as: "details",
  where: dealDetailsWhere,
  required: true  // INNER JOIN when filtering
});
```

**Example Condition:**
```javascript
{
  "field": "status",
  "operator": "eq",
  "value": "active"
}
```

**Generated SQL:**
```sql
INNER JOIN DealDetails AS details ON Deal.dealId = details.dealId
WHERE details.status = 'active'
```

---

### C. Custom Fields
```javascript
// NOT in Deal or DealDetails models
// Stored in CustomField and CustomFieldValue tables

// Processing
customFieldsConditions.all.push(cond);
// OR
customFieldsConditions.any.push(cond);

// Then processed separately with:
// 1. buildCustomFieldFilters() - find field definitions
// 2. getDealIdsByCustomFieldFilters() - find matching deals
// 3. Add to WHERE: dealId IN (...)
```

**Example Condition:**
```javascript
{
  "field": "industry",  // custom field name
  "operator": "eq",
  "value": "Technology"
}
```

**Processing Steps:**
1. Find custom field: `SELECT * FROM CustomFields WHERE fieldName='industry'`
2. Find values: `SELECT entityId FROM CustomFieldValue WHERE fieldId=X AND value='Technology'`
3. Add to WHERE: `dealId IN (123, 456, 789)`

---

## 5. Custom Field Filtering

### Step 1: Build Custom Field Filters

**Function: `buildCustomFieldFilters(customFieldsConditions, masterUserID)`**

```javascript
// Search for custom field definition by fieldName OR fieldId
const customField = await CustomField.findOne({
  where: {
    [Op.or]: [
      { fieldName: cond.field },
      { fieldId: cond.field }
    ],
    entityType: { [Op.in]: ["deal", "both", "lead"] },
    isActive: true,
    check: true  // Only fields marked for display
  }
});

// Return filter object
return {
  fieldId: customField.fieldId,
  condition: cond,
  logicType: "all" | "any",
  entityType: customField.entityType
};
```

**Key Features:**
- ✅ Searches by `fieldName` first, then `fieldId`
- ✅ Supports unified fields (`entityType: "both"`)
- ✅ Supports lead-sourced fields (when deals converted from leads)
- ✅ Only includes active fields with `check: true`

---

### Step 2: Get Matching Deal IDs

**Function: `getDealIdsByCustomFieldFilters(customFieldFilters, masterUserID)`**

```javascript
// For 'all' filters (AND logic)
if (allFilters.length > 0) {
  let allConditionDealIds = null;
  
  for (const filter of allFilters) {
    const whereCondition = buildCustomFieldCondition(filter.condition, filter.fieldId);
    
    // Query custom field values
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        fieldId: filter.fieldId,
        entityType: { [Op.in]: ["deal", "lead"] },
        ...whereCondition
      }
    });
    
    // Extract dealIds (handle both deal and lead entity types)
    let currentDealIds = [];
    for (const cfv of customFieldValues) {
      if (cfv.entityType === "deal") {
        currentDealIds.push(cfv.entityId);
      } else if (cfv.entityType === "lead") {
        // Find deals converted from this lead
        const deals = await Deal.findAll({
          where: { leadId: cfv.entityId },
          attributes: ["dealId"]
        });
        currentDealIds.push(...deals.map(d => d.dealId));
      }
    }
    
    // AND logic: intersection of all conditions
    if (allConditionDealIds === null) {
      allConditionDealIds = currentDealIds;
    } else {
      allConditionDealIds = allConditionDealIds.filter(id =>
        currentDealIds.includes(id)
      );
    }
  }
  
  dealIds = allConditionDealIds;
}

// For 'any' filters (OR logic)
if (anyFilters.length > 0) {
  let anyConditionDealIds = [];
  
  for (const filter of anyFilters) {
    // ... similar process ...
    anyConditionDealIds = [...anyConditionDealIds, ...currentDealIds];
  }
  
  // Union: combine all matching IDs
  anyConditionDealIds = [...new Set(anyConditionDealIds)];
  
  // Combine with 'all' results if both exist
  if (dealIds.length > 0) {
    dealIds = dealIds.filter(id => anyConditionDealIds.includes(id));
  } else {
    dealIds = anyConditionDealIds;
  }
}

return dealIds;
```

**Key Features:**
- ✅ **AND Logic** (`all`): Intersection - deal must match ALL conditions
- ✅ **OR Logic** (`any`): Union - deal can match ANY condition
- ✅ **Lead Support**: Automatically finds deals converted from filtered leads
- ✅ **Unified Fields**: Searches both "deal" and "lead" entity types

---

### Step 3: Build Custom Field Condition

**Function: `buildCustomFieldCondition(condition, fieldId)`**

```javascript
const operatorMap = {
  is: "eq",
  "is not": "ne",
  "is empty": "isEmpty",
  "is not empty": "isNotEmpty",
  contains: "like",
  "does not contain": "notLike",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt"
};

// Handle special cases
if (operator === "isEmpty") {
  return { value: { [Op.is]: null } };
}

if (operator === "isNotEmpty") {
  return { value: { [Op.not]: null, [Op.ne]: "" } };
}

if (operator === "like") {
  return { value: { [Op.like]: `%${condition.value}%` } };
}

// Default
return {
  value: {
    [ops[operator] || Op.eq]: condition.value
  }
};
```

---

## 6. Operator Mapping

### Comparison Operators
| Frontend Label | Backend Operator | Sequelize Op | Usage |
|---------------|-----------------|--------------|-------|
| `is` | `eq` | `Op.eq` | Exact match |
| `is not` | `ne` | `Op.ne` | Not equal |
| `contains` | `like` | `Op.like` | Text search |
| `does not contain` | `notLike` | `Op.notLike` | Exclude text |

### Empty/Null Operators
| Frontend Label | Backend Operator | SQL | Example |
|---------------|-----------------|-----|---------|
| `is empty` | `isEmpty` | `IS NULL` | Phone is empty |
| `is not empty` | `isNotEmpty` | `IS NOT NULL AND != ''` | Email exists |

### Date Operators
| Frontend Label | Backend Operator | Sequelize Op | Example |
|---------------|-----------------|--------------|---------|
| `is before` | `lt` | `Op.lt` | Before 2024-01-01 (< start) |
| `is after` | `gt` | `Op.gt` | After 2024-01-01 (> end) |
| `is exactly on or before` | `lte` | `Op.lte` | On or before (≤ end) |
| `is exactly on or after` | `gte` | `Op.gte` | On or after (≥ start) |
| Exact date | `eq` | `Op.between` | Full day match |

### Numeric Operators
| Frontend Label | Backend Operator | Sequelize Op | Example |
|---------------|-----------------|--------------|---------|
| `>` | `gt` | `Op.gt` | Value > 10000 |
| `>=` | `gte` | `Op.gte` | Value ≥ 10000 |
| `<` | `lt` | `Op.lt` | Value < 50000 |
| `<=` | `lte` | `Op.lte` | Value ≤ 50000 |

---

## 7. Permission Handling

### Admin Users
```javascript
if (req.role === "admin") {
  if (masterUserID && masterUserID !== "all") {
    // Filter specific user's deals
    filterWhere[Op.or] = [
      { masterUserID: masterUserID },
      { ownerId: masterUserID }
    ];
  } else {
    // Show ALL deals (no filter)
    // Admin sees everything
  }
}
```

**Use Cases:**
- Admin viewing all deals: `?filterId=123` (no masterUserID)
- Admin viewing user's deals: `?filterId=123&masterUserID=456`

---

### Non-Admin Users
```javascript
if (req.role !== "admin") {
  const userId = masterUserID && masterUserID !== "all" 
    ? masterUserID 
    : req.adminId;
  
  // Always filter by user
  filterWhere[Op.or] = [
    { masterUserID: userId },
    { ownerId: userId }
  ];
}
```

**Use Cases:**
- Regular user: Always sees only their own deals
- Even with filterId, cannot see others' deals

---

### Permission Logic Combination

**With Existing Filter Conditions:**
```javascript
if (filterWhere[Op.or]) {
  // Already has OR conditions from filter
  // Combine with AND to preserve both
  filterWhere[Op.and] = [
    { [Op.or]: filterWhere[Op.or] },  // Original filter
    { [Op.or]: [                       // Permission filter
      { masterUserID: userId },
      { ownerId: userId }
    ]}
  ];
  delete filterWhere[Op.or];
}
```

**Generated SQL:**
```sql
WHERE (
  (pipelineStage = 'Proposal' OR pipelineStage = 'Negotiation')  -- Original filter
  AND
  (masterUserID = 123 OR ownerId = 123)  -- Permission filter
)
```

---

## 8. Complete Examples

### Example 1: Simple Standard Field Filter

**Request:**
```http
GET /api/deals/get?filterId=1&page=1&limit=20
```

**Saved Filter (ID: 1):**
```json
{
  "filterId": 1,
  "filterName": "High Value Deals",
  "filterConfig": {
    "all": [
      {
        "field": "value",
        "operator": "gte",
        "value": 50000
      },
      {
        "field": "pipeline",
        "operator": "eq",
        "value": "Sales Pipeline"
      }
    ],
    "any": []
  }
}
```

**Generated WHERE Clause:**
```javascript
{
  [Op.and]: [
    { value: { [Op.gte]: 50000 } },
    { pipeline: { [Op.eq]: "Sales Pipeline" } }
  ],
  [Op.or]: [
    { masterUserID: 123 },  // Permission
    { ownerId: 123 }
  ]
}
```

**SQL Equivalent:**
```sql
SELECT * FROM Deals
WHERE value >= 50000
  AND pipeline = 'Sales Pipeline'
  AND (masterUserID = 123 OR ownerId = 123)
LIMIT 20 OFFSET 0;
```

---

### Example 2: Mixed Fields with DealDetails

**Saved Filter:**
```json
{
  "filterName": "Active Proposals",
  "filterConfig": {
    "all": [
      {
        "field": "pipelineStage",
        "operator": "eq",
        "value": "Proposal"
      },
      {
        "field": "status",  // DealDetails field
        "operator": "eq",
        "value": "active"
      }
    ],
    "any": []
  }
}
```

**Generated Query:**
```javascript
Deal.findAndCountAll({
  where: {
    [Op.and]: [
      { pipelineStage: { [Op.eq]: "Proposal" } }
    ],
    [Op.or]: [
      { masterUserID: 123 },
      { ownerId: 123 }
    ]
  },
  include: [{
    model: DealDetails,
    as: "details",
    where: {
      [Op.and]: [
        { status: { [Op.eq]: "active" } }
      ]
    },
    required: true  // INNER JOIN
  }]
});
```

**SQL Equivalent:**
```sql
SELECT Deals.*, details.*
FROM Deals
INNER JOIN DealDetails AS details ON Deals.dealId = details.dealId
WHERE Deals.pipelineStage = 'Proposal'
  AND details.status = 'active'
  AND (Deals.masterUserID = 123 OR Deals.ownerId = 123);
```

---

### Example 3: Custom Field Filtering

**Saved Filter:**
```json
{
  "filterName": "Tech Companies",
  "filterConfig": {
    "all": [
      {
        "field": "industry",  // Custom field
        "operator": "eq",
        "value": "Technology"
      },
      {
        "field": "leadScore",  // Custom field
        "operator": "gte",
        "value": 80
      }
    ],
    "any": []
  }
}
```

**Processing Steps:**

**Step 1: Find Custom Fields**
```sql
SELECT fieldId, fieldName FROM CustomFields 
WHERE fieldName IN ('industry', 'leadScore')
  AND entityType IN ('deal', 'both', 'lead')
  AND isActive = true
  AND check = true;

-- Results:
-- fieldId: 101, fieldName: 'industry'
-- fieldId: 102, fieldName: 'leadScore'
```

**Step 2: Find Matching Values (Industry)**
```sql
SELECT entityId, entityType FROM CustomFieldValue
WHERE fieldId = 101
  AND entityType IN ('deal', 'lead')
  AND value = 'Technology';

-- Results:
-- entityId: 50, entityType: 'deal'
-- entityId: 60, entityType: 'deal'
-- entityId: 25, entityType: 'lead'  -- Need to find associated deal
```

**Step 3: Resolve Lead to Deal**
```sql
SELECT dealId FROM Deals WHERE leadId = 25;
-- Result: dealId: 70
```

**Intermediate Result 1:**
```
dealIds from 'industry' filter: [50, 60, 70]
```

**Step 4: Find Matching Values (Lead Score)**
```sql
SELECT entityId, entityType FROM CustomFieldValue
WHERE fieldId = 102
  AND entityType IN ('deal', 'lead')
  AND value >= 80;

-- Results:
-- entityId: 50, entityType: 'deal'
-- entityId: 55, entityType: 'deal'
```

**Intermediate Result 2:**
```
dealIds from 'leadScore' filter: [50, 55]
```

**Step 5: Apply AND Logic (Intersection)**
```javascript
// Both conditions must match
finalDealIds = [50, 60, 70] ∩ [50, 55]
finalDealIds = [50]  // Only deal 50 matches both conditions
```

**Step 6: Final Query**
```javascript
Deal.findAndCountAll({
  where: {
    dealId: { [Op.in]: [50] },
    [Op.or]: [
      { masterUserID: 123 },
      { ownerId: 123 }
    ]
  }
});
```

**SQL Equivalent:**
```sql
SELECT * FROM Deals
WHERE dealId IN (50)
  AND (masterUserID = 123 OR ownerId = 123);
```

---

### Example 4: Complex Filter with AND/OR Logic

**Saved Filter:**
```json
{
  "filterName": "Hot Opportunities",
  "filterConfig": {
    "all": [
      {
        "field": "value",
        "operator": "gte",
        "value": 50000
      },
      {
        "field": "expectedCloseDate",
        "operator": "lte",
        "value": "2024-03-31"
      }
    ],
    "any": [
      {
        "field": "pipelineStage",
        "operator": "eq",
        "value": "Proposal"
      },
      {
        "field": "pipelineStage",
        "operator": "eq",
        "value": "Negotiation"
      },
      {
        "field": "pipelineStage",
        "operator": "eq",
        "value": "Verbal Commitment"
      }
    ]
  }
}
```

**Logic:**
```
(value >= 50000 AND expectedCloseDate <= 2024-03-31)
AND
(pipelineStage = 'Proposal' OR pipelineStage = 'Negotiation' OR pipelineStage = 'Verbal Commitment')
```

**Generated WHERE:**
```javascript
{
  [Op.and]: [
    { value: { [Op.gte]: 50000 } },
    { expectedCloseDate: { [Op.lte]: new Date('2024-03-31T23:59:59.999') } }
  ],
  [Op.or]: [
    { pipelineStage: { [Op.eq]: "Proposal" } },
    { pipelineStage: { [Op.eq]: "Negotiation" } },
    { pipelineStage: { [Op.eq]: "Verbal Commitment" } }
  ]
}

// Then combined with permission filter:
{
  [Op.and]: [
    {
      [Op.or]: [/* pipelineStage conditions */]
    },
    {
      [Op.or]: [
        { masterUserID: 123 },
        { ownerId: 123 }
      ]
    },
    { value: { [Op.gte]: 50000 } },
    { expectedCloseDate: { [Op.lte]: "2024-03-31" } }
  ]
}
```

---

### Example 5: Date Range Filtering

**Saved Filter:**
```json
{
  "filterName": "Q1 Expected Close",
  "filterConfig": {
    "all": [
      {
        "field": "expectedCloseDate",
        "operator": "gte",
        "value": "2024-01-01"
      },
      {
        "field": "expectedCloseDate",
        "operator": "lte",
        "value": "2024-03-31"
      }
    ],
    "any": []
  }
}
```

**Date Processing:**
```javascript
// For "is exactly on or after" (gte)
const start = new Date("2024-01-01T00:00:00");
{ expectedCloseDate: { [Op.gte]: start } }

// For "is exactly on or before" (lte)
const end = new Date("2024-03-31T23:59:59.999");
{ expectedCloseDate: { [Op.lte]: end } }

// Combined
{
  [Op.and]: [
    { expectedCloseDate: { [Op.gte]: "2024-01-01T00:00:00" } },
    { expectedCloseDate: { [Op.lte]: "2024-03-31T23:59:59.999" } }
  ]
}
```

**SQL Equivalent:**
```sql
SELECT * FROM Deals
WHERE expectedCloseDate >= '2024-01-01 00:00:00'
  AND expectedCloseDate <= '2024-03-31 23:59:59.999';
```

---

## 9. Technical Implementation

### Core Functions

#### 1. `buildCondition(cond)`
Converts a single filter condition into Sequelize WHERE clause.

**Input:**
```javascript
{
  field: "value",
  operator: "gte",
  value: 50000
}
```

**Output:**
```javascript
{ value: { [Op.gte]: 50000 } }
```

**Handles:**
- ✅ Standard operators (eq, ne, gt, gte, lt, lte, like)
- ✅ Empty/not empty checks
- ✅ Date range conversions
- ✅ Text search (LIKE)

---

#### 2. `buildCustomFieldFilters(customFieldsConditions, masterUserID)`
Finds custom field definitions for filter conditions.

**Input:**
```javascript
{
  all: [
    { field: "industry", operator: "eq", value: "Technology" }
  ],
  any: []
}
```

**Output:**
```javascript
[
  {
    fieldId: 101,
    condition: { field: "industry", operator: "eq", value: "Technology" },
    logicType: "all",
    entityType: "deal"
  }
]
```

**Process:**
1. Search CustomField table by fieldName
2. Fallback to fieldId if not found
3. Filter by entityType: ["deal", "both", "lead"]
4. Check `isActive: true` and `check: true`
5. Return array of filter objects

---

#### 3. `getDealIdsByCustomFieldFilters(customFieldFilters, masterUserID)`
Finds deals matching custom field conditions.

**Input:**
```javascript
[
  {
    fieldId: 101,
    condition: { operator: "eq", value: "Technology" },
    logicType: "all"
  }
]
```

**Output:**
```javascript
[50, 60, 70]  // Matching dealIds
```

**Process:**
1. Query CustomFieldValue for matching values
2. Handle entityType: "deal" (direct match)
3. Handle entityType: "lead" (find converted deals)
4. Apply AND logic for "all" filters (intersection)
5. Apply OR logic for "any" filters (union)
6. Return unique dealIds

---

#### 4. `buildCustomFieldCondition(condition, fieldId)`
Converts custom field condition to WHERE clause for CustomFieldValue.

**Input:**
```javascript
{
  operator: "like",
  value: "Tech"
}
```

**Output:**
```javascript
{
  value: { [Op.like]: "%Tech%" }
}
```

---

### Query Execution Flow

```javascript
// 1. Base query structure
const { rows: deals, count: total } = await Deal.findAndCountAll({
  where: filterWhere,        // Built from 'all' and 'any' conditions
  include: include,          // DealDetails join if needed
  limit: parseInt(limit),
  offset: (page - 1) * limit,
  order: [[sortBy, order.toUpperCase()]],
  attributes: attributes     // Selected columns from preferences
});

// 2. Post-query processing
// - Fetch currency descriptions
// - Attach custom field values
// - Calculate deal summary
// - Add conversion flags
```

---

### Error Handling

```javascript
// Filter not found
if (!filter) {
  return res.status(404).json({ message: "Filter not found." });
}

// Invalid filter config
try {
  const filterConfig = typeof filter.filterConfig === "string"
    ? JSON.parse(filter.filterConfig)
    : filter.filterConfig;
} catch (error) {
  return res.status(400).json({ message: "Invalid filter configuration" });
}

// Custom field not found
if (customFieldFilters.length === 0) {
  // No valid custom fields found
  // Set empty result
  filterWhere.dealId = { [Op.in]: [] };
}

// No matching deals
if (matchingDealIds.length === 0) {
  // Return empty result set
  filterWhere.dealId = { [Op.in]: [] };
}
```

---

## 10. Performance Considerations

### Optimization Strategies

1. **Index Custom Fields**
```sql
CREATE INDEX idx_custom_field_value_lookup 
ON CustomFieldValue (fieldId, entityType, value);

CREATE INDEX idx_custom_field_name 
ON CustomFields (fieldName, entityType, isActive);
```

2. **Limit Custom Field Queries**
```javascript
// Only fetch active, visible fields
where: {
  isActive: true,
  check: true,
  entityType: { [Op.in]: ["deal", "both", "lead"] }
}
```

3. **Pagination**
```javascript
// Always use limit/offset
limit: parseInt(limit),
offset: (page - 1) * limit
```

4. **Attribute Selection**
```javascript
// Only fetch needed columns based on preferences
attributes: attributes || undefined  // undefined = all columns
```

5. **Efficient Custom Field Joins**
```javascript
// Fetch custom fields after main query (not JOIN)
// This is faster for large result sets
const dealIds = deals.map(d => d.dealId);
const customFieldValues = await CustomFieldValue.findAll({
  where: { entityId: dealIds }
});
```

---

## Summary

### Key Takeaways

1. **filterId enables saved, reusable filters** with complex AND/OR logic
2. **Three types of fields** are supported: Deal, DealDetails, and Custom
3. **Permission filtering** is always applied (admin/non-admin)
4. **Custom field filtering** uses a two-step process:
   - Find field definitions
   - Query values and resolve to dealIds
5. **Lead-to-Deal conversion** is handled automatically for unified fields
6. **Operators are mapped** from user-friendly labels to SQL operators
7. **Date handling** includes full-day ranges and comparison logic
8. **Performance** is optimized through indexing and selective querying

### Filter Workflow Summary

```
Filter ID → Fetch Config → Parse all/any → Categorize Fields
    ↓
Standard Fields → Build WHERE clauses
    ↓
DealDetails Fields → Build JOIN with WHERE
    ↓
Custom Fields → Find Definitions → Query Values → Get Deal IDs → Add to WHERE
    ↓
Apply Permissions → Execute Query → Post-Process → Return Results
```

---

## Related Documentation
- `PRODUCT_MANAGEMENT_README.md` - Product management API
- `DEAL_PRODUCT_INTEGRATION.md` - Deal-product integration
- Custom Fields documentation (if available)
- LeadFilter model schema

---

**Document Version:** 1.0  
**Last Updated:** November 29, 2025  
**Author:** CRM Development Team
