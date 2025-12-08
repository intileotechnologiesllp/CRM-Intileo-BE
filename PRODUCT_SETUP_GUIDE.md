# Quick Setup Guide - Product Management Feature

## ✅ Files Created

### Models
- `models/product/productModel.js` - Main product model
- `models/product/productVariationModel.js` - Product variations/tiers
- `models/product/dealProductModel.js` - Link products to deals

### Controllers
- `controllers/product/productController.js` - All business logic (14 functions)

### Routes
- `routes/product/productRoutes.js` - API endpoints

### Migration
- `migrations/create_product_tables.sql` - Database schema
- `MANUAL_PRODUCT_MIGRATION.sql` - **USE THIS ONE** (corrected table names)

### Documentation
- `PRODUCT_MANAGEMENT_README.md` - Complete API documentation

## 🚀 Manual Setup Steps

### Step 1: Execute SQL Queries

**Option A: Using MySQL Command Line**
```bash
mysql -h 213.136.77.55 -P 3308 -u root -pIntileo@123 crm
```

Then copy and paste the queries from `MANUAL_PRODUCT_MIGRATION.sql` one by one.

**Option B: Using phpMyAdmin / MySQL Workbench**
1. Connect to: 213.136.77.55:3308
2. Select database: `crm`
3. Open SQL tab
4. Copy queries from `MANUAL_PRODUCT_MIGRATION.sql`
5. Execute each CREATE TABLE statement

### Step 2: Verify Tables Created
```sql
SHOW TABLES LIKE '%product%';
```

Expected output:
- products
- product_variations  
- deal_products

### Step 3: Restart Application
```bash
pm2 restart ecosystem.prod.config.js
```

Or if using npm:
```bash
npm start
```

## 📝 API Endpoints Now Available

All endpoints require: `Authorization: Bearer <token>`

### Product Management
```
POST   /api/products/create          - Create product
GET    /api/products/get             - List all products (with pagination)
GET    /api/products/get/:id         - Get single product
POST   /api/products/update/:id      - Update product
POST   /api/products/delete/:id      - Delete product (soft delete)
GET    /api/products/categories      - Get all categories
```

### Deal Integration
```
POST   /api/products/deal/add           - Add product to deal
GET    /api/products/deal/:dealId       - Get all products in a deal
POST   /api/products/deal/update/:id    - Update deal product
POST   /api/products/deal/remove/:id    - Remove product from deal
```

## 🧪 Test the API

### Test 1: Create a Product
```bash
curl -X POST http://213.136.77.55:4001/api/products/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Development",
    "code": "WEB-001",
    "category": "Services",
    "unit": "project",
    "prices": [{"currency": "INR", "amount": 100000}],
    "billingFrequency": "one-time",
    "taxType": "tax-exclusive",
    "taxPercentage": 18
  }'
```

### Test 2: Get All Products
```bash
curl -X GET "http://213.136.77.55:4001/api/products/get?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 3: Add Product to Deal
```bash
curl -X POST http://213.136.77.55:4001/api/products/deal/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": 1,
    "productId": 1,
    "quantity": 2,
    "unitPrice": 100000,
    "currency": "INR",
    "taxType": "tax-exclusive",
    "taxPercentage": 18
  }'
```

## 📊 Database Schema Summary

### products table
- Stores: name, code, category, prices (JSON), cost, tax settings, discount, billing frequency
- 24 columns total
- Foreign key: ownerId → MasterUsers.masterUserId

### product_variations table
- Stores: variation name, SKU, prices, attributes (JSON)
- Used for: Basic/Pro/Enterprise tiers, different colors/sizes, etc.
- Foreign key: productId → products.productId

### deal_products table
- Junction table linking deals to products
- Stores: quantity, price at time of adding, discount, tax, calculated totals
- Foreign keys: 
  - dealId → Deals.dealId
  - productId → products.productId
  - variationId → product_variations.variationId

## 🎯 Key Features Implemented

✅ **Product Management**
- Full CRUD operations
- Product categories
- Product codes/SKUs
- Multi-currency pricing (JSON array)
- Cost tracking

✅ **Variations**
- Multiple tiers per product
- Custom attributes per variation
- Separate pricing for each

✅ **Billing**
- One-time, Monthly, Quarterly, Semi-annually, Annually, Custom
- Start/End dates for recurring billing

✅ **Tax Handling**
- Tax-exclusive (tax added on top)
- Tax-inclusive (tax included in price)
- No-tax option

✅ **Discounts**
- Percentage discount
- Fixed amount discount

✅ **Deal Integration**
- Add products to deals
- Quantity management
- Automatic calculation of subtotal, discount, tax, total
- Per-product notes

## 🔧 Troubleshooting

### If tables don't create:
1. Check if foreign key tables exist:
   ```sql
   SELECT * FROM MasterUsers LIMIT 1;
   SELECT * FROM Deals LIMIT 1;
   ```

2. If MasterUsers table doesn't exist, the app won't work. Contact dev team.

### If API returns 404:
1. Make sure app.js has the import and route registration
2. Check file: `d:\crm-intileo\app.js` lines 60 and 141
3. Restart PM2

### If API returns 500:
1. Check logs: `pm2 logs app`
2. Check if tables were created successfully
3. Verify JWT token is valid

## 📱 Frontend Integration Tips

The form in your screenshot should map to these fields:

```javascript
{
  name: "Product Name",              // Text input
  code: "PROD-001",                  // Text input
  category: "Software",              // Dropdown (fetch from /api/products/categories)
  unit: "license",                   // Text input
  billingFrequency: "monthly",       // Dropdown
  prices: [                          // Multiple currency inputs
    {currency: "INR", amount: 10000}
  ],
  taxPercentage: 18,                 // Number input
  taxType: "tax-exclusive",          // Radio buttons
  discountType: "percentage",        // Optional dropdown
  discountValue: 10,                 // Optional number input
  cost: 5000,                        // Number input
  costCurrency: "INR",               // Dropdown
  visibilityGroup: "Everyone"        // Dropdown
}
```

## 📖 Full Documentation
See `PRODUCT_MANAGEMENT_README.md` for:
- Detailed API documentation
- Request/response examples
- Tax calculation formulas
- Usage examples for different product types

## ✨ Next Steps

1. ✅ Run SQL queries from MANUAL_PRODUCT_MIGRATION.sql
2. ✅ Restart PM2
3. ✅ Test API endpoints with Postman/curl
4. 🔜 Build frontend UI based on your screenshot
5. 🔜 Test adding products to deals
6. 🔜 Create product reports/analytics

## 🆘 Need Help?

Check the logs:
```bash
pm2 logs app --lines 100
```

Common issues are documented in PRODUCT_MANAGEMENT_README.md

---
**Created:** November 28, 2025  
**Database:** crm @ 213.136.77.55:3308  
**API Base:** http://213.136.77.55:4001/api/products
