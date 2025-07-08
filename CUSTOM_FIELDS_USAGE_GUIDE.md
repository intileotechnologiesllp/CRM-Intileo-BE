# Complete Custom Fields System Usage Guide

## Overview

This guide provides step-by-step instructions for using the fully dynamic custom fields system in your CRM, similar to Pipedrive's "Data fields" feature. The system allows you to create entities (leads, deals, persons, organizations) using only custom fields, with no hardcoded form fields.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Custom Field Management](#custom-field-management)
3. [Entity Creation with Custom Fields](#entity-creation-with-custom-fields)
4. [Custom Field Values Management](#custom-field-values-management)
5. [Field Organization and Grouping](#field-organization-and-grouping)
6. [API Reference](#api-reference)
7. [Frontend Integration](#frontend-integration)
8. [Migration from Hardcoded Fields](#migration-from-hardcoded-fields)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

## System Architecture

### Core Components

- **CustomField Model**: Defines field structure, validation, and metadata
- **CustomFieldValue Model**: Stores actual values for entities
- **CustomFieldController**: Handles all CRUD operations
- **Entity Controllers**: Updated to support custom fields (leads, deals, persons, organizations)

### Field Types Supported

- `text` - Single line text
- `textarea` - Multi-line text
- `number` - Numeric values
- `decimal` - Decimal numbers
- `email` - Email addresses
- `phone` - Phone numbers
- `url` - Website URLs
- `date` - Date picker
- `datetime` - Date and time picker
- `select` - Single selection dropdown
- `multiselect` - Multiple selection
- `checkbox` - Boolean checkbox
- `radio` - Radio buttons
- `file` - File uploads
- `currency` - Currency values
- `organization` - Reference to organization entity
- `person` - Reference to person entity

### Field Sources

- `custom` - User-created fields
- `default` - Built-in fields (visible, editable)
- `system` - System fields (read-only)

## Custom Field Management

### 1. Creating Custom Fields

```bash
# Create a custom field
curl -X POST http://localhost:3000/api/custom-fields \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "business_size",
    "fieldLabel": "Business Size",
    "fieldType": "select",
    "entityType": "lead",
    "options": ["Small (1-50)", "Medium (51-200)", "Large (201-1000)", "Enterprise (1000+)"],
    "category": "Summary",
    "isRequired": true,
    "isImportant": true,
    "description": "Size of the business in terms of employee count"
  }'
```

### 2. Retrieving Custom Fields

```bash
# Get all custom fields for leads
curl -X GET "http://localhost:3000/api/custom-fields?entityType=lead" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get custom fields with statistics
curl -X GET "http://localhost:3000/api/custom-fields/lead/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Updating Custom Fields

```bash
# Update a custom field
curl -X PUT http://localhost:3000/api/custom-fields/123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldLabel": "Updated Business Size",
    "isRequired": false
  }'
```

### 4. Field Organization

Fields can be organized using:

- **Categories**: `Summary`, `Details`, `Custom`
- **Field Groups**: Logical groupings within categories
- **Display Order**: Order of appearance
- **Importance**: Mark fields as important for highlighting

## Entity Creation with Custom Fields

### 1. Creating Leads with Custom Fields Only

```bash
# Create a lead using only custom fields
curl -X POST http://localhost:3000/api/custom-fields/create-entity \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "lead",
    "customFields": {
      "business_size": "Medium (51-200)",
      "annual_revenue": "5000000",
      "pain_points": "Manual processes are slowing down operations",
      "decision_timeline": "1-3 months"
    }
  }'
```

### 2. Creating Persons with Custom Fields

```bash
# Create a person using only custom fields
curl -X POST http://localhost:3000/api/custom-fields/create-person \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customFields": {
      "linkedin_profile": "https://linkedin.com/in/john-doe",
      "job_level": "Manager",
      "communication_preference": ["Email", "Video Call"],
      "department": "Sales"
    }
  }'
```

### 3. Creating Organizations with Custom Fields

```bash
# Create an organization using only custom fields
curl -X POST http://localhost:3000/api/custom-fields/create-organization \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customFields": {
      "industry_vertical": "Technology",
      "company_size": "Medium (51-200)",
      "website_url": "https://example.com",
      "annual_revenue": "5000000"
    }
  }'
```

### 4. Creating Deals with Custom Fields

```bash
# Create a deal using existing deals controller (with custom fields support)
curl -X POST http://localhost:3000/api/deals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dealName": "Tech Solutions Deal",
    "dealValue": 50000,
    "stage": "Qualification",
    "customFields": {
      "deal_source": "Website",
      "competitor_info": "Considering Salesforce and HubSpot",
      "contract_duration": 12
    }
  }'
```

## Custom Field Values Management

### 1. Retrieving Custom Field Values

```bash
# Get custom field values for a specific entity
curl -X GET "http://localhost:3000/api/custom-fields/values/lead/123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Updating Custom Field Values

```bash
# Update custom field values
curl -X PUT http://localhost:3000/api/custom-fields/values/lead/123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customFields": {
      "business_size": "Large (201-1000)",
      "decision_timeline": "Within 1 month"
    }
  }'
```

### 3. Saving New Custom Field Values

```bash
# Save custom field values (alternative method)
curl -X POST http://localhost:3000/api/custom-fields/values \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "lead",
    "entityId": 123,
    "customFields": {
      "business_size": "Enterprise (1000+)",
      "notes": "High-value prospect"
    }
  }'
```

## Field Organization and Grouping

### 1. Field Categories

Fields are organized into categories:

- **Summary**: Most important fields displayed prominently
- **Details**: Detailed information fields
- **Custom**: User-defined category

### 2. Field Groups

Within categories, fields can be grouped:

- **Qualification**: Lead qualification fields
- **Contact Information**: Contact details
- **Financial Information**: Revenue, budget fields
- **Competitive Analysis**: Competitor information

### 3. Getting Field Organization

```bash
# Get field groups for an entity type
curl -X GET "http://localhost:3000/api/custom-fields/lead/groups" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get default fields
curl -X GET "http://localhost:3000/api/custom-fields/lead/default" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get system fields
curl -X GET "http://localhost:3000/api/custom-fields/lead/system" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Reference

### Custom Fields Endpoints

| Method | Endpoint                                | Description          |
| ------ | --------------------------------------- | -------------------- |
| POST   | `/api/custom-fields`                    | Create custom field  |
| GET    | `/api/custom-fields`                    | Get custom fields    |
| GET    | `/api/custom-fields/:entityType/stats`  | Get field statistics |
| GET    | `/api/custom-fields/:entityType/groups` | Get field groups     |
| PUT    | `/api/custom-fields/:fieldId`           | Update custom field  |
| DELETE | `/api/custom-fields/:fieldId`           | Delete custom field  |

### Custom Field Values Endpoints

| Method | Endpoint                                          | Description                |
| ------ | ------------------------------------------------- | -------------------------- |
| POST   | `/api/custom-fields/values`                       | Save custom field values   |
| GET    | `/api/custom-fields/values/:entityType/:entityId` | Get custom field values    |
| PUT    | `/api/custom-fields/values/:entityType/:entityId` | Update custom field values |
| DELETE | `/api/custom-fields/values/:valueId`              | Delete custom field value  |

### Entity Creation Endpoints

| Method | Endpoint                                 | Description                            |
| ------ | ---------------------------------------- | -------------------------------------- |
| POST   | `/api/custom-fields/create-entity`       | Create entity with custom fields       |
| POST   | `/api/custom-fields/create-person`       | Create person with custom fields       |
| POST   | `/api/custom-fields/create-organization` | Create organization with custom fields |

## Frontend Integration

### 1. Dynamic Form Generation

```javascript
// Example React component for dynamic form generation
import React, { useState, useEffect } from "react";

const DynamicForm = ({ entityType, onSubmit }) => {
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});

  useEffect(() => {
    // Fetch custom fields for entity type
    fetchCustomFields(entityType).then(setFields);
  }, [entityType]);

  const fetchCustomFields = async (entityType) => {
    const response = await fetch(
      `/api/custom-fields?entityType=${entityType}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json();
    return data.customFields || [];
  };

  const renderField = (field) => {
    switch (field.fieldType) {
      case "text":
        return (
          <input
            type="text"
            name={field.fieldName}
            value={values[field.fieldName] || ""}
            onChange={(e) =>
              setValues({ ...values, [field.fieldName]: e.target.value })
            }
            required={field.isRequired}
          />
        );
      case "select":
        return (
          <select
            name={field.fieldName}
            value={values[field.fieldName] || ""}
            onChange={(e) =>
              setValues({ ...values, [field.fieldName]: e.target.value })
            }
            required={field.isRequired}
          >
            <option value="">Select...</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      // Add more field types as needed
      default:
        return <input type="text" />;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit}>
      {fields.map((field) => (
        <div
          key={field.fieldId}
          className={`form-group ${field.isImportant ? "important" : ""}`}
        >
          <label>{field.fieldLabel}</label>
          {renderField(field)}
          {field.description && <small>{field.description}</small>}
        </div>
      ))}
      <button type="submit">Create {entityType}</button>
    </form>
  );
};
```

### 2. Field Organization Display

```javascript
// Example for displaying fields by category
const OrganizedFieldsDisplay = ({ entityType, entityId }) => {
  const [fieldsByCategory, setFieldsByCategory] = useState({});

  useEffect(() => {
    // Fetch fields with stats to get organization
    fetchFieldStats(entityType).then((data) => {
      setFieldsByCategory(data.fieldsByCategory);
    });
  }, [entityType]);

  return (
    <div className="organized-fields">
      {Object.entries(fieldsByCategory).map(([category, fields]) => (
        <div key={category} className="field-category">
          <h3>{category}</h3>
          {fields.map((field) => (
            <div key={field.fieldId} className="field-item">
              <label>{field.fieldLabel}</label>
              {/* Render field value */}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
```

## Migration from Hardcoded Fields

### 1. Identify Hardcoded Fields

First, identify all hardcoded fields in your current models and forms:

```javascript
// Example: Current hardcoded lead model
const Lead = {
  leadId: "system",
  contactPerson: "default",
  organization: "default",
  title: "default",
  email: "default",
  proposalValue: "default",
  // ... other fields
};
```

### 2. Create Custom Fields for Existing Fields

```javascript
// Script to migrate hardcoded fields to custom fields
const migrateHardcodedFields = async () => {
  const hardcodedFields = [
    {
      name: "contactPerson",
      label: "Contact Person",
      type: "text",
      source: "default",
    },
    {
      name: "organization",
      label: "Organization",
      type: "text",
      source: "default",
    },
    { name: "title", label: "Title", type: "text", source: "default" },
    { name: "email", label: "Email", type: "email", source: "default" },
    {
      name: "proposalValue",
      label: "Proposal Value",
      type: "currency",
      source: "default",
    },
  ];

  for (const field of hardcodedFields) {
    await createCustomField({
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.type,
      fieldSource: field.source,
      entityType: "lead",
      category: "Summary",
    });
  }
};
```

### 3. Data Migration Script

```javascript
// Migrate existing data to custom field values
const migrateData = async () => {
  const existingLeads = await Lead.findAll();

  for (const lead of existingLeads) {
    const customFieldValues = {
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      title: lead.title,
      email: lead.email,
      proposalValue: lead.proposalValue,
    };

    await saveCustomFieldValues("lead", lead.leadId, customFieldValues);
  }
};
```

## Testing

### 1. Running the Complete Test Suite

```bash
# Install dependencies
npm install axios

# Run the complete test
node test-custom-fields-complete.js
```

### 2. Manual Testing Steps

1. **Create Custom Fields**: Test creating various field types
2. **Field Validation**: Test required fields, validation rules
3. **Entity Creation**: Create entities using only custom fields
4. **Value Updates**: Test updating custom field values
5. **Retrieval**: Test retrieving entities with custom fields
6. **Organization**: Test field grouping and categorization

### 3. Test Cases

```javascript
// Test validation
const testValidation = async () => {
  // Test required field validation
  try {
    await createEntityWithCustomFields("lead", {
      non_required_field: "value",
      // Missing required field
    });
  } catch (error) {
    console.log("✅ Required field validation works");
  }
};

// Test field type validation
const testFieldTypes = async () => {
  const testData = {
    email_field: "invalid-email",
    number_field: "not-a-number",
    url_field: "invalid-url",
  };

  // Should fail validation
  try {
    await createEntityWithCustomFields("lead", testData);
  } catch (error) {
    console.log("✅ Field type validation works");
  }
};
```

## Troubleshooting

### Common Issues

1. **Field Not Found**: Ensure field exists and is active
2. **Validation Errors**: Check field validation rules
3. **Permission Errors**: Verify user has access to field
4. **Data Type Errors**: Ensure value matches field type

### Debug Steps

1. **Check Field Definition**:

   ```bash
   curl -X GET "http://localhost:3000/api/custom-fields?entityType=lead" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Verify Field Values**:

   ```bash
   curl -X GET "http://localhost:3000/api/custom-fields/values/lead/123" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Check Server Logs**: Look for validation errors or database issues

4. **Test with Minimal Data**: Start with required fields only

### Performance Considerations

1. **Index Usage**: Custom fields are indexed by entityType and entityId
2. **Batch Operations**: Use batch operations for multiple field updates
3. **Caching**: Consider caching field definitions for better performance
4. **Pagination**: Use pagination for large field lists

## Conclusion

This custom fields system provides a fully dynamic approach to entity management, allowing you to:

- Create entities using only custom fields
- Organize fields with categories and groups
- Validate data with custom rules
- Maintain flexibility for future requirements

The system is designed to be extensible and can be easily integrated into any frontend framework while maintaining backward compatibility with existing data.
