// PERSON AND ORGANIZATION CUSTOM FIELDS - API EXAMPLES

// =====================================
// 1. CREATE CUSTOM FIELDS FOR PERSON
// =====================================

// Basic Person Fields
const personFields = [
  {
    fieldName: "full_name",
    fieldLabel: "Full Name",
    fieldType: "text",
    entityType: "person",
    isRequired: true,
    isImportant: true,
    category: "Summary",
  },
  {
    fieldName: "email_address",
    fieldLabel: "Email Address",
    fieldType: "email",
    entityType: "person",
    isRequired: true,
    category: "Contact",
  },
  {
    fieldName: "phone_number",
    fieldLabel: "Phone Number",
    fieldType: "phone",
    entityType: "person",
    isRequired: false,
    category: "Contact",
  },
  {
    fieldName: "job_title",
    fieldLabel: "Job Title",
    fieldType: "text",
    entityType: "person",
    isRequired: false,
    category: "Professional",
  },
  {
    fieldName: "department",
    fieldLabel: "Department",
    fieldType: "select",
    entityType: "person",
    options: ["Sales", "Marketing", "Engineering", "HR", "Finance"],
    isRequired: false,
    category: "Professional",
  },
  {
    fieldName: "linkedin_profile",
    fieldLabel: "LinkedIn Profile",
    fieldType: "url",
    entityType: "person",
    isRequired: false,
    category: "Social",
  },
];

// =====================================
// 2. CREATE CUSTOM FIELDS FOR ORGANIZATION
// =====================================

const organizationFields = [
  {
    fieldName: "company_name",
    fieldLabel: "Company Name",
    fieldType: "text",
    entityType: "organization",
    isRequired: true,
    isImportant: true,
    category: "Summary",
  },
  {
    fieldName: "industry",
    fieldLabel: "Industry",
    fieldType: "select",
    entityType: "organization",
    options: [
      "Technology",
      "Healthcare",
      "Finance",
      "Education",
      "Manufacturing",
      "Retail",
    ],
    isRequired: false,
    category: "Details",
  },
  {
    fieldName: "company_size",
    fieldLabel: "Company Size",
    fieldType: "select",
    entityType: "organization",
    options: ["1-10", "11-50", "51-200", "201-500", "500+"],
    isRequired: false,
    category: "Details",
  },
  {
    fieldName: "annual_revenue",
    fieldLabel: "Annual Revenue",
    fieldType: "currency",
    entityType: "organization",
    isRequired: false,
    category: "Financial",
  },
  {
    fieldName: "website",
    fieldLabel: "Website",
    fieldType: "url",
    entityType: "organization",
    isRequired: false,
    category: "Contact",
  },
  {
    fieldName: "description",
    fieldLabel: "Company Description",
    fieldType: "textarea",
    entityType: "organization",
    isRequired: false,
    category: "Details",
  },
];

// =====================================
// 3. CREATE PERSON WITH CUSTOM FIELDS
// =====================================

// POST /api/persons
const createPersonRequest = {
  customFields: {
    full_name: "John Doe",
    email_address: "john.doe@example.com",
    phone_number: "+1-555-123-4567",
    job_title: "Sales Manager",
    department: "Sales",
    linkedin_profile: "https://linkedin.com/in/johndoe",
  },
};

const createPersonResponse = {
  message: "Person created successfully with custom fields.",
  personId: 1,
  entityType: "person",
  customFields: [
    {
      fieldId: 1,
      fieldName: "full_name",
      fieldLabel: "Full Name",
      fieldType: "text",
      value: "John Doe",
      isRequired: true,
      isImportant: true,
    },
    {
      fieldId: 2,
      fieldName: "email_address",
      fieldLabel: "Email Address",
      fieldType: "email",
      value: "john.doe@example.com",
      isRequired: true,
      isImportant: false,
    },
    {
      fieldId: 3,
      fieldName: "phone_number",
      fieldLabel: "Phone Number",
      fieldType: "phone",
      value: "+1-555-123-4567",
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 4,
      fieldName: "job_title",
      fieldLabel: "Job Title",
      fieldType: "text",
      value: "Sales Manager",
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 5,
      fieldName: "department",
      fieldLabel: "Department",
      fieldType: "select",
      value: "Sales",
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 6,
      fieldName: "linkedin_profile",
      fieldLabel: "LinkedIn Profile",
      fieldType: "url",
      value: "https://linkedin.com/in/johndoe",
      isRequired: false,
      isImportant: false,
    },
  ],
  totalFields: 6,
};

// =====================================
// 4. CREATE ORGANIZATION WITH CUSTOM FIELDS
// =====================================

// POST /api/organizations-new
const createOrganizationRequest = {
  customFields: {
    company_name: "Acme Corporation",
    industry: "Technology",
    company_size: "51-200",
    annual_revenue: 5000000,
    website: "https://acmecorp.com",
    description: "Leading provider of innovative technology solutions",
  },
};

const createOrganizationResponse = {
  message: "Organization created successfully with custom fields.",
  organizationId: 1,
  entityType: "organization",
  customFields: [
    {
      fieldId: 7,
      fieldName: "company_name",
      fieldLabel: "Company Name",
      fieldType: "text",
      value: "Acme Corporation",
      isRequired: true,
      isImportant: true,
    },
    {
      fieldId: 8,
      fieldName: "industry",
      fieldLabel: "Industry",
      fieldType: "select",
      value: "Technology",
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 9,
      fieldName: "company_size",
      fieldLabel: "Company Size",
      fieldType: "select",
      value: "51-200",
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 10,
      fieldName: "annual_revenue",
      fieldLabel: "Annual Revenue",
      fieldType: "currency",
      value: 5000000,
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 11,
      fieldName: "website",
      fieldLabel: "Website",
      fieldType: "url",
      value: "https://acmecorp.com",
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 12,
      fieldName: "description",
      fieldLabel: "Company Description",
      fieldType: "textarea",
      value: "Leading provider of innovative technology solutions",
      isRequired: false,
      isImportant: false,
    },
  ],
  totalFields: 6,
};

// =====================================
// 5. GET ALL PERSONS
// =====================================

// GET /api/persons
const getAllPersonsResponse = {
  message: "Persons retrieved successfully.",
  persons: [
    {
      personId: 1,
      contactPerson: "John Doe",
      email: "john.doe@example.com",
      phone: "+1-555-123-4567",
      createdAt: "2025-01-07T10:00:00.000Z",
      updatedAt: "2025-01-07T10:00:00.000Z",
      customFields: {
        full_name: {
          fieldId: 1,
          fieldName: "full_name",
          fieldLabel: "Full Name",
          fieldType: "text",
          value: "John Doe",
          isRequired: true,
          isImportant: true,
        },
        email_address: {
          fieldId: 2,
          fieldName: "email_address",
          fieldLabel: "Email Address",
          fieldType: "email",
          value: "john.doe@example.com",
          isRequired: true,
          isImportant: false,
        },
        // ... other fields
      },
    },
  ],
  totalPersons: 1,
};

// =====================================
// 6. GET SPECIFIC PERSON
// =====================================

// GET /api/persons/1
const getPersonResponse = {
  message: "Person retrieved successfully.",
  person: {
    personId: 1,
    contactPerson: "John Doe",
    email: "john.doe@example.com",
    phone: "+1-555-123-4567",
    createdAt: "2025-01-07T10:00:00.000Z",
    updatedAt: "2025-01-07T10:00:00.000Z",
  },
  customFields: {
    values: {
      1: {
        fieldId: 1,
        fieldName: "full_name",
        fieldLabel: "Full Name",
        fieldType: "text",
        value: "John Doe",
        options: null,
        isRequired: true,
        isImportant: true,
        category: "Summary",
        fieldGroup: "Default",
      },
      2: {
        fieldId: 2,
        fieldName: "email_address",
        fieldLabel: "Email Address",
        fieldType: "email",
        value: "john.doe@example.com",
        options: null,
        isRequired: true,
        isImportant: false,
        category: "Contact",
        fieldGroup: "Default",
      },
    },
    fieldsByCategory: {
      Summary: [
        {
          fieldId: 1,
          fieldName: "full_name",
          fieldLabel: "Full Name",
          fieldType: "text",
          value: "John Doe",
          category: "Summary",
          fieldGroup: "Default",
        },
      ],
      Contact: [
        {
          fieldId: 2,
          fieldName: "email_address",
          fieldLabel: "Email Address",
          fieldType: "email",
          value: "john.doe@example.com",
          category: "Contact",
          fieldGroup: "Default",
        },
      ],
      Professional: [
        {
          fieldId: 4,
          fieldName: "job_title",
          fieldLabel: "Job Title",
          fieldType: "text",
          value: "Sales Manager",
          category: "Professional",
          fieldGroup: "Default",
        },
      ],
    },
    fieldsByGroup: {
      Default: [
        // All fields in default group
      ],
    },
  },
};

// =====================================
// 7. UPDATE PERSON
// =====================================

// PUT /api/persons/1
const updatePersonRequest = {
  customFields: {
    full_name: "John Smith",
    job_title: "Senior Sales Manager",
    department: "Sales",
  },
};

const updatePersonResponse = {
  message: "Person updated successfully with custom fields.",
  personId: "1",
  customFields: [
    {
      fieldId: 1,
      fieldName: "full_name",
      fieldLabel: "Full Name",
      fieldType: "text",
      value: "John Smith",
      isRequired: true,
      isImportant: true,
    },
    {
      fieldId: 4,
      fieldName: "job_title",
      fieldLabel: "Job Title",
      fieldType: "text",
      value: "Senior Sales Manager",
      isRequired: false,
      isImportant: false,
    },
    {
      fieldId: 5,
      fieldName: "department",
      fieldLabel: "Department",
      fieldType: "select",
      value: "Sales",
      isRequired: false,
      isImportant: false,
    },
  ],
  totalFields: 3,
};

// =====================================
// 8. DELETE PERSON
// =====================================

// DELETE /api/persons/1
const deletePersonResponse = {
  message: "Person deleted successfully.",
  personId: "1",
};

// =====================================
// 9. GET ALL ORGANIZATIONS
// =====================================

// GET /api/organizations-new
const getAllOrganizationsResponse = {
  message: "Organizations retrieved successfully.",
  organizations: [
    {
      organizationId: 1,
      organization: "Acme Corporation",
      address: null,
      organizationLabels: null,
      createdAt: "2025-01-07T10:00:00.000Z",
      updatedAt: "2025-01-07T10:00:00.000Z",
      customFields: {
        company_name: {
          fieldId: 7,
          fieldName: "company_name",
          fieldLabel: "Company Name",
          fieldType: "text",
          value: "Acme Corporation",
          isRequired: true,
          isImportant: true,
        },
        industry: {
          fieldId: 8,
          fieldName: "industry",
          fieldLabel: "Industry",
          fieldType: "select",
          value: "Technology",
          isRequired: false,
          isImportant: false,
        },
        // ... other fields
      },
    },
  ],
  totalOrganizations: 1,
};

// =====================================
// 10. COMPLETE WORKFLOW EXAMPLE
// =====================================

// Step 1: Create custom fields for person
async function createPersonFields() {
  for (const field of personFields) {
    const response = await fetch("/api/custom-fields", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer your-token",
      },
      body: JSON.stringify(field),
    });
    console.log("Field created:", await response.json());
  }
}

// Step 2: Create a person with custom fields
async function createPerson() {
  const response = await fetch("/api/persons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer your-token",
    },
    body: JSON.stringify(createPersonRequest),
  });
  const result = await response.json();
  console.log("Person created:", result);
  return result.personId;
}

// Step 3: Retrieve the person
async function getPerson(personId) {
  const response = await fetch(`/api/persons/${personId}`, {
    headers: {
      Authorization: "Bearer your-token",
    },
  });
  const result = await response.json();
  console.log("Person retrieved:", result);
  return result;
}

// Step 4: Update the person
async function updatePerson(personId) {
  const response = await fetch(`/api/persons/${personId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer your-token",
    },
    body: JSON.stringify(updatePersonRequest),
  });
  const result = await response.json();
  console.log("Person updated:", result);
  return result;
}

// =====================================
// 11. ERROR HANDLING EXAMPLES
// =====================================

// Validation Error Response
const validationErrorResponse = {
  message: "Validation errors occurred.",
  errors: [
    'Field "Full Name" is required.',
    'Invalid email format for field "Email Address".',
  ],
};

// Not Found Error Response
const notFoundErrorResponse = {
  message: "Person not found.",
};

// Server Error Response
const serverErrorResponse = {
  message: "Failed to create person with custom fields.",
  error: "Database connection failed",
};

module.exports = {
  personFields,
  organizationFields,
  createPersonRequest,
  createPersonResponse,
  createOrganizationRequest,
  createOrganizationResponse,
  getAllPersonsResponse,
  getPersonResponse,
  updatePersonRequest,
  updatePersonResponse,
  deletePersonResponse,
  getAllOrganizationsResponse,
  validationErrorResponse,
  notFoundErrorResponse,
  serverErrorResponse,
};
