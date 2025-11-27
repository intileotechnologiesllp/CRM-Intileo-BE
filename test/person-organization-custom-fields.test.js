// TEST SCRIPT FOR PERSON AND ORGANIZATION CUSTOM FIELDS

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:3056/api";
const AUTH_TOKEN = "your-auth-token-here"; // Replace with actual token

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    "Content-Type": "application/json",
  },
});

// Test functions
async function testPersonCustomFields() {
  console.log("🧪 Testing Person Custom Fields...\n");

  try {
    // Step 1: Create custom fields for person
    console.log("📝 Creating custom fields for Person...");
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
    ];

    for (const field of personFields) {
      try {
        const response = await api.post("/custom-fields", field);
        console.log(`✅ Created field: ${field.fieldLabel}`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`⚠️  Field already exists: ${field.fieldLabel}`);
        } else {
          console.log(
            `❌ Error creating field ${field.fieldLabel}:`,
            error.response?.data || error.message
          );
        }
      }
    }

    // Step 2: Create a person with custom fields
    console.log("\n👤 Creating a person with custom fields...");
    const personData = {
      customFields: {
        full_name: "John Doe",
        email_address: "john.doe@example.com",
        phone_number: "+1-555-123-4567",
        job_title: "Sales Manager",
      },
    };

    const createPersonResponse = await api.post("/persons", personData);
    const personId = createPersonResponse.data.personId;
    console.log("✅ Person created with ID:", personId);
    console.log(
      "📊 Custom fields saved:",
      createPersonResponse.data.totalFields
    );

    // Step 3: Retrieve the person
    console.log("\n🔍 Retrieving the person...");
    const getPersonResponse = await api.get(`/persons/${personId}`);
    console.log("✅ Person retrieved successfully");
    console.log(
      "📋 Categories:",
      Object.keys(getPersonResponse.data.customFields.fieldsByCategory)
    );

    // Step 4: Update the person
    console.log("\n✏️  Updating the person...");
    const updateData = {
      customFields: {
        full_name: "John Smith",
        job_title: "Senior Sales Manager",
      },
    };

    const updatePersonResponse = await api.put(
      `/persons/${personId}`,
      updateData
    );
    console.log("✅ Person updated successfully");
    console.log("📊 Fields updated:", updatePersonResponse.data.totalFields);

    // Step 5: Get all persons
    console.log("\n📋 Getting all persons...");
    const getAllPersonsResponse = await api.get("/persons");
    console.log("✅ Retrieved all persons");
    console.log("👥 Total persons:", getAllPersonsResponse.data.totalPersons);

    console.log("\n🎉 Person custom fields test completed successfully!");
    return personId;
  } catch (error) {
    console.error(
      "❌ Person test failed:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function testOrganizationCustomFields() {
  console.log("\n🧪 Testing Organization Custom Fields...\n");

  try {
    // Step 1: Create custom fields for organization
    console.log("📝 Creating custom fields for Organization...");
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
    ];

    for (const field of organizationFields) {
      try {
        const response = await api.post("/custom-fields", field);
        console.log(`✅ Created field: ${field.fieldLabel}`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`⚠️  Field already exists: ${field.fieldLabel}`);
        } else {
          console.log(
            `❌ Error creating field ${field.fieldLabel}:`,
            error.response?.data || error.message
          );
        }
      }
    }

    // Step 2: Create an organization with custom fields
    console.log("\n🏢 Creating an organization with custom fields...");
    const organizationData = {
      customFields: {
        company_name: "Acme Corporation",
        industry: "Technology",
        company_size: "51-200",
        annual_revenue: 5000000,
      },
    };

    const createOrgResponse = await api.post(
      "/organizations-new",
      organizationData
    );
    const organizationId = createOrgResponse.data.organizationId;
    console.log("✅ Organization created with ID:", organizationId);
    console.log("📊 Custom fields saved:", createOrgResponse.data.totalFields);

    // Step 3: Retrieve the organization
    console.log("\n🔍 Retrieving the organization...");
    const getOrgResponse = await api.get(
      `/organizations-new/${organizationId}`
    );
    console.log("✅ Organization retrieved successfully");
    console.log(
      "📋 Categories:",
      Object.keys(getOrgResponse.data.customFields.fieldsByCategory)
    );

    // Step 4: Update the organization
    console.log("\n✏️  Updating the organization...");
    const updateData = {
      customFields: {
        company_name: "Acme Technologies Inc.",
        annual_revenue: 6000000,
      },
    };

    const updateOrgResponse = await api.put(
      `/organizations-new/${organizationId}`,
      updateData
    );
    console.log("✅ Organization updated successfully");
    console.log("📊 Fields updated:", updateOrgResponse.data.totalFields);

    // Step 5: Get all organizations
    console.log("\n📋 Getting all organizations...");
    const getAllOrgsResponse = await api.get("/organizations-new");
    console.log("✅ Retrieved all organizations");
    console.log(
      "🏢 Total organizations:",
      getAllOrgsResponse.data.totalOrganizations
    );

    console.log("\n🎉 Organization custom fields test completed successfully!");
    return organizationId;
  } catch (error) {
    console.error(
      "❌ Organization test failed:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function testCustomFieldsAPI() {
  console.log("\n🧪 Testing Custom Fields API...\n");

  try {
    // Test getting custom fields for person
    console.log("📋 Getting custom fields for Person...");
    const personFieldsResponse = await api.get(
      "/custom-fields?entityType=person"
    );
    console.log("✅ Person custom fields retrieved");
    console.log("📊 Total fields:", personFieldsResponse.data.fields.length);

    // Test getting custom fields for organization
    console.log("\n📋 Getting custom fields for Organization...");
    const orgFieldsResponse = await api.get(
      "/custom-fields?entityType=organization"
    );
    console.log("✅ Organization custom fields retrieved");
    console.log("📊 Total fields:", orgFieldsResponse.data.fields.length);

    // Test organized fields
    console.log("\n📋 Testing organized fields...");
    console.log("📊 Person field organization:", {
      summary: personFieldsResponse.data.fieldCounts.summary,
      ungrouped: personFieldsResponse.data.fieldCounts.ungroupedCustomFields,
      default: personFieldsResponse.data.fieldCounts.defaultFields,
      system: personFieldsResponse.data.fieldCounts.systemFields,
    });

    console.log("\n🎉 Custom Fields API test completed successfully!");
  } catch (error) {
    console.error(
      "❌ Custom Fields API test failed:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function runAllTests() {
  console.log("🚀 Starting Person and Organization Custom Fields Tests\n");
  console.log("=".repeat(60));

  try {
    // Test Person Custom Fields
    const personId = await testPersonCustomFields();

    // Test Organization Custom Fields
    const organizationId = await testOrganizationCustomFields();

    // Test Custom Fields API
    await testCustomFieldsAPI();

    console.log("\n" + "=".repeat(60));
    console.log("🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("✅ Person ID:", personId);
    console.log("✅ Organization ID:", organizationId);
    console.log("=".repeat(60));
  } catch (error) {
    console.log("\n" + "=".repeat(60));
    console.error("❌ TESTS FAILED!");
    console.error("Error:", error.message);
    console.log("=".repeat(60));
    process.exit(1);
  }
}

// Helper function to clean up test data
async function cleanupTestData() {
  console.log("\n🧹 Cleaning up test data...");

  try {
    // Get all persons and delete them
    const personsResponse = await api.get("/persons");
    for (const person of personsResponse.data.persons) {
      try {
        await api.delete(`/persons/${person.personId}`);
        console.log(`🗑️  Deleted person: ${person.personId}`);
      } catch (error) {
        console.log(
          `⚠️  Could not delete person ${person.personId}:`,
          error.response?.data || error.message
        );
      }
    }

    // Get all organizations and delete them
    const orgsResponse = await api.get("/organizations-new");
    for (const org of orgsResponse.data.organizations) {
      try {
        await api.delete(`/organizations-new/${org.organizationId}`);
        console.log(`🗑️  Deleted organization: ${org.organizationId}`);
      } catch (error) {
        console.log(
          `⚠️  Could not delete organization ${org.organizationId}:`,
          error.response?.data || error.message
        );
      }
    }

    console.log("✅ Cleanup completed");
  } catch (error) {
    console.error("❌ Cleanup failed:", error.response?.data || error.message);
  }
}

// Run tests
if (require.main === module) {
  // Check if cleanup flag is provided
  if (process.argv.includes("--cleanup")) {
    cleanupTestData();
  } else {
    runAllTests();
  }
}

module.exports = {
  testPersonCustomFields,
  testOrganizationCustomFields,
  testCustomFieldsAPI,
  runAllTests,
  cleanupTestData,
};
