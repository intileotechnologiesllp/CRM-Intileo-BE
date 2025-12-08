# Product API Testing Guide

## Quick Fix Applied ✅
Fixed authentication issue: Changed `req.user.masterUserId` to `req.adminId` to match your existing auth middleware.

## Test with Postman

### Step 1: Login First
```http
POST http://213.136.77.55:4001/api/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

Copy the `token` from the response.

---

### Step 2: Create a Simple Product
```http
POST http://213.136.77.55:4001/api/products/create
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "name": "Test Product",
  "code": "TEST-001",
  "category": "Testing",
  "unit": "pcs",
  "prices": [
    {
      "currency": "INR",
      "amount": 1000
    }
  ],
  "billingFrequency": "one-time",
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}
```

Expected Response:
```json
{
  "status": "success",
  "message": "Product created successfully",
  "data": {
    "productId": 1,
    "name": "Test Product",
    "code": "TEST-001",
    ...
  }
}
```

---

### Step 3: Get All Products
```http
GET http://213.136.77.55:4001/api/products/get?page=1&limit=20
Authorization: Bearer YOUR_TOKEN_HERE
```

Expected Response:
```json
{
  "status": "success",
  "data": {
    "products": [...],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### Step 4: Get Single Product
```http
GET http://213.136.77.55:4001/api/products/get/1
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Step 5: Create Product with Variations
```http
POST http://213.136.77.55:4001/api/products/create
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "name": "SaaS Plan",
  "code": "SAAS-001",
  "category": "Software",
  "unit": "subscription",
  "billingFrequency": "monthly",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "hasVariations": true,
  "variations": [
    {
      "name": "Basic Plan",
      "sku": "SAAS-001-BASIC",
      "prices": [{"currency": "INR", "amount": 999}],
      "attributes": {"users": "1", "storage": "10GB"}
    },
    {
      "name": "Pro Plan",
      "sku": "SAAS-001-PRO",
      "prices": [{"currency": "INR", "amount": 4999}],
      "attributes": {"users": "10", "storage": "100GB"}
    }
  ]
}
```

---

### Step 6: Add Product to Deal
```http
POST http://213.136.77.55:4001/api/products/deal/add
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "dealId": 1,
  "productId": 1,
  "quantity": 2,
  "unitPrice": 1000,
  "currency": "INR",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "one-time"
}
```

**Important:** Replace `dealId: 1` with an actual deal ID from your database.

Expected Calculation:
- Subtotal: 2 × ₹1,000 = ₹2,000
- Tax (18%): ₹2,000 × 18% = ₹360
- Total: ₹2,000 + ₹360 = ₹2,360

---

### Step 7: Get Products in a Deal
```http
GET http://213.136.77.55:4001/api/products/deal/1
Authorization: Bearer YOUR_TOKEN_HERE
```

Replace `1` with actual dealId.

---

## Common Errors & Solutions

### Error: "No token provided"
**Solution:** Add `Authorization: Bearer YOUR_TOKEN` header

### Error: "Unauthorized"
**Solution:** Token expired, login again

### Error: "Cannot read properties of undefined (reading 'masterUserId')"
**Solution:** ✅ Fixed! Update was applied to use `req.adminId`

### Error: Foreign key constraint fails
**Solution:** Run the SQL migration first:
```bash
# Execute queries from MANUAL_PRODUCT_MIGRATION.sql
```

### Error: Product code already exists
**Solution:** Use a different `code` value (must be unique)

---

## Postman Collection Setup

### 1. Create Environment Variables
- `base_url`: http://213.136.77.55:4001
- `token`: (will be set after login)

### 2. Set Token Automatically After Login
In the login request, add this to "Tests" tab:
```javascript
var jsonData = pm.response.json();
if (jsonData.token) {
    pm.environment.set("token", jsonData.token);
}
```

### 3. Use Token in Headers
For all product endpoints:
```
Authorization: Bearer {{token}}
```

---

## cURL Examples

### Create Product
```bash
curl -X POST http://213.136.77.55:4001/api/products/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "code": "TEST-001",
    "category": "Testing",
    "prices": [{"currency": "INR", "amount": 1000}],
    "taxType": "tax-exclusive",
    "taxPercentage": 18
  }'
```

### Get Products
```bash
curl -X GET "http://213.136.77.55:4001/api/products/get?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Verify Database Tables Created

Before testing, ensure tables exist:

```sql
SHOW TABLES LIKE '%product%';
```

Should show:
- products
- product_variations
- deal_products

If not, run the SQL from `MANUAL_PRODUCT_MIGRATION.sql`

---

## Next Steps After Successful Testing

1. ✅ All endpoints working
2. 🔜 Build frontend UI
3. 🔜 Integrate with existing deal workflow
4. 🔜 Add product import/export
5. 🔜 Add product analytics

---

## Support

If you encounter any issues:
1. Check PM2 logs: `pm2 logs app`
2. Check MySQL tables exist
3. Verify token is valid
4. Check request body matches examples in `PRODUCT_API_REQUEST_BODIES.md`
