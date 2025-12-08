# Add Products to Deal - API Documentation

Based on Pipedrive's interface, here's how to connect products to deals.

## UI Components Overview

The "Add products to deal" interface has:
1. **Products (0)** and **Installments (0)** tabs
2. **Deal currency** selector (e.g., US Dollar USD)
3. **Amounts are** dropdown (Tax inclusive/Tax exclusive/No tax)
4. **Product table** with columns:
   - Products (searchable)
   - Billing start date
   - Price
   - Quantity  
   - Discount (% or fixed)
   - Tax %
   - Amount
5. **Billing frequency** per product
6. **Discount description** rich text editor
7. **Summary section** (Subtotal excluding tax, Total with tax)
8. **Revenue metrics** (MRR, ARR, ACV, TCV)

---

## API Endpoints

### 1. Search Products (Autocomplete)
**When user types in "Start typing to search"**

```http
GET /api/products/search?query=cloud&limit=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "productId": 1,
      "name": "Cloud Storage Service",
      "code": "CLOUD-001",
      "category": "SaaS",
      "unit": "subscription",
      "prices": [
        {"currency": "USD", "amount": 99},
        {"currency": "INR", "amount": 8000}
      ],
      "taxType": "tax-exclusive",
      "taxPercentage": 18,
      "variations": [
        {
          "variationId": 1,
          "name": "Basic Plan - 10GB",
          "prices": [{"currency": "USD", "amount": 10}]
        },
        {
          "variationId": 2,
          "name": "Pro Plan - 100GB",
          "prices": [{"currency": "USD", "amount": 50}]
        }
      ]
    }
  ]
}
```

---

### 2. Add Product to Deal
**When user selects a product and fills in quantity, price, etc.**

```http
POST /api/products/deal/add
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "dealId": 123,
  "productId": 1,
  "variationId": 2,
  "quantity": 5,
  "unitPrice": 50.00,
  "currency": "USD",
  "discountType": "percentage",
  "discountValue": 10,
  "taxType": "tax-exclusive",
  "taxPercentage": 18,
  "billingFrequency": "monthly",
  "billingStartDate": "2025-01-01",
  "billingEndDate": "2025-12-31",
  "notes": "Enterprise discount applied"
}
```

**Automatic Calculations:**
```
Quantity: 5
Unit Price: $50
Subtotal: 5 × $50 = $250

Discount (10%): $250 × 10% = $25
After Discount: $250 - $25 = $225

Tax (18%, exclusive): $225 × 18% = $40.50
Total: $225 + $40.50 = $265.50
```

**Response:**
```json
{
  "status": "success",
  "message": "Product added to deal successfully",
  "data": {
    "dealProductId": 45,
    "dealId": 123,
    "productId": 1,
    "variationId": 2,
    "quantity": 5,
    "unitPrice": 50.00,
    "subtotal": 250.00,
    "discountAmount": 25.00,
    "taxAmount": 40.50,
    "total": 265.50,
    "billingFrequency": "monthly",
    "product": {
      "name": "Cloud Storage Service",
      "code": "CLOUD-001"
    },
    "variation": {
      "name": "Pro Plan - 100GB"
    }
  }
}
```

---

### 3. Get All Products in Deal (with Summary & Revenue)
**Load products when opening "Add products to deal" modal**

```http
GET /api/products/deal/123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "products": [
      {
        "dealProductId": 45,
        "productId": 1,
        "quantity": 5,
        "unitPrice": 50.00,
        "subtotal": 250.00,
        "discountType": "percentage",
        "discountValue": 10,
        "discountAmount": 25.00,
        "taxType": "tax-exclusive",
        "taxPercentage": 18,
        "taxAmount": 40.50,
        "total": 265.50,
        "currency": "USD",
        "billingFrequency": "monthly",
        "billingStartDate": "2025-01-01",
        "billingEndDate": "2025-12-31",
        "notes": "Enterprise discount",
        "product": {
          "name": "Cloud Storage Service",
          "code": "CLOUD-001"
        },
        "variation": {
          "name": "Pro Plan - 100GB"
        }
      }
    ],
    "summary": {
      "subtotalExcludingTax": "250.00",
      "totalDiscount": "25.00",
      "totalTax": "40.50",
      "totalWithTax": "265.50"
    },
    "revenue": {
      "monthlyRecurringRevenue": "265.50",
      "annualRecurringRevenue": "3186.00",
      "annualContractValue": "3186.00",
      "totalContractValue": "3186.00",
      "oneTimeRevenue": "0.00"
    }
  }
}
```

**Revenue Calculations:**
- **MRR (Monthly Recurring Revenue):** For monthly products = total
- **ARR (Annual Recurring Revenue):** MRR × 12 = $265.50 × 12 = $3,186
- **ACV (Annual Contract Value):** ARR + one-time revenue
- **TCV (Total Contract Value):** Based on billing start/end dates

---

### 4. Update Deal Product
**When user changes quantity, price, discount, or tax**

```http
POST /api/products/deal/update/45
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (Update Quantity):**
```json
{
  "quantity": 10,
  "discountValue": 15
}
```

**Automatic Recalculation:**
```
New Quantity: 10
Unit Price: $50 (unchanged)
Subtotal: 10 × $50 = $500

New Discount (15%): $500 × 15% = $75
After Discount: $500 - $75 = $425

Tax (18%, exclusive): $425 × 18% = $76.50
New Total: $425 + $76.50 = $501.50
```

**Response:**
```json
{
  "status": "success",
  "message": "Deal product updated successfully",
  "data": {
    "dealProductId": 45,
    "quantity": 10,
    "unitPrice": 50.00,
    "subtotal": 500.00,
    "discountAmount": 75.00,
    "taxAmount": 76.50,
    "total": 501.50
  }
}
```

---

### 5. Update Deal-Level Tax Settings
**When user clicks "Change tax settings" and updates for all products**

```http
POST /api/products/deal/123/tax-settings
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "taxType": "tax-inclusive",
  "taxPercentage": 18
}
```

**What Happens:**
- Updates ALL products in the deal with new tax settings
- Recalculates tax amount and total for each product

**Response:**
```json
{
  "status": "success",
  "message": "Tax settings updated for all products in deal"
}
```

---

### 6. Remove Product from Deal
**When user clicks delete icon**

```http
POST /api/products/deal/remove/45
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Product removed from deal successfully"
}
```

---

## Frontend Integration Guide

### Step 1: Load Products When Opening Modal

```javascript
async function loadDealProducts(dealId) {
  const response = await fetch(`/api/products/deal/${dealId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { data } = await response.json();
  
  // Display products in table
  renderProductsTable(data.products);
  
  // Display summary
  document.getElementById('subtotal').textContent = `$${data.summary.subtotalExcludingTax}`;
  document.getElementById('total').textContent = `$${data.summary.totalWithTax}`;
  
  // Display revenue (if on Revenue tab)
  document.getElementById('mrr').textContent = `$${data.revenue.monthlyRecurringRevenue}`;
  document.getElementById('arr').textContent = `$${data.revenue.annualRecurringRevenue}`;
  document.getElementById('acv').textContent = `$${data.revenue.annualContractValue}`;
  document.getElementById('tcv').textContent = `$${data.revenue.totalContractValue}`;
}
```

### Step 2: Product Search Autocomplete

```javascript
async function searchProducts(query) {
  if (query.length < 2) return [];
  
  const response = await fetch(`/api/products/search?query=${query}&limit=10`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { data } = await response.json();
  return data; // Array of products with variations
}

// On input in search field
document.getElementById('productSearch').addEventListener('input', async (e) => {
  const query = e.target.value;
  const products = await searchProducts(query);
  showAutocompleteDropdown(products);
});
```

### Step 3: Add Product to Deal

```javascript
async function addProductToDeal(formData) {
  const response = await fetch('/api/products/deal/add', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dealId: currentDealId,
      productId: formData.productId,
      variationId: formData.variationId,
      quantity: parseFloat(formData.quantity),
      unitPrice: parseFloat(formData.unitPrice),
      currency: formData.currency,
      discountType: formData.discountType,
      discountValue: parseFloat(formData.discountValue) || 0,
      taxType: formData.taxType,
      taxPercentage: parseFloat(formData.taxPercentage) || 0,
      billingFrequency: formData.billingFrequency,
      billingStartDate: formData.billingStartDate,
      billingEndDate: formData.billingEndDate,
      notes: formData.notes
    })
  });
  
  const result = await response.json();
  
  if (result.status === 'success') {
    // Reload products to refresh summary
    await loadDealProducts(currentDealId);
  }
}
```

### Step 4: Update Tax Settings for All Products

```javascript
async function changeTaxSettings(taxType, taxPercentage) {
  const response = await fetch(`/api/products/deal/${dealId}/tax-settings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ taxType, taxPercentage })
  });
  
  if (response.ok) {
    // Reload products to see updated calculations
    await loadDealProducts(dealId);
  }
}
```

### Step 5: Update Product Quantity/Price

```javascript
async function updateDealProduct(dealProductId, updates) {
  const response = await fetch(`/api/products/deal/update/${dealProductId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  if (response.ok) {
    await loadDealProducts(dealId);
  }
}

// On quantity change
document.getElementById('quantity').addEventListener('change', (e) => {
  updateDealProduct(dealProductId, {
    quantity: parseFloat(e.target.value)
  });
});
```

---

## Example Scenarios

### Scenario 1: SaaS Subscription
```json
{
  "productName": "CRM Software",
  "quantity": 10,
  "unitPrice": 50,
  "billingFrequency": "monthly",
  "billingStartDate": "2025-01-01",
  "billingEndDate": "2025-12-31",
  "discountType": "percentage",
  "discountValue": 20,
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}
```

**Calculations:**
- Subtotal: 10 × $50 = $500/month
- Discount (20%): $500 × 20% = $100
- After discount: $400/month
- Tax (18%): $400 × 18% = $72
- **Total: $472/month**
- **MRR: $472**
- **ARR: $5,664**
- **TCV (12 months): $5,664**

### Scenario 2: One-Time Service
```json
{
  "productName": "Website Development",
  "quantity": 1,
  "unitPrice": 10000,
  "billingFrequency": "one-time",
  "discountType": "fixed",
  "discountValue": 1000,
  "taxType": "tax-exclusive",
  "taxPercentage": 18
}
```

**Calculations:**
- Subtotal: $10,000
- Discount (fixed): $1,000
- After discount: $9,000
- Tax (18%): $9,000 × 18% = $1,620
- **Total: $10,620**
- **MRR: $0**
- **ARR: $0**
- **One-time Revenue: $10,620**

### Scenario 3: Mixed Products
```json
[
  {
    "name": "Monthly Subscription",
    "total": 500,
    "billingFrequency": "monthly"
  },
  {
    "name": "One-time Setup",
    "total": 2000,
    "billingFrequency": "one-time"
  }
]
```

**Revenue:**
- MRR: $500
- ARR: $6,000
- One-time: $2,000
- **ACV: $8,000**

---

## Tax Calculation Reference

### Tax-Exclusive
Tax is **added on top** of the price.
```
Price: $100
Tax (18%): $100 × 18% = $18
Total: $100 + $18 = $118
```

### Tax-Inclusive
Tax is **included** in the price.
```
Total: $118
Tax: $118 × (18/118) = $18
Base Price: $118 - $18 = $100
```

### No Tax
```
Price: $100
Tax: $0
Total: $100
```

---

## Response Structure Summary

All deal product endpoints return consistent structure:

```typescript
{
  status: "success" | "error",
  message?: string,
  data: {
    products: DealProduct[],
    summary: {
      subtotalExcludingTax: string,
      totalDiscount: string,
      totalTax: string,
      totalWithTax: string
    },
    revenue: {
      monthlyRecurringRevenue: string,
      annualRecurringRevenue: string,
      annualContractValue: string,
      totalContractValue: string,
      oneTimeRevenue: string
    }
  }
}
```

---

## Next Steps

1. ✅ API endpoints created
2. 🔜 Test with Postman using examples above
3. 🔜 Build frontend UI matching Pipedrive's design
4. 🔜 Implement product search autocomplete
5. 🔜 Add real-time calculation updates
6. 🔜 Implement installments feature (if needed)
