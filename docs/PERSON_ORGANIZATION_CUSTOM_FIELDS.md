# Person and Organization Custom Fields Guide

## Overview

This guide shows how to create and manage custom fields for Person and Organization entities, following the same flexible approach as Leads.

## 1. Creating Custom Fields for Person

### Example Person Fields

#### Basic Information Fields

```json
// Field 1: Name
{
  "fieldName": "name",
  "fieldLabel": "Name",
  "fieldType": "text",
  "entityType": "person",
  "fieldSource": "custom",
  "isRequired": true,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Basic Info",
  "description": "Full name of the person",
  "displayOrder": 1
}

// Field 2: Email
{
  "fieldName": "email",
  "fieldLabel": "Email",
  "fieldType": "email",
  "entityType": "person",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Contact Info",
  "description": "Primary email address",
  "displayOrder": 2
}

// Field 3: Phone
{
  "fieldName": "phone",
  "fieldLabel": "Phone",
  "fieldType": "text",
  "entityType": "person",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Contact Info",
  "description": "Primary phone number",
  "displayOrder": 3
}

// Field 4: Job Title
{
  "fieldName": "job_title",
  "fieldLabel": "Job Title",
  "fieldType": "text",
  "entityType": "person",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": false,
  "category": "Details",
  "fieldGroup": "Professional Info",
  "description": "Job title or position",
  "displayOrder": 4
}

// Field 5: Department
{
  "fieldName": "department",
  "fieldLabel": "Department",
  "fieldType": "select",
  "entityType": "person",
  "fieldSource": "custom",
  "options": ["Sales", "Marketing", "Engineering", "Finance", "HR", "Operations", "Customer Support"],
  "isRequired": false,
  "isImportant": false,
  "category": "Details",
  "fieldGroup": "Professional Info",
  "description": "Department or division",
  "displayOrder": 5
}

// Field 6: LinkedIn Profile
{
  "fieldName": "linkedin_profile",
  "fieldLabel": "LinkedIn Profile",
  "fieldType": "url",
  "entityType": "person",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": false,
  "category": "Contact",
  "fieldGroup": "Social Media",
  "description": "LinkedIn profile URL",
  "displayOrder": 6
}

// Field 7: Birthday
{
  "fieldName": "birthday",
  "fieldLabel": "Birthday",
  "fieldType": "date",
  "entityType": "person",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": false,
  "category": "Personal",
  "fieldGroup": "Personal Info",
  "description": "Date of birth",
  "displayOrder": 7
}

// Field 8: Owner
{
  "fieldName": "owner",
  "fieldLabel": "Owner",
  "fieldType": "select",
  "entityType": "person",
  "fieldSource": "custom",
  "options": ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Wilson"],
  "isRequired": true,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Assignment",
  "description": "Person responsible for this contact",
  "displayOrder": 8
}

// Field 9: Lead Score
{
  "fieldName": "lead_score",
  "fieldLabel": "Lead Score",
  "fieldType": "number",
  "entityType": "person",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": false,
  "category": "Details",
  "fieldGroup": "Scoring",
  "description": "Lead scoring from 0-100",
  "displayOrder": 9
}

// Field 10: Tags
{
  "fieldName": "tags",
  "fieldLabel": "Tags",
  "fieldType": "multiselect",
  "entityType": "person",
  "fieldSource": "custom",
  "options": ["Hot Lead", "Cold Lead", "VIP", "Partner", "Prospect", "Customer", "Former Customer"],
  "isRequired": false,
  "isImportant": false,
  "category": "Details",
  "fieldGroup": "Classification",
  "description": "Tags for categorization",
  "displayOrder": 10
}
```

## 2. Creating Custom Fields for Organization

### Example Organization Fields

```json
// Field 1: Company Name
{
  "fieldName": "company_name",
  "fieldLabel": "Company Name",
  "fieldType": "text",
  "entityType": "organization",
  "fieldSource": "custom",
  "isRequired": true,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Basic Info",
  "description": "Official company name",
  "displayOrder": 1
}

// Field 2: Website
{
  "fieldName": "website",
  "fieldLabel": "Website",
  "fieldType": "url",
  "entityType": "organization",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Contact Info",
  "description": "Company website URL",
  "displayOrder": 2
}

// Field 3: Industry
{
  "fieldName": "industry",
  "fieldLabel": "Industry",
  "fieldType": "select",
  "entityType": "organization",
  "fieldSource": "custom",
  "options": ["Technology", "Healthcare", "Finance", "Manufacturing", "Education", "Retail", "Real Estate", "Consulting", "Media", "Non-Profit"],
  "isRequired": false,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Business Info",
  "description": "Industry sector",
  "displayOrder": 3
}

// Field 4: Company Size
{
  "fieldName": "company_size",
  "fieldLabel": "Company Size",
  "fieldType": "select",
  "entityType": "organization",
  "fieldSource": "custom",
  "options": ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"],
  "isRequired": false,
  "isImportant": false,
  "category": "Details",
  "fieldGroup": "Business Info",
  "description": "Number of employees",
  "displayOrder": 4
}

// Field 5: Annual Revenue
{
  "fieldName": "annual_revenue",
  "fieldLabel": "Annual Revenue",
  "fieldType": "number",
  "entityType": "organization",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": false,
  "category": "Details",
  "fieldGroup": "Financial Info",
  "description": "Annual revenue in USD",
  "displayOrder": 5
}

// Field 6: Address
{
  "fieldName": "address",
  "fieldLabel": "Address",
  "fieldType": "textarea",
  "entityType": "organization",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": false,
  "category": "Contact",
  "fieldGroup": "Location",
  "description": "Physical address",
  "displayOrder": 6
}

// Field 7: Country
{
  "fieldName": "country",
  "fieldLabel": "Country",
  "fieldType": "select",
  "entityType": "organization",
  "fieldSource": "custom",
  "options": ["United States", "Canada", "United Kingdom", "Germany", "France", "Australia", "Japan", "India", "Brazil", "Other"],
  "isRequired": false,
  "isImportant": false,
  "category": "Contact",
  "fieldGroup": "Location",
  "description": "Country of operation",
  "displayOrder": 7
}

// Field 8: Owner
{
  "fieldName": "owner",
  "fieldLabel": "Owner",
  "fieldType": "select",
  "entityType": "organization",
  "fieldSource": "custom",
  "options": ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Wilson"],
  "isRequired": true,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Assignment",
  "description": "Account owner",
  "displayOrder": 8
}

// Field 9: Customer Status
{
  "fieldName": "customer_status",
  "fieldLabel": "Customer Status",
  "fieldType": "select",
  "entityType": "organization",
  "fieldSource": "custom",
  "options": ["Prospect", "Customer", "Former Customer", "Partner", "Competitor"],
  "isRequired": false,
  "isImportant": true,
  "category": "Summary",
  "fieldGroup": "Classification",
  "description": "Current relationship status",
  "displayOrder": 9
}

// Field 10: Founded Year
{
  "fieldName": "founded_year",
  "fieldLabel": "Founded Year",
  "fieldType": "number",
  "entityType": "organization",
  "fieldSource": "custom",
  "isRequired": false,
  "isImportant": false,
  "category": "Details",
  "fieldGroup": "Business Info",
  "description": "Year the company was founded",
  "displayOrder": 10
}
```

## 3. API Usage Examples

### Creating a Person with Custom Fields

```bash
POST /api/custom-fields/create-person
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**

```json
{
  "customFields": {
    "name": "John Smith",
    "email": "john.smith@acme.com",
    "phone": "+1-555-0123",
    "job_title": "VP of Sales",
    "department": "Sales",
    "linkedin_profile": "https://linkedin.com/in/johnsmith",
    "birthday": "1985-03-15",
    "owner": "Jane Smith",
    "lead_score": 85,
    "tags": ["Hot Lead", "VIP"]
  }
}
```

**Response:**

```json
{
  "message": "Person created successfully with custom fields.",
  "entityId": "person_1720358400000_abc123def",
  "entityType": "person",
  "customFields": [
    {
      "fieldId": 1,
      "fieldName": "name",
      "fieldLabel": "Name",
      "fieldType": "text",
      "value": "John Smith",
      "isRequired": true,
      "isImportant": true
    }
    // ... more fields
  ],
  "totalFields": 10
}
```

### Creating an Organization with Custom Fields

```bash
POST /api/custom-fields/create-organization
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**

```json
{
  "customFields": {
    "company_name": "ACME Corporation",
    "website": "https://acme.com",
    "industry": "Technology",
    "company_size": "201-500",
    "annual_revenue": 50000000,
    "address": "123 Business Ave, Suite 100\nNew York, NY 10001",
    "country": "United States",
    "owner": "John Doe",
    "customer_status": "Customer",
    "founded_year": 1995
  }
}
```

### Retrieving Person with Custom Fields

```bash
GET /api/custom-fields/person/person_1720358400000_abc123def
Authorization: Bearer YOUR_TOKEN
```

### Retrieving Organization with Custom Fields

```bash
GET /api/custom-fields/organization/organization_1720358400000_xyz789abc
Authorization: Bearer YOUR_TOKEN
```

### Getting All Person Fields

```bash
GET /api/custom-fields/?entityType=person
Authorization: Bearer YOUR_TOKEN
```

### Getting All Organization Fields

```bash
GET /api/custom-fields/?entityType=organization
Authorization: Bearer YOUR_TOKEN
```

## 4. Field Organization Structure

Similar to Pipedrive, your fields will be organized into sections:

### Summary Section

- Important fields marked with `isImportant: true` and `category: "Summary"`
- Quick access fields for immediate visibility

### Custom Groups

- **Basic Info**: Core identification fields
- **Contact Info**: Communication details
- **Professional Info**: Job-related information
- **Business Info**: Company-specific details
- **Financial Info**: Revenue and financial data
- **Social Media**: Social profiles and links
- **Personal Info**: Personal details
- **Classification**: Tags and categorization
- **Assignment**: Ownership and responsibility
- **Location**: Geographic information

### Default Fields

- Built-in CRM fields that are commonly used

### System Fields

- Read-only fields managed by the system (timestamps, counts, etc.)

## 5. Complete Workflow

1. **Create Custom Fields** for Person/Organization (one by one)
2. **Create Entities** using only custom fields
3. **Retrieve and Update** entity data through custom fields
4. **Organize Fields** into categories and groups
5. **Manage Field Order** and visibility

This approach provides the same flexibility as your Lead management while maintaining consistent patterns across all entity types in your CRM system.

## 6. Integration with Existing Models

The custom fields system works alongside your existing hardcoded Person and Organization models:

- **Relationships preserved**: Links between Lead -> Person -> Organization remain intact
- **Custom fields supplement**: Additional data stored in custom field tables
- **Unified API**: Single endpoint returns both hardcoded and custom field data
- **Gradual migration**: Can move from hardcoded to custom fields progressively

This gives you the best of both worlds - the flexibility of custom fields with the reliability of established relationships.
