# 🧪 Quick Test Guide - getActivities Product Filter

## Test Sequence

### 1️⃣ Create Test Filter in Database

```sql
-- Insert test filter with product code condition
INSERT INTO lead_filters (filterName, filterConfig, filterType, masterUserID, createdAt, updatedAt)
VALUES (
  'Activities with Product WEB-001',
  '{
    "all": [
      {
        "entity": "product",
        "field": "code",
        "operator": "is",
        "value": "WEB-001"
      }
    ],
    "any": []
  }',
  'activity',
  1,
  NOW(),
  NOW()
);

-- Get the filterId from the insert
SELECT filterId FROM lead_filters WHERE filterName = 'Activities with Product WEB-001';
-- Let's assume it returns filterId = 201
```

### 2️⃣ Test API Call

```bash
# Basic test - Get activities with product WEB-001
GET http://localhost:3000/api/activities?filterId=201

# Expected Console Logs:
# - Product fields: [ 'productId', 'name', 'code', 'description', 'category', ... ]
# [DEBUG] Added Product AND condition for field: code
# [DEBUG] hasProductFilters: true
# [DEBUG] Product filter results: X deals found with matching products
# [DEBUG] Product-filtered activity IDs: Y
```

### 3️⃣ Expected Response

```json
{
  "total": 5,
  "totalPages": 1,
  "currentPage": 1,
  "activities": [
    {
      "activityId": 123,
      "type": "Meeting",
      "subject": "Discuss Website Development",
      "dealId": 248,
      "deal_title": "Website Redesign Project",
      "isDone": false,
      "startDateTime": "2025-11-30T10:00:00.000Z",
      ...
    },
    ...
  ]
}
```

### 4️⃣ Verify Results

**Check that**:
- ✅ All returned activities have `dealId` values
- ✅ All deals are connected to product with code "WEB-001"
- ✅ Activities without deals are NOT included
- ✅ Activities with deals but no products are NOT included
- ✅ Only activities with deals having the specific product are included

### 5️⃣ Test Additional Scenarios

```bash
# Test with date filter
GET /api/activities?filterId=201&dateFilter=today

# Test with type filter
GET /api/activities?filterId=201&type=Meeting

# Test with pagination
GET /api/activities?filterId=201&page=1&limit=5

# Test with search
GET /api/activities?filterId=201&search=website

# Test To-do with counts
GET /api/activities?filterId=201&dateFilter=To-do
```

### 6️⃣ Test Empty Results

```sql
-- Create filter for non-existent product
INSERT INTO lead_filters (filterName, filterConfig, filterType, masterUserID, createdAt, updatedAt)
VALUES (
  'Activities with Non-Existent Product',
  '{
    "all": [
      {
        "entity": "product",
        "field": "code",
        "operator": "is",
        "value": "DOES-NOT-EXIST"
      }
    ],
    "any": []
  }',
  'activity',
  1,
  NOW(),
  NOW()
);
```

```bash
# Test empty results
GET /api/activities?filterId=202

# Expected Response:
# {
#   "total": 0,
#   "totalPages": 0,
#   "currentPage": 1,
#   "activities": []
# }
```

### 7️⃣ Test Multiple Conditions (AND)

```sql
INSERT INTO lead_filters (filterName, filterConfig, filterType, masterUserID, createdAt, updatedAt)
VALUES (
  'Service Products with Quantity > 1',
  '{
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
        "value": 1
      }
    ],
    "any": []
  }',
  'activity',
  1,
  NOW(),
  NOW()
);
```

### 8️⃣ Test OR Logic

```sql
INSERT INTO lead_filters (filterName, filterConfig, filterType, masterUserID, createdAt, updatedAt)
VALUES (
  'Product WEB-001 OR Meetings',
  '{
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
  }',
  'activity',
  1,
  NOW(),
  NOW()
);
```

```bash
GET /api/activities?filterId=204

# Should return activities that are EITHER:
# 1. Connected to deals with product WEB-001, OR
# 2. Of type Meeting (regardless of product)
```

---

## 🔍 Verification Checklist

After running tests, verify:

- [ ] Product fields are loaded successfully
- [ ] Product AND conditions are built correctly
- [ ] Product OR conditions are built correctly
- [ ] Deal query with product includes works
- [ ] Activity IDs are extracted correctly
- [ ] Main query includes product-filtered activity IDs
- [ ] Empty results return empty array (not error)
- [ ] Combined filters work (product + date + type)
- [ ] Pagination works with product filters
- [ ] RBAC is respected (users only see their activities)
- [ ] To-do counts work with product filters
- [ ] Custom fields still load correctly
- [ ] Response format is correct

---

## 🐛 Troubleshooting

### Issue: "Product models not available"
**Solution**: Check that Product and DealProduct models exist in `models/product/` folder

### Issue: No debug logs appearing
**Solution**: Check console.log statements are working, server is running in development mode

### Issue: Empty results when there should be data
**Possible Causes**:
1. Product code doesn't match exactly (case-sensitive)
2. No deals connected to activities
3. No products connected to deals
4. RBAC filtering out results (test as admin)

### Issue: Error in query execution
**Solution**: Check relationships in models:
- Deal.hasMany(DealProduct, { as: "dealProducts" })
- DealProduct.belongsTo(Product, { as: "product" })
- Activity.belongsTo(Deal, { as: "ActivityDeal" })

---

## 📊 Sample Data Setup

If you need test data:

```sql
-- 1. Create a product
INSERT INTO products (name, code, category, masterUserID, createdAt, updatedAt)
VALUES ('Website Development', 'WEB-001', 'Services', 1, NOW(), NOW());

-- 2. Link product to a deal
INSERT INTO deal_products (dealId, productId, quantity, price, masterUserID, createdAt, updatedAt)
VALUES (248, 1, 1, 5000.00, 1, NOW(), NOW());

-- 3. Create an activity linked to the deal
INSERT INTO activities (
  type, subject, dealId, masterUserID, 
  isDone, startDateTime, endDateTime, createdAt, updatedAt
)
VALUES (
  'Meeting', 'Discuss Website Project', 248, 1,
  false, '2025-11-30 10:00:00', '2025-11-30 11:00:00', NOW(), NOW()
);

-- 4. Verify the chain
SELECT 
  a.activityId, a.subject, a.dealId,
  d.title as dealTitle,
  dp.dealProductId, dp.quantity,
  p.code as productCode, p.name as productName
FROM activities a
JOIN deals d ON a.dealId = d.dealId
JOIN deal_products dp ON d.dealId = dp.dealId
JOIN products p ON dp.productId = p.productId
WHERE p.code = 'WEB-001';
```

---

## ✅ Success Criteria

**Test passes if**:
1. API returns 200 status
2. Console shows product filter debug logs
3. Returned activities match expected product
4. No syntax or runtime errors
5. Response structure is correct
6. Empty results handled gracefully
7. Combined filters work as expected

