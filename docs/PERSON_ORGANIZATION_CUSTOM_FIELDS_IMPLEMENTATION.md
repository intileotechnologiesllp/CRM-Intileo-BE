# Person and Organization Custom Fields Implementation

## Overview

This implementation adds full custom field support to both Person and Organization entities in the CRM system. Users can now create, manage, and work with persons and organizations using only custom fields, providing maximum flexibility and customization.

## Features

### Person Management

- **Create persons** with custom fields only
- **View all persons** with their custom field data
- **Retrieve specific person** by ID with organized custom fields
- **Update person** custom field values
- **Delete person** and all associated custom field data

### Organization Management

- **Create organizations** with custom fields only
- **View all organizations** with their custom field data
- **Retrieve specific organization** by ID with organized custom fields
- **Update organization** custom field values
- **Delete organization** and all associated custom field data

## API Endpoints

### Person Endpoints

- `POST /api/persons` - Create a new person
- `GET /api/persons` - Get all persons
- `GET /api/persons/:personId` - Get a specific person
- `PUT /api/persons/:personId` - Update a person
- `DELETE /api/persons/:personId` - Delete a person

### Organization Endpoints

- `POST /api/organizations-new` - Create a new organization
- `GET /api/organizations-new` - Get all organizations
- `GET /api/organizations-new/:organizationId` - Get a specific organization
- `PUT /api/organizations-new/:organizationId` - Update an organization
- `DELETE /api/organizations-new/:organizationId` - Delete an organization

## Usage Examples

### 1. Creating Custom Fields for Person

First, create custom fields for the person entity:

```javascript
// POST /api/custom-fields
{
  "fieldName": "full_name",
  "fieldLabel": "Full Name",
  "fieldType": "text",
  "entityType": "person",
  "isRequired": true,
  "isImportant": true,
  "category": "Summary"
}

// POST /api/custom-fields
{
  "fieldName": "email_address",
  "fieldLabel": "Email Address",
  "fieldType": "email",
  "entityType": "person",
  "isRequired": true,
  "category": "Contact"
}

// POST /api/custom-fields
{
  "fieldName": "phone_number",
  "fieldLabel": "Phone Number",
  "fieldType": "phone",
  "entityType": "person",
  "isRequired": false,
  "category": "Contact"
}

// POST /api/custom-fields
{
  "fieldName": "job_title",
  "fieldLabel": "Job Title",
  "fieldType": "text",
  "entityType": "person",
  "isRequired": false,
  "category": "Details"
}

// POST /api/custom-fields
{
  "fieldName": "department",
  "fieldLabel": "Department",
  "fieldType": "select",
  "entityType": "person",
  "options": ["Sales", "Marketing", "Engineering", "HR", "Finance"],
  "isRequired": false,
  "category": "Details"
}
```

### 2. Creating a Person with Custom Fields

```javascript
// POST /api/persons
{
  "customFields": {
    "full_name": "John Doe",
    "email_address": "john.doe@example.com",
    "phone_number": "+1-555-123-4567",
    "job_title": "Sales Manager",
    "department": "Sales"
  }
}

// Response:
{
  "message": "Person created successfully with custom fields.",
  "personId": 1,
  "entityType": "person",
  "customFields": [
    {
      "fieldId": 1,
      "fieldName": "full_name",
      "fieldLabel": "Full Name",
      "fieldType": "text",
      "value": "John Doe",
      "isRequired": true,
      "isImportant": true
    },
    // ... other fields
  ],
  "totalFields": 5
}
```

### 3. Creating Custom Fields for Organization

```javascript
// POST /api/custom-fields
{
  "fieldName": "company_name",
  "fieldLabel": "Company Name",
  "fieldType": "text",
  "entityType": "organization",
  "isRequired": true,
  "isImportant": true,
  "category": "Summary"
}

// POST /api/custom-fields
{
  "fieldName": "industry",
  "fieldLabel": "Industry",
  "fieldType": "select",
  "entityType": "organization",
  "options": ["Technology", "Healthcare", "Finance", "Education", "Manufacturing"],
  "isRequired": false,
  "category": "Details"
}

// POST /api/custom-fields
{
  "fieldName": "company_size",
  "fieldLabel": "Company Size",
  "fieldType": "select",
  "entityType": "organization",
  "options": ["1-10", "11-50", "51-200", "201-500", "500+"],
  "isRequired": false,
  "category": "Details"
}

// POST /api/custom-fields
{
  "fieldName": "annual_revenue",
  "fieldLabel": "Annual Revenue",
  "fieldType": "currency",
  "entityType": "organization",
  "isRequired": false,
  "category": "Financial"
}
```

### 4. Creating an Organization with Custom Fields

```javascript
// POST /api/organizations-new
{
  "customFields": {
    "company_name": "Acme Corporation",
    "industry": "Technology",
    "company_size": "51-200",
    "annual_revenue": 5000000
  }
}

// Response:
{
  "message": "Organization created successfully with custom fields.",
  "organizationId": 1,
  "entityType": "organization",
  "customFields": [
    {
      "fieldId": 6,
      "fieldName": "company_name",
      "fieldLabel": "Company Name",
      "fieldType": "text",
      "value": "Acme Corporation",
      "isRequired": true,
      "isImportant": true
    },
    // ... other fields
  ],
  "totalFields": 4
}
```

### 5. Retrieving All Persons

```javascript
// GET /api/persons
{
  "message": "Persons retrieved successfully.",
  "persons": [
    {
      "personId": 1,
      "contactPerson": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1-555-123-4567",
      "createdAt": "2025-01-07T10:00:00.000Z",
      "updatedAt": "2025-01-07T10:00:00.000Z",
      "customFields": {
        "full_name": {
          "fieldId": 1,
          "fieldName": "full_name",
          "fieldLabel": "Full Name",
          "fieldType": "text",
          "value": "John Doe",
          "isRequired": true,
          "isImportant": true
        },
        // ... other custom fields
      }
    }
  ],
  "totalPersons": 1
}
```

### 6. Retrieving a Specific Person

```javascript
// GET /api/persons/1
{
  "message": "Person retrieved successfully.",
  "person": {
    "personId": 1,
    "contactPerson": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-123-4567",
    "createdAt": "2025-01-07T10:00:00.000Z",
    "updatedAt": "2025-01-07T10:00:00.000Z"
  },
  "customFields": {
    "values": {
      "1": {
        "fieldId": 1,
        "fieldName": "full_name",
        "fieldLabel": "Full Name",
        "fieldType": "text",
        "value": "John Doe",
        "category": "Summary",
        "fieldGroup": "Default"
      }
    },
    "fieldsByCategory": {
      "Summary": [...],
      "Contact": [...],
      "Details": [...]
    },
    "fieldsByGroup": {
      "Default": [...]
    }
  }
}
```

### 7. Updating a Person

```javascript
// PUT /api/persons/1
{
  "customFields": {
    "full_name": "John Smith",
    "job_title": "Senior Sales Manager",
    "department": "Sales"
  }
}

// Response:
{
  "message": "Person updated successfully with custom fields.",
  "personId": "1",
  "customFields": [
    {
      "fieldId": 1,
      "fieldName": "full_name",
      "fieldLabel": "Full Name",
      "fieldType": "text",
      "value": "John Smith",
      "isRequired": true,
      "isImportant": true
    },
    // ... other updated fields
  ],
  "totalFields": 3
}
```

### 8. Deleting a Person

```javascript
// DELETE /api/persons/1
{
  "message": "Person deleted successfully.",
  "personId": "1"
}
```

## Custom Field Types Supported

### Basic Types

- `text` - Single line text
- `textarea` - Multi-line text
- `number` - Numeric values
- `decimal` - Decimal numbers
- `email` - Email addresses (with validation)
- `phone` - Phone numbers
- `url` - URLs
- `date` - Date values
- `datetime` - Date and time values
- `currency` - Currency values
- `checkbox` - Boolean values
- `file` - File uploads

### Selection Types

- `select` - Single selection dropdown
- `multiselect` - Multiple selection
- `radio` - Radio buttons

### Entity Reference Types

- `person` - Reference to a person
- `organization` - Reference to an organization

## Field Organization

### Categories

- `Summary` - Important fields shown at the top
- `Contact` - Contact information
- `Details` - General details
- `Financial` - Financial information
- `Custom` - User-defined categories

### Field Groups

- `Default` - Default grouping
- Custom groups as defined by users

### Field Properties

- `isRequired` - Whether the field is mandatory
- `isImportant` - Whether the field appears in summary
- `displayOrder` - Order of field display
- `fieldSource` - Source of field (custom, default, system)

## Validation

### Automatic Validation

- Required field validation
- Email format validation
- Number format validation
- Select option validation

### Error Handling

- Validation errors are returned with detailed messages
- Transaction rollback on validation failures
- Proper HTTP status codes

## Database Integration

### Person Model Integration

- Uses existing `LeadPerson` model
- Stores essential fields (name, email, phone) in the model
- All other data stored as custom field values

### Organization Model Integration

- Uses existing `LeadOrganization` model
- Stores essential fields (name, address) in the model
- All other data stored as custom field values

### Custom Field Storage

- `CustomField` table stores field definitions
- `CustomFieldValue` table stores actual field values
- Proper relationships and foreign keys maintained

## Security

- All endpoints require authentication (`verifyToken` middleware)
- User isolation through `masterUserID`
- Transaction-based operations for data consistency
- Input validation and sanitization

## Performance Considerations

- Indexed database queries
- Efficient field lookups by ID or name
- Bulk operations where appropriate
- Proper error handling and logging

## Migration Strategy

### For Existing Systems

1. **Identify core fields** that should remain in the model
2. **Create equivalent custom fields** for non-core fields
3. **Migrate data** from model fields to custom field values
4. **Update frontend** to use custom field APIs
5. **Remove unused model fields** (optional)

### Recommended Core Fields

**Person:**

- `personId` (primary key)
- `contactPerson` (name)
- `email` (for uniqueness)
- `phone` (basic contact)
- `masterUserID` (user isolation)

**Organization:**

- `leadOrganizationId` (primary key)
- `organization` (name)
- `address` (basic info)
- `masterUserID` (user isolation)

## Best Practices

1. **Field Naming**: Use consistent, descriptive field names
2. **Categories**: Organize fields into logical categories
3. **Validation**: Define appropriate validation rules
4. **Required Fields**: Mark essential fields as required
5. **Field Types**: Choose appropriate field types for data
6. **Performance**: Use field IDs for frequent operations
7. **User Experience**: Mark important fields for summary display

## Testing

### API Testing Examples

```javascript
// Test creating a person
const personData = {
  customFields: {
    full_name: "Test Person",
    email_address: "test@example.com",
  },
};

const response = await fetch("/api/persons", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer your-token",
  },
  body: JSON.stringify(personData),
});

const result = await response.json();
console.log(result);
```

This implementation provides a complete, flexible, and scalable solution for managing persons and organizations with custom fields in your CRM system.
