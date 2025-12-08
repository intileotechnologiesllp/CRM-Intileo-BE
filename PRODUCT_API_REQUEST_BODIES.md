# Product Management API - Request Body Examples

## 1. CREATE PRODUCT
**Endpoint:** `POST /api/products/create`

### Basic Product (No Variations)
```json
{
  "name": "Website Development Service",
  "code": "WEB-001",
  "description": "Professional website development with modern technologies",
  "category": "Services",
  "unit": "project",
  "prices": [
    {
      "currency": "INR",
      "amount": 100000
    },
    {
      "currency": "USD",
      "amount": 1200
    }
  ],
  "cost": 50000,
  "costCurrency": "INR",
  "billingFrequency": "one-time",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "discountType": "percentage",
  "discountValue": 10,
  "hasVariations": false,
  "visibilityGroup": "Everyone",
  "imageUrl": "https://example.com/images/product.jpg",
  "metadata": {
    "deliveryTime": "30 days",
    "warranty": "6 months"
  }
}
```

### Product with Variations (SaaS/Multiple Tiers)
```json
{
  "name": "Cloud Storage Service",
  "code": "CLOUD-001",
  "description": "Secure cloud storage with multiple plans",
  "category": "SaaS",
  "unit": "subscription",
  "prices": [
    {
      "currency": "INR",
      "amount": 999
    }
  ],
  "cost": 200,
  "costCurrency": "INR",
  "billingFrequency": "monthly",
  "taxType": "tax-inclusive",
  "taxPercentage": 18,
  "hasVariations": true,
  "visibilityGroup": "Everyone",
  "variations": [
    {
      "name": "Starter Plan - 10GB",
      "sku": "CLOUD-001-STARTER",
      "description": "Perfect for individuals",
      "prices": [
        {
          "currency": "INR",
          "amount": 999
        }
      ],
      "cost": 200,
      "attributes": {
        "storage": "10GB",
        "users": "1",
        "support": "Email"
      },
      "sortOrder": 1,
      "isActive": true
    },
    {
      "name": "Business Plan - 100GB",
      "sku": "CLOUD-001-BUSINESS",
      "description": "Ideal for small teams",
      "prices": [
        {
          "currency": "INR",
          "amount": 4999
        }
      ],
      "cost": 800,
      "attributes": {
        "storage": "100GB",
        "users": "10",
        "support": "Priority Email"
      },
      "sortOrder": 2,
      "isActive": true
    },
    {
      "name": "Enterprise Plan - 1TB",
      "sku": "CLOUD-001-ENTERPRISE",
      "description": "For large organizations",
      "prices": [
        {
          "currency": "INR",
          "amount": 19999
        }
      ],
      "cost": 3000,
      "attributes": {
        "storage": "1TB",
        "users": "unlimited",
        "support": "24/7 Phone & Email"
      },
      "sortOrder": 3,
      "isActive": true
    }
  ]
}
```

### Physical Product with Variations (Color/Size)
```json
{
  "name": "Ergonomic Office Chair",
  "code": "CHAIR-001",
  "description": "Premium ergonomic chair with lumbar support",
  "category": "Furniture",
  "unit": "pcs",
  "prices": [
    {
      "currency": "INR",
      "amount": 15000
    }
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
      "sku": "CHAIR-001-BLK-LEATHER",
      "prices": [
        {
          "currency": "INR",
          "amount": 15000
        }
      ],
      "cost": 8000,
      "attributes": {
        "color": "Black",
        "material": "Leather",
        "weight": "15kg"
      }
    },
    {
      "name": "Brown Fabric",
      "sku": "CHAIR-001-BRN-FABRIC",
      "prices": [
        {
          "currency": "INR",
          "amount": 12000
        }
      ],
      "cost": 6500,
      "attributes": {
        "color": "Brown",
        "material": "Fabric",
        "weight": "13kg"
      }
    }
  ]
}
```

### Consulting Service
```json
{
  "name": "Business Consulting",
  "code": "CONSULT-001",
  "description": "Expert business consulting services",
  "category": "Professional Services",
  "unit": "hours",
  "prices": [
    {
      "currency": "INR",
      "amount": 5000
    }
  ],
  "cost": 2000,
  "costCurrency": "INR",
  "billingFrequency": "one-time",
  "taxType": "no-tax",
  "taxPercentage": 0,
  "discountType": "percentage",
  "discountValue": 15,
  "hasVariations": false
}
```

### Software License (Annual Billing)
```json
{
  "name": "CRM Software License",
  "code": "CRM-LIC-001",
  "description": "Annual software license",
  "category": "Software",
  "unit": "license",
  "prices": [
    {
      "currency": "INR",
      "amount": 50000
    }
  ],
  "cost": 10000,
  "costCurrency": "INR",
  "billingFrequency": "annually",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "hasVariations": false
}
```

### Custom Billing Frequency
```json
{
  "name": "Quarterly Marketing Package",
  "code": "MKT-Q-001",
  "category": "Marketing",
  "unit": "package",
  "prices": [
    {
      "currency": "INR",
      "amount": 75000
    }
  ],
  "billingFrequency": "quarterly",
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}
```

---

## 2. UPDATE PRODUCT
**Endpoint:** `POST /api/products/update/:id`

### Update Basic Fields
```json
{
  "name": "Updated Product Name",
  "description": "Updated description",
  "taxPercentage": 18,
  "discountValue": 15,
  "isActive": true
}
```

### Update with Variations
```json
{
  "name": "Updated Cloud Storage Service",
  "taxPercentage": 12,
  "variations": [
    {
      "variationId": 1,
      "name": "Starter Plan - 20GB (Updated)",
      "prices": [
        {
          "currency": "INR",
          "amount": 1299
        }
      ],
      "isActive": true
    },
    {
      "name": "New Premium Plan - 500GB",
      "sku": "CLOUD-001-PREMIUM",
      "prices": [
        {
          "currency": "INR",
          "amount": 9999
        }
      ],
      "attributes": {
        "storage": "500GB",
        "users": "50"
      }
    }
  ]
}
```

---

## 3. ADD PRODUCT TO DEAL
**Endpoint:** `POST /api/products/deal/add`

### Basic Product to Deal
```json
{
  "dealId": 123,
  "productId": 45,
  "quantity": 2,
  "unitPrice": 50000,
  "currency": "INR",
  "discountType": "percentage",
  "discountValue": 10,
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "one-time",
  "notes": "Special pricing for bulk order"
}
```

### Product with Variation to Deal
```json
{
  "dealId": 123,
  "productId": 45,
  "variationId": 2,
  "quantity": 1,
  "unitPrice": 4999,
  "currency": "INR",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "monthly",
  "billingStartDate": "2025-01-01",
  "billingEndDate": "2025-12-31",
  "notes": "12-month subscription"
}
```

### Product with Fixed Discount
```json
{
  "dealId": 123,
  "productId": 45,
  "quantity": 5,
  "unitPrice": 15000,
  "currency": "INR",
  "discountType": "fixed",
  "discountValue": 5000,
  "taxType": "tax-inclusive",
  "taxPercentage": 18,
  "billingFrequency": "one-time"
}
```

### Product with No Tax
```json
{
  "dealId": 123,
  "productId": 45,
  "quantity": 10,
  "unitPrice": 5000,
  "currency": "INR",
  "taxType": "no-tax",
  "taxPercentage": 0,
  "billingFrequency": "one-time",
  "notes": "Tax-exempt client"
}
```

### Recurring Billing Product
```json
{
  "dealId": 123,
  "productId": 45,
  "quantity": 1,
  "unitPrice": 50000,
  "currency": "INR",
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "quarterly",
  "billingStartDate": "2025-01-01",
  "billingEndDate": "2026-12-31",
  "notes": "2-year contract, quarterly billing"
}
```

---

## 4. UPDATE DEAL PRODUCT
**Endpoint:** `POST /api/products/deal/update/:id`

### Update Quantity and Price
```json
{
  "quantity": 5,
  "unitPrice": 45000,
  "discountValue": 15
}
```

### Update Tax Settings
```json
{
  "taxType": "tax-inclusive",
  "taxPercentage": 18
}
```

### Update Billing
```json
{
  "billingFrequency": "monthly",
  "billingStartDate": "2025-02-01",
  "billingEndDate": "2026-01-31",
  "notes": "Updated to monthly billing"
}
```

### Complete Update
```json
{
  "quantity": 3,
  "unitPrice": 50000,
  "currency": "INR",
  "discountType": "percentage",
  "discountValue": 12,
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "one-time",
  "notes": "Negotiated better pricing"
}
```

---

## FIELD REFERENCE

### Required Fields for CREATE PRODUCT:
```json
{
  "name": "string (required)"
}
```

### Optional Fields:
```json
{
  "code": "string (unique)",
  "description": "text",
  "category": "string",
  "unit": "string",
  "prices": [{"currency": "string", "amount": number}],
  "cost": number,
  "costCurrency": "string (default: INR)",
  "billingFrequency": "one-time|monthly|quarterly|semi-annually|annually|custom",
  "billingFrequencyCustom": number,
  "taxType": "tax-exclusive|tax-inclusive|no-tax",
  "taxPercentage": number,
  "discountType": "percentage|fixed",
  "discountValue": number,
  "hasVariations": boolean,
  "visibilityGroup": "string",
  "imageUrl": "string",
  "metadata": {}
}
```

### Required Fields for ADD TO DEAL:
```json
{
  "dealId": number (required),
  "productId": number (required),
  "quantity": number (required),
  "unitPrice": number (required)
}
```

### Variation Object:
```json
{
  "name": "string (required)",
  "sku": "string",
  "description": "text",
  "prices": [{"currency": "string", "amount": number}],
  "cost": number,
  "attributes": {},
  "sortOrder": number,
  "isActive": boolean
}
```

---

## CALCULATION EXAMPLES

### Tax-Exclusive (18%)
```
Request:
{
  "quantity": 2,
  "unitPrice": 10000,
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}

Calculation:
Subtotal = 2 × 10000 = ₹20,000
Tax = 20000 × 18% = ₹3,600
Total = 20000 + 3600 = ₹23,600
```

### Tax-Inclusive (18%)
```
Request:
{
  "quantity": 1,
  "unitPrice": 11800,
  "taxType": "tax-inclusive",
  "taxPercentage": 18
}

Calculation:
Total = ₹11,800
Tax = 11800 × (18/118) = ₹1,800
Subtotal = 11800 - 1800 = ₹10,000
```

### With Percentage Discount
```
Request:
{
  "quantity": 3,
  "unitPrice": 50000,
  "discountType": "percentage",
  "discountValue": 10,
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}

Calculation:
Subtotal = 3 × 50000 = ₹150,000
Discount = 150000 × 10% = ₹15,000
After Discount = 150000 - 15000 = ₹135,000
Tax = 135000 × 18% = ₹24,300
Total = 135000 + 24300 = ₹159,300
```

### With Fixed Discount
```
Request:
{
  "quantity": 5,
  "unitPrice": 10000,
  "discountType": "fixed",
  "discountValue": 5000,
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}

Calculation:
Subtotal = 5 × 10000 = ₹50,000
Discount = ₹5,000 (fixed)
After Discount = 50000 - 5000 = ₹45,000
Tax = 45000 × 18% = ₹8,100
Total = 45000 + 8100 = ₹53,100
```
