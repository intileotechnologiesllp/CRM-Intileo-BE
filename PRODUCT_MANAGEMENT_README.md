# Product Management System Documentation

## Overview
Complete product management functionality similar to Pipedrive, including product variations, pricing, billing frequency, tax handling, and discount management.

## Features

### 1. **Product Management**
- Create, Read, Update, Delete products
- Product code/SKU
- Product categories
- Unit of measurement
- Product descriptions
- Product images
- Custom metadata

### 2. **Pricing & Cost**
- Multi-currency support (prices stored as JSON array)
- Direct cost tracking (purchase/production cost)
- Multiple price tiers via variations

### 3. **Product Variations**
- Create multiple variations per product (e.g., Basic, Pro, Enterprise plans)
- Each variation has its own:
  - Name and SKU
  - Pricing
  - Cost
  - Custom attributes
  - Description

### 4. **Billing Frequency**
- **One-time**: Single payment
- **Monthly**: Recurring monthly
- **Quarterly**: Every 3 months
- **Semi-annually**: Every 6 months
- **Annually**: Yearly
- **Custom**: Define custom frequency in days

### 5. **Tax Handling**
Three tax calculation modes:
- **Tax-Exclusive**: Tax added on top of price
  - `Total = Price + (Price × Tax%)`
- **Tax-Inclusive**: Tax included in price
  - `Tax = Price × (Tax% / (100 + Tax%))`
- **No-Tax**: No tax applied

### 6. **Discount Management**
- **Percentage discount**: Discount as percentage of subtotal
- **Fixed discount**: Fixed amount deducted from subtotal

### 7. **Deal Integration**
- Add products to deals
- Track quantity, pricing, discount, tax per product
- Automatic calculation of:
  - Subtotal (Quantity × Unit Price)
  - Discount amount
  - Tax amount
  - Grand total
- Billing schedule per product in deal

## Database Schema

### Tables Created
1. **products** - Main product catalog
2. **product_variations** - Product variations/tiers
3. **deal_products** - Junction table linking products to deals

## API Endpoints

### Product Management

#### Create Product
```http
POST /api/products/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Website Development",
  "code": "WEB-001",
  "description": "Full-stack website development service",
  "category": "Development",
  "unit": "project",
  "prices": [
    {"currency": "INR", "amount": 100000},
    {"currency": "USD", "amount": 1200}
  ],
  "cost": 50000,
  "costCurrency": "INR",
  "billingFrequency": "one-time",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "discountType": "percentage",
  "discountValue": 10,
  "hasVariations": true,
  "variations": [
    {
      "name": "Basic Plan",
      "sku": "WEB-001-BASIC",
      "prices": [{"currency": "INR", "amount": 50000}],
      "attributes": {"pages": "5", "support": "email"}
    },
    {
      "name": "Premium Plan",
      "sku": "WEB-001-PREMIUM",
      "prices": [{"currency": "INR", "amount": 150000}],
      "attributes": {"pages": "unlimited", "support": "24/7"}
    }
  ]
}
```

#### Get All Products
```http
GET /api/products/get?page=1&limit=20&search=website&category=Development&isActive=true
Authorization: Bearer <token>
```

Query Parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search in name, code, description
- `category` - Filter by category
- `isActive` - Filter active/inactive products
- `sortBy` - Sort field (default: createdAt)
- `sortOrder` - ASC or DESC (default: DESC)

#### Get Single Product
```http
GET /api/products/get/:id
Authorization: Bearer <token>
```

#### Update Product
```http
POST /api/products/update/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Product Name",
  "taxPercentage": 18,
  "variations": [
    {
      "variationId": 1,
      "name": "Updated Variation Name"
    }
  ]
}
```

#### Delete Product (Soft Delete)
```http
POST /api/products/delete/:id
Authorization: Bearer <token>
```

#### Get Product Categories
```http
GET /api/products/categories
Authorization: Bearer <token>
```

### Deal-Product Integration

#### Add Product to Deal
```http
POST /api/products/deal/add
Authorization: Bearer <token>
Content-Type: application/json

{
  "dealId": 123,
  "productId": 45,
  "variationId": 2,
  "quantity": 3,
  "unitPrice": 50000,
  "currency": "INR",
  "discountType": "percentage",
  "discountValue": 10,
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "monthly",
  "billingStartDate": "2025-01-01",
  "billingEndDate": "2025-12-31",
  "notes": "Special pricing for this deal"
}
```

**Calculation Example:**
```
Quantity: 3
Unit Price: ₹50,000
Subtotal: 3 × ₹50,000 = ₹150,000

Discount (10%): ₹150,000 × 10% = ₹15,000
Amount after discount: ₹150,000 - ₹15,000 = ₹135,000

Tax (18%, exclusive): ₹135,000 × 18% = ₹24,300
Grand Total: ₹135,000 + ₹24,300 = ₹159,300
```

#### Get Deal Products
```http
GET /api/products/deal/:dealId
Authorization: Bearer <token>
```

Response includes:
- List of all products in the deal
- Summary with:
  - Total subtotal
  - Total discount
  - Total tax
  - Grand total

#### Update Deal Product
```http
POST /api/products/deal/update/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 5,
  "unitPrice": 45000,
  "discountValue": 15
}
```

Automatically recalculates all amounts.

#### Remove Product from Deal
```http
POST /api/products/deal/remove/:id
Authorization: Bearer <token>
```

## Usage Examples

### Example 1: SaaS Product with Tiers
```javascript
{
  "name": "Cloud Storage Service",
  "code": "CLOUD-001",
  "category": "SaaS",
  "unit": "subscription",
  "billingFrequency": "monthly",
  "taxType": "tax-inclusive",
  "taxPercentage": 18,
  "hasVariations": true,
  "variations": [
    {
      "name": "Starter - 10GB",
      "sku": "CLOUD-001-STARTER",
      "prices": [{"currency": "INR", "amount": 999}],
      "attributes": {"storage": "10GB", "users": "1"}
    },
    {
      "name": "Business - 100GB",
      "sku": "CLOUD-001-BUSINESS",
      "prices": [{"currency": "INR", "amount": 4999}],
      "attributes": {"storage": "100GB", "users": "10"}
    },
    {
      "name": "Enterprise - 1TB",
      "sku": "CLOUD-001-ENTERPRISE",
      "prices": [{"currency": "INR", "amount": 19999}],
      "attributes": {"storage": "1TB", "users": "unlimited"}
    }
  ]
}
```

### Example 2: Physical Product
```javascript
{
  "name": "Ergonomic Office Chair",
  "code": "CHAIR-001",
  "category": "Furniture",
  "unit": "pcs",
  "prices": [
    {"currency": "INR", "amount": 15000},
    {"currency": "USD", "amount": 180}
  ],
  "cost": 8000,
  "costCurrency": "INR",
  "billingFrequency": "one-time",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "hasVariations": true,
  "variations": [
    {
      "name": "Black Leather",
      "sku": "CHAIR-001-BLK",
      "prices": [{"currency": "INR", "amount": 15000}],
      "attributes": {"color": "black", "material": "leather"}
    },
    {
      "name": "Brown Fabric",
      "sku": "CHAIR-001-BRN",
      "prices": [{"currency": "INR", "amount": 12000}],
      "attributes": {"color": "brown", "material": "fabric"}
    }
  ]
}
```

### Example 3: Consulting Service
```javascript
{
  "name": "Business Consulting",
  "code": "CONSULT-001",
  "category": "Services",
  "unit": "hours",
  "prices": [{"currency": "INR", "amount": 5000}],
  "cost": 2000,
  "billingFrequency": "one-time",
  "taxType": "no-tax",
  "taxPercentage": 0,
  "discountType": "percentage",
  "discountValue": 15
}
```

## Tax Calculation Examples

### Tax-Exclusive (18%)
```
Price: ₹10,000
Tax: ₹10,000 × 18% = ₹1,800
Total: ₹10,000 + ₹1,800 = ₹11,800
```

### Tax-Inclusive (18%)
```
Total: ₹11,800
Tax: ₹11,800 × (18/118) = ₹1,800
Base Price: ₹11,800 - ₹1,800 = ₹10,000
```

### No-Tax
```
Price: ₹10,000
Tax: ₹0
Total: ₹10,000
```

## Installation & Setup

### 1. Run Database Migration
```bash
mysql -u root -p crm < migrations/create_product_tables.sql
```

Or manually execute the SQL file on your database.

### 2. Sync Models (Alternative)
If using Sequelize sync:
```javascript
const Product = require('./models/product/productModel');
const ProductVariation = require('./models/product/productVariationModel');
const DealProduct = require('./models/product/dealProductModel');

await Product.sync();
await ProductVariation.sync();
await DealProduct.sync();
```

### 3. Restart Application
```bash
pm2 restart ecosystem.prod.config.js
```

## Frontend Integration

### Product Form Fields
Based on the provided screenshot, implement:

1. **Name** (text input)
2. **Product Code** (text input)
3. **Category** (dropdown - fetch from `/api/products/categories`)
4. **Unit** (text input)
5. **Billing Frequency** (dropdown)
   - Options: One time, Monthly, Quarterly, Semi-annually, Annually, Custom
6. **Unit Prices** (multiple currency inputs)
   - Add Price button to add more currencies
7. **Tax %** (number input)
8. **Tax Type** (radio buttons)
   - Tax-exclusive, Tax-inclusive, No-tax
9. **Discount** (optional)
   - Type: Percentage / Fixed
   - Value: number input
10. **Cost** (number input with currency)
11. **Visible to** (dropdown)
12. **Import** button (for bulk import)

### Example React Component Structure
```jsx
const ProductForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    unit: '',
    billingFrequency: 'one-time',
    prices: [{ currency: 'INR', amount: '' }],
    taxType: 'tax-exclusive',
    taxPercentage: 18,
    discountType: '',
    discountValue: '',
    cost: '',
    costCurrency: 'INR'
  });

  const handleSubmit = async () => {
    await axios.post('/api/products/create', formData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Render form fields */}
    </form>
  );
};
```

## Multi-tenancy Support
All products are automatically scoped to the user's `companyId` if present in the JWT token.

## Security
- All endpoints require authentication (`verifyToken` middleware)
- Product ownership tracked via `ownerId`
- Visibility groups supported for access control

## Future Enhancements
- [ ] Product bundles/packages
- [ ] Inventory tracking
- [ ] Product images upload
- [ ] Bulk import from CSV/Excel
- [ ] Product templates
- [ ] Price history tracking
- [ ] Automated pricing rules
- [ ] Product availability schedules

## Support
For issues or feature requests, contact the development team.
