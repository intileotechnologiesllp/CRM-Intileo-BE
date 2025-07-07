# CRM Custom Fields Documentation

## Overview

The Custom Fields feature allows users to dynamically add custom data fields to leads, deals, persons, organizations, and activities in your CRM system. This is similar to Pipedrive's "Data fields" functionality.

## Features

- ✅ Create custom fields for different entity types (leads, deals, persons, organizations, activities)
- ✅ Support for multiple field types (text, number, select, date, etc.)
- ✅ Organize fields by categories (Summary, Details, Financial, etc.)
- ✅ Set fields as required or important
- ✅ Dynamic field validation
- ✅ Custom field values storage and retrieval
- ✅ API endpoints for full CRUD operations

## Supported Field Types

| Field Type    | Description         | Example                 |
| ------------- | ------------------- | ----------------------- |
| `text`        | Single line text    | "Project Name"          |
| `textarea`    | Multi-line text     | "Project Description"   |
| `number`      | Integer numbers     | 42                      |
| `decimal`     | Decimal numbers     | 99.99                   |
| `email`       | Email addresses     | user@example.com        |
| `phone`       | Phone numbers       | +1-555-0123             |
| `url`         | Web URLs            | https://example.com     |
| `date`        | Date only           | 2024-12-31              |
| `datetime`    | Date and time       | 2024-12-31T10:30:00     |
| `select`      | Single selection    | "High", "Medium", "Low" |
| `multiselect` | Multiple selections | ["Option1", "Option2"]  |
| `checkbox`    | Boolean             | true/false              |
| `radio`       | Single selection    | "Option A"              |
| `currency`    | Currency values     | 50000.00                |

## API Endpoints

### Custom Field Management

#### Create Custom Field

```http
POST /api/custom-fields
Content-Type: application/json
Authorization: Bearer <token>

{
  "fieldName": "project_budget",
  "fieldLabel": "Project Budget",
  "fieldType": "currency",
  "entityType": "lead",
  "category": "Financial",
  "isRequired": true,
  "isImportant": true,
  "description": "Expected budget for the project"
}
```

#### Get Custom Fields

```http
GET /api/custom-fields?entityType=lead
Authorization: Bearer <token>
```

#### Update Custom Field

```http
PUT /api/custom-fields/1
Content-Type: application/json
Authorization: Bearer <token>

{
  "fieldLabel": "Updated Project Budget",
  "isRequired": false
}
```

#### Delete Custom Field

```http
DELETE /api/custom-fields/1
Authorization: Bearer <token>
```

### Custom Field Values

#### Save Field Values

```http
POST /api/custom-fields/values
Content-Type: application/json
Authorization: Bearer <token>

{
  "entityId": 123,
  "entityType": "lead",
  "fieldValues": {
    "1": "High Priority",
    "2": "50000",
    "3": "2024-12-31"
  }
}
```

#### Get Field Values

```http
GET /api/custom-fields/values/lead/123
Authorization: Bearer <token>
```

#### Update Field Values

```http
PUT /api/custom-fields/values/lead/123
Content-Type: application/json
Authorization: Bearer <token>

{
  "fieldValues": {
    "1": "Updated Priority",
    "2": "60000"
  }
}
```

## Integration with Existing Entities

### Creating Leads with Custom Fields

```javascript
// POST /api/leads
{
  "contactPerson": "John Doe",
  "organization": "Acme Corp",
  "title": "Website Redesign",
  "email": "john@acme.com",
  "phone": "+1-555-0123",
  "customFields": {
    "1": "High Priority",      // Priority field
    "2": "50000",             // Budget field
    "3": "2024-12-31"         // Deadline field
  }
}
```

### Creating Deals with Custom Fields

```javascript
// POST /api/deals
{
  "title": "Enterprise Software Deal",
  "contactPerson": "Jane Smith",
  "organization": "Tech Solutions Inc",
  "email": "jane@techsolutions.com",
  "phone": "+1-555-0456",
  "value": 75000,
  "customFields": {
    "4": "Q1 2024",           // Target Quarter
    "5": "Enterprise",        // Deal Size
    "6": "Direct Sales"       // Source Channel
  }
}
```

### Retrieving Entities with Custom Fields

When you fetch leads or deals, custom fields are automatically included:

```javascript
// GET /api/leads response
{
  "leads": [
    {
      "leadId": 123,
      "contactPerson": "John Doe",
      "organization": "Acme Corp",
      "title": "Website Redesign",
      "customFields": {
        "project_priority": {
          "fieldId": 1,
          "fieldLabel": "Project Priority",
          "fieldType": "select",
          "value": "High Priority"
        },
        "budget_range": {
          "fieldId": 2,
          "fieldLabel": "Budget Range",
          "fieldType": "currency",
          "value": "50000"
        }
      }
    }
  ]
}
```

## Frontend Implementation Examples

### Dynamic Form Generation

```javascript
// Fetch custom fields for lead entity
async function loadCustomFields(entityType) {
  const response = await fetch(`/api/custom-fields?entityType=${entityType}`);
  const { fields } = await response.json();

  const container = document.getElementById("customFieldsContainer");

  fields.forEach((field) => {
    const fieldElement = createFieldElement(field);
    container.appendChild(fieldElement);
  });
}

function createFieldElement(field) {
  const div = document.createElement("div");
  div.className = "form-group";

  let input;
  switch (field.fieldType) {
    case "text":
      input = `<input type="text" name="customFields[${field.fieldId}]" />`;
      break;
    case "select":
      const options = field.options
        .map((opt) => `<option value="${opt}">${opt}</option>`)
        .join("");
      input = `<select name="customFields[${field.fieldId}]">${options}</select>`;
      break;
    case "date":
      input = `<input type="date" name="customFields[${field.fieldId}]" />`;
      break;
    // Add more field types as needed
  }

  div.innerHTML = `
    <label>${field.fieldLabel}${field.isRequired ? " *" : ""}</label>
    ${input}
    ${field.description ? `<small>${field.description}</small>` : ""}
  `;

  return div;
}
```

### Field Validation

```javascript
function validateCustomFields(customFields, fieldDefinitions) {
  const errors = [];

  fieldDefinitions.forEach((field) => {
    const value = customFields[field.fieldId];

    if (field.isRequired && (!value || value.trim() === "")) {
      errors.push(`${field.fieldLabel} is required`);
    }

    if (value && field.fieldType === "email" && !isValidEmail(value)) {
      errors.push(`${field.fieldLabel} must be a valid email`);
    }

    if (value && field.fieldType === "number" && isNaN(value)) {
      errors.push(`${field.fieldLabel} must be a number`);
    }
  });

  return errors;
}
```

## Database Schema

### CustomFields Table

```sql
CREATE TABLE CustomFields (
  fieldId INT PRIMARY KEY AUTO_INCREMENT,
  fieldName VARCHAR(100) NOT NULL,
  fieldLabel VARCHAR(150) NOT NULL,
  fieldType ENUM('text', 'textarea', 'number', 'decimal', 'email', 'phone', 'url', 'date', 'datetime', 'select', 'multiselect', 'checkbox', 'radio', 'file', 'currency') NOT NULL DEFAULT 'text',
  entityType ENUM('lead', 'deal', 'person', 'organization', 'activity') NOT NULL,
  options JSON,
  validationRules JSON,
  defaultValue TEXT,
  isRequired BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  displayOrder INT DEFAULT 0,
  isImportant BOOLEAN DEFAULT FALSE,
  category VARCHAR(50),
  description TEXT,
  masterUserID INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_field_per_entity (fieldName, entityType, masterUserID)
);
```

### CustomFieldValues Table

```sql
CREATE TABLE CustomFieldValues (
  valueId INT PRIMARY KEY AUTO_INCREMENT,
  fieldId INT NOT NULL,
  entityId INT NOT NULL,
  entityType ENUM('lead', 'deal', 'person', 'organization', 'activity') NOT NULL,
  value TEXT,
  masterUserID INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (fieldId) REFERENCES CustomFields(fieldId) ON DELETE CASCADE,
  UNIQUE KEY unique_field_entity_value (fieldId, entityId, entityType)
);
```

## Security Considerations

1. **User Isolation**: Custom fields are isolated by `masterUserID` to ensure users can only see/modify their own fields
2. **Field Validation**: Server-side validation ensures data integrity
3. **Access Control**: All endpoints require authentication
4. **Data Sanitization**: User input is sanitized before storage

## Best Practices

1. **Field Naming**: Use clear, descriptive field names (e.g., "project_budget" instead of "field1")
2. **Categories**: Group related fields using categories for better organization
3. **Display Order**: Set appropriate display orders for logical field arrangement
4. **Validation**: Define proper validation rules for data quality
5. **Documentation**: Document custom fields for team understanding

## Migration Guide

If you're migrating from an existing system:

1. **Backup Data**: Always backup your existing data first
2. **Field Mapping**: Create a mapping between old fields and new custom fields
3. **Data Migration**: Use the API to bulk create custom fields and values
4. **Testing**: Test thoroughly in a development environment first

## Performance Considerations

- Custom field values are stored as JSON for complex data types
- Indexes are created on frequently queried columns
- Consider pagination for large datasets
- Use appropriate field types for better performance

## Troubleshooting

### Common Issues

1. **Field Not Appearing**: Check if the field is active and belongs to the correct entity type
2. **Validation Errors**: Ensure field values match the expected data type
3. **Permission Denied**: Verify the user has access to the custom field
4. **Data Not Saving**: Check if required fields are provided

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
// In your environment variables
DEBUG_CUSTOM_FIELDS = true;
```

This will provide detailed logs for custom field operations.

## Conclusion

The Custom Fields feature provides a powerful way to extend your CRM with dynamic data fields. It's designed to be flexible, secure, and easy to integrate with your existing workflows.

For more advanced use cases or custom requirements, please refer to the source code in:

- `models/customFieldModel.js`
- `models/customFieldValueModel.js`
- `controllers/customFieldController.js`
- `routes/customFieldRoutes.js`
