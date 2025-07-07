# Complete Custom Fields Workflow

## Overview

This document provides a complete workflow for implementing a custom fields-based lead management system.

## Prerequisites

- CRM system with custom fields infrastructure
- Authentication tokens for API access
- Understanding of field types and validation

## Step 1: Setup Custom Fields

### 1.1 Create Essential Lead Fields

```bash
# Create Contact Person field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "contact_person",
    "fieldLabel": "Contact Person",
    "fieldType": "text",
    "entityType": "lead",
    "isRequired": true,
    "isImportant": true,
    "category": "Summary",
    "fieldGroup": "Basic Info",
    "displayOrder": 1
  }'

# Create Organization field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "organization",
    "fieldLabel": "Organization",
    "fieldType": "text",
    "entityType": "lead",
    "isRequired": true,
    "isImportant": true,
    "category": "Summary",
    "fieldGroup": "Basic Info",
    "displayOrder": 2
  }'

# Create Title field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "title",
    "fieldLabel": "Title",
    "fieldType": "text",
    "entityType": "lead",
    "isRequired": true,
    "isImportant": true,
    "category": "Summary",
    "fieldGroup": "Basic Info",
    "displayOrder": 3
  }'

# Create Email field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "email",
    "fieldLabel": "Email",
    "fieldType": "email",
    "entityType": "lead",
    "isRequired": false,
    "category": "Contact",
    "fieldGroup": "Contact Info",
    "displayOrder": 4
  }'

# Create Phone field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "phone",
    "fieldLabel": "Phone",
    "fieldType": "text",
    "entityType": "lead",
    "isRequired": false,
    "category": "Contact",
    "fieldGroup": "Contact Info",
    "displayOrder": 5
  }'

# Create Lead Source field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "lead_source",
    "fieldLabel": "Lead Source",
    "fieldType": "select",
    "entityType": "lead",
    "options": ["Website", "Email", "Phone Call", "Referral", "Social Media", "Advertisement", "Trade Show", "Cold Call"],
    "isRequired": false,
    "category": "Details",
    "fieldGroup": "Lead Info",
    "displayOrder": 6
  }'

# Create Priority Level field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "priority_level",
    "fieldLabel": "Priority Level",
    "fieldType": "select",
    "entityType": "lead",
    "options": ["Low", "Medium", "High", "Critical"],
    "isRequired": false,
    "category": "Details",
    "fieldGroup": "Lead Info",
    "displayOrder": 7
  }'

# Create Budget Range field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "budget_range",
    "fieldLabel": "Budget Range",
    "fieldType": "number",
    "entityType": "lead",
    "isRequired": false,
    "category": "Details",
    "fieldGroup": "Lead Info",
    "displayOrder": 8
  }'

# Create Expected Close Date field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "expected_close_date",
    "fieldLabel": "Expected Close Date",
    "fieldType": "date",
    "entityType": "lead",
    "isRequired": false,
    "category": "Details",
    "fieldGroup": "Lead Info",
    "displayOrder": 9
  }'

# Create Stage field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "stage",
    "fieldLabel": "Stage",
    "fieldType": "select",
    "entityType": "lead",
    "options": ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"],
    "isRequired": true,
    "isImportant": true,
    "category": "Summary",
    "fieldGroup": "Lead Info",
    "displayOrder": 10
  }'

# Create Status field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "status",
    "fieldLabel": "Status",
    "fieldType": "select",
    "entityType": "lead",
    "options": ["Active", "Inactive", "On Hold", "Closed"],
    "isRequired": true,
    "isImportant": true,
    "category": "Summary",
    "fieldGroup": "Lead Info",
    "displayOrder": 11
  }'
```

### 1.2 Verify Field Creation

```bash
# Get all lead fields
curl -X GET "http://localhost:3000/api/custom-fields/?entityType=lead" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Step 2: Create Leads Using Custom Fields

### 2.1 Create Lead with Field Names

```bash
curl -X POST http://localhost:3000/api/custom-fields/create-entity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "entityType": "lead",
    "customFields": {
      "contact_person": "John Smith",
      "organization": "ACME Corporation",
      "title": "Website Redesign Project",
      "email": "john.smith@acme.com",
      "phone": "+1-555-0123",
      "lead_source": "Website",
      "priority_level": "High",
      "budget_range": 50000,
      "expected_close_date": "2025-08-15",
      "stage": "Qualified",
      "status": "Active"
    }
  }'
```

### 2.2 Create Another Lead

```bash
curl -X POST http://localhost:3000/api/custom-fields/create-entity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "entityType": "lead",
    "customFields": {
      "contact_person": "Sarah Johnson",
      "organization": "Tech Solutions Inc",
      "title": "Mobile App Development",
      "email": "sarah.johnson@techsolutions.com",
      "phone": "+1-555-0456",
      "lead_source": "Referral",
      "priority_level": "Medium",
      "budget_range": 75000,
      "expected_close_date": "2025-09-01",
      "stage": "New",
      "status": "Active"
    }
  }'
```

## Step 3: Retrieve and Manage Lead Data

### 3.1 Get Lead Custom Field Values

```bash
# Replace ENTITY_ID with actual entity ID from creation response
curl -X GET "http://localhost:3000/api/custom-fields/values/lead/ENTITY_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.2 Update Lead Information

```bash
curl -X PUT "http://localhost:3000/api/custom-fields/values/lead/ENTITY_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldValues": {
      "stage": "Proposal",
      "priority_level": "Critical",
      "budget_range": 60000
    }
  }'
```

### 3.3 Add Additional Custom Fields

```bash
curl -X POST http://localhost:3000/api/custom-fields/values \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "entityId": "ENTITY_ID",
    "entityType": "lead",
    "fieldValues": {
      "notes": "Very interested in our premium package",
      "last_contact_date": "2025-07-07"
    }
  }'
```

## Step 4: Field Management and Organization

### 4.1 Get Field Statistics

```bash
curl -X GET "http://localhost:3000/api/custom-fields/lead/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.2 Organize Fields

```bash
# Add field to summary section
curl -X PUT "http://localhost:3000/api/custom-fields/6/summary/add" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Change field category
curl -X PUT "http://localhost:3000/api/custom-fields/8/category" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"category": "Financial"}'

# Update field display order
curl -X PUT "http://localhost:3000/api/custom-fields/bulk/order" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldOrders": [
      {"fieldId": 1, "displayOrder": 1},
      {"fieldId": 2, "displayOrder": 2},
      {"fieldId": 3, "displayOrder": 3}
    ]
  }'
```

## Step 5: Advanced Features

### 5.1 Create Custom Field Groups

```bash
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "industry",
    "fieldLabel": "Industry",
    "fieldType": "select",
    "entityType": "lead",
    "options": ["Technology", "Healthcare", "Finance", "Manufacturing", "Education", "Retail"],
    "fieldGroup": "Company Details",
    "category": "Details",
    "displayOrder": 12
  }'
```

### 5.2 Get Field Groups

```bash
curl -X GET "http://localhost:3000/api/custom-fields/lead/groups" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5.3 Get Default and System Fields

```bash
# Get default fields
curl -X GET "http://localhost:3000/api/custom-fields/lead/default" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get system fields
curl -X GET "http://localhost:3000/api/custom-fields/lead/system" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Benefits of This Approach

1. **Flexibility**: Fields can be added, removed, or modified without changing code
2. **Scalability**: Support for unlimited custom fields
3. **Organization**: Fields organized by categories and groups
4. **Validation**: Built-in validation for different field types
5. **User-Friendly**: Both field names and IDs supported
6. **Audit Trail**: Complete history of field changes
7. **Performance**: Efficient storage and retrieval of field data

## Field Types Supported

- **text**: Simple text input
- **email**: Email address with validation
- **number**: Numeric values
- **date**: Date picker
- **select**: Dropdown with predefined options
- **multiselect**: Multiple selection dropdown
- **textarea**: Multi-line text input
- **radio**: Radio button selection
- **checkbox**: Boolean checkbox
- **currency**: Currency input with formatting
- **phone**: Phone number input
- **url**: URL input with validation

## Error Handling

The system provides comprehensive error handling:

- Required field validation
- Data type validation
- Option validation for select fields
- Email format validation
- Duplicate field name prevention
- Transaction rollback on errors

## Performance Considerations

- Use transactions for bulk operations
- Index frequently queried fields
- Consider caching for frequently accessed field configurations
- Optimize queries with proper joins
- Use pagination for large result sets

This approach provides a complete, flexible, and scalable solution for managing leads with custom fields!
