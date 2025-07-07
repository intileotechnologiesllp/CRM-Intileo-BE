// STEP-BY-STEP CUSTOM FIELDS WORKFLOW
// This file shows the correct request body formats for each API endpoint

// ========================================
// STEP 1: CREATE CUSTOM FIELDS (one by one)
// ========================================

// POST /api/custom-fields/
// Headers: Content-Type: application/json, Authorization: Bearer YOUR_TOKEN

// Field 1: Contact Person
const field1 = {
  fieldName: "contact_person",
  fieldLabel: "Contact Person",
  fieldType: "text",
  entityType: "lead",
  fieldSource: "custom",
  isRequired: true,
  isImportant: true,
  category: "Summary",
  fieldGroup: "Basic Info",
  description: "Primary contact person for this lead",
  displayOrder: 1,
};

// Field 2: Organization
const field2 = {
  fieldName: "organization",
  fieldLabel: "Organization",
  fieldType: "text",
  entityType: "lead",
  fieldSource: "custom",
  isRequired: true,
  isImportant: true,
  category: "Summary",
  fieldGroup: "Basic Info",
  description: "Company or organization name",
  displayOrder: 2,
};

// Field 3: Title
const field3 = {
  fieldName: "title",
  fieldLabel: "Title",
  fieldType: "text",
  entityType: "lead",
  fieldSource: "custom",
  isRequired: true,
  isImportant: true,
  category: "Summary",
  fieldGroup: "Basic Info",
  description: "Lead title or project name",
  displayOrder: 3,
};

// Field 4: Email
const field4 = {
  fieldName: "email",
  fieldLabel: "Email",
  fieldType: "email",
  entityType: "lead",
  fieldSource: "custom",
  isRequired: false,
  isImportant: false,
  category: "Contact",
  fieldGroup: "Contact Info",
  description: "Primary email address",
  displayOrder: 4,
};

// Field 5: Phone
const field5 = {
  fieldName: "phone",
  fieldLabel: "Phone",
  fieldType: "text",
  entityType: "lead",
  fieldSource: "custom",
  isRequired: false,
  isImportant: false,
  category: "Contact",
  fieldGroup: "Contact Info",
  description: "Primary phone number",
  displayOrder: 5,
};

// Field 6: Lead Source
const field6 = {
  fieldName: "lead_source",
  fieldLabel: "Lead Source",
  fieldType: "select",
  entityType: "lead",
  fieldSource: "custom",
  options: [
    "Website",
    "Email",
    "Phone Call",
    "Referral",
    "Social Media",
    "Advertisement",
    "Trade Show",
    "Cold Call",
  ],
  isRequired: false,
  isImportant: false,
  category: "Details",
  fieldGroup: "Lead Info",
  description: "How did this lead come to us?",
  displayOrder: 6,
};

// Field 7: Priority Level
const field7 = {
  fieldName: "priority_level",
  fieldLabel: "Priority Level",
  fieldType: "select",
  entityType: "lead",
  fieldSource: "custom",
  options: ["Low", "Medium", "High", "Critical"],
  isRequired: false,
  isImportant: false,
  category: "Details",
  fieldGroup: "Lead Info",
  description: "Priority level for this lead",
  displayOrder: 7,
};

// Field 8: Budget Range
const field8 = {
  fieldName: "budget_range",
  fieldLabel: "Budget Range",
  fieldType: "number",
  entityType: "lead",
  fieldSource: "custom",
  isRequired: false,
  isImportant: false,
  category: "Details",
  fieldGroup: "Lead Info",
  description: "Estimated budget for this lead",
  displayOrder: 8,
};

// Field 9: Expected Close Date
const field9 = {
  fieldName: "expected_close_date",
  fieldLabel: "Expected Close Date",
  fieldType: "date",
  entityType: "lead",
  fieldSource: "custom",
  isRequired: false,
  isImportant: false,
  category: "Details",
  fieldGroup: "Lead Info",
  description: "When do we expect to close this lead?",
  displayOrder: 9,
};

// Field 10: Stage
const field10 = {
  fieldName: "stage",
  fieldLabel: "Stage",
  fieldType: "select",
  entityType: "lead",
  fieldSource: "custom",
  options: [
    "New",
    "Contacted",
    "Qualified",
    "Proposal",
    "Negotiation",
    "Won",
    "Lost",
  ],
  isRequired: true,
  isImportant: true,
  category: "Summary",
  fieldGroup: "Lead Info",
  description: "Current stage of the lead",
  displayOrder: 10,
};

// Field 11: Status
const field11 = {
  fieldName: "status",
  fieldLabel: "Status",
  fieldType: "select",
  entityType: "lead",
  fieldSource: "custom",
  options: ["Active", "Inactive", "On Hold", "Closed"],
  isRequired: true,
  isImportant: true,
  category: "Summary",
  fieldGroup: "Lead Info",
  description: "Current status of the lead",
  displayOrder: 11,
};

// ========================================
// STEP 2: CREATE LEAD WITH CUSTOM FIELDS
// ========================================

// POST /api/custom-fields/create-entity
// Headers: Content-Type: application/json, Authorization: Bearer YOUR_TOKEN

const createLeadRequest = {
  entityType: "lead",
  customFields: {
    contact_person: "John Smith",
    organization: "ACME Corporation",
    title: "Website Redesign Project",
    email: "john.smith@acme.com",
    phone: "+1-555-0123",
    lead_source: "Website",
    priority_level: "High",
    budget_range: 50000,
    expected_close_date: "2025-08-15",
    stage: "Qualified",
    status: "Active",
  },
};

// ========================================
// STEP 3: UPDATE LEAD CUSTOM FIELDS
// ========================================

// PUT /api/custom-fields/values/lead/{entityId}
// Headers: Content-Type: application/json, Authorization: Bearer YOUR_TOKEN

const updateLeadRequest = {
  fieldValues: {
    contact_person: "John Smith Jr.",
    priority_level: "Critical",
    budget_range: 75000,
    stage: "Proposal",
  },
};

// ========================================
// STEP 4: ADD MORE CUSTOM FIELD VALUES
// ========================================

// POST /api/custom-fields/values
// Headers: Content-Type: application/json, Authorization: Bearer YOUR_TOKEN

const addMoreFieldsRequest = {
  entityId: "lead_1720358400000_abc123def", // Replace with actual entity ID
  entityType: "lead",
  fieldValues: {
    notes: "Very interested in our premium package",
    last_contact_date: "2025-07-07",
    preferred_contact_method: "Email",
  },
};

// ========================================
// EXAMPLE USING FIELD IDs INSTEAD OF NAMES
// ========================================

// POST /api/custom-fields/create-entity
// You can use field IDs instead of field names

const createLeadWithFieldIds = {
  entityType: "lead",
  customFields: {
    1: "John Smith", // contact_person
    2: "ACME Corporation", // organization
    3: "Website Redesign Project", // title
    4: "john.smith@acme.com", // email
    5: "+1-555-0123", // phone
    6: "Website", // lead_source
    7: "High", // priority_level
    8: 50000, // budget_range
    9: "2025-08-15", // expected_close_date
    10: "Qualified", // stage
    11: "Active", // status
  },
};

// ========================================
// MIXED APPROACH (BOTH FIELD IDs AND NAMES)
// ========================================

const createLeadMixedApproach = {
  entityType: "lead",
  customFields: {
    contact_person: "John Smith", // Using field name
    2: "ACME Corporation", // Using field ID
    title: "Website Redesign Project", // Using field name
    4: "john.smith@acme.com", // Using field ID
    phone: "+1-555-0123", // Using field name
    lead_source: "Website", // Using field name
    7: "High", // Using field ID
    budget_range: 50000, // Using field name
    9: "2025-08-15", // Using field ID
    stage: "Qualified", // Using field name
    status: "Active", // Using field name
  },
};

// ========================================
// CURL COMMAND EXAMPLES
// ========================================

/*
// Create a custom field
curl -X POST http://localhost:3000/api/custom-fields/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fieldName": "contact_person",
    "fieldLabel": "Contact Person",
    "fieldType": "text",
    "entityType": "lead",
    "fieldSource": "custom",
    "isRequired": true,
    "isImportant": true,
    "category": "Summary",
    "fieldGroup": "Basic Info",
    "description": "Primary contact person for this lead",
    "displayOrder": 1
  }'

// Create a lead with custom fields
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

// Get all custom fields
curl -X GET "http://localhost:3000/api/custom-fields/?entityType=lead" \
  -H "Authorization: Bearer YOUR_TOKEN"

// Get lead custom field values
curl -X GET "http://localhost:3000/api/custom-fields/values/lead/ENTITY_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

// Update lead custom field values
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
*/

// ========================================
// COMMON MISTAKES TO AVOID
// ========================================

// ❌ WRONG: Sending multiple fields at once to create endpoint
const wrongFieldCreation = {
  fields: [
    { fieldName: "contact_person", fieldLabel: "Contact Person" },
    { fieldName: "organization", fieldLabel: "Organization" },
  ],
};

// ❌ WRONG: Wrong structure for creating lead
const wrongLeadCreation = {
  entityType: "lead",
  fields: {
    contact_person: "John Smith",
    organization: "ACME Corporation",
  },
};

// ❌ WRONG: Missing fieldValues wrapper for updates
const wrongUpdateFormat = {
  contact_person: "John Smith Jr.",
  priority_level: "Critical",
};

// ✅ CORRECT: Proper structure for each endpoint
// - Custom field creation: Send one field object at a time
// - Lead creation: Use "customFields" object with field names/IDs as keys
// - Updates: Use "fieldValues" object wrapper
// - Additional field values: Use "fieldValues" with entityId and entityType

module.exports = {
  // Field creation examples
  field1,
  field2,
  field3,
  field4,
  field5,
  field6,
  field7,
  field8,
  field9,
  field10,
  field11,

  // Lead creation examples
  createLeadRequest,
  createLeadWithFieldIds,
  createLeadMixedApproach,

  // Update examples
  updateLeadRequest,
  addMoreFieldsRequest,
};
