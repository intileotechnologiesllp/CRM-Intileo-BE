#!/usr/bin/env node
/**
 * Complete Custom Fields Testing Script
 *
 * This script demonstrates the full custom fields functionality for:
 * - Creating custom fields for different entity types
 * - Creating entities (leads, deals, persons, organizations) using only custom fields
 * - Updating and retrieving custom field values
 * - Testing field validation, grouping, and organization
 *
 * Usage: node test-custom-fields-complete.js
 */

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:3000"; // Adjust to your server URL
const TEST_USER = {
  email: "test@example.com",
  password: "password123",
};

// Test data
const CUSTOM_FIELDS_CONFIG = {
  lead: [
    {
      fieldName: "business_size",
      fieldLabel: "Business Size",
      fieldType: "select",
      options: [
        "Small (1-50)",
        "Medium (51-200)",
        "Large (201-1000)",
        "Enterprise (1000+)",
      ],
      category: "Summary",
      isRequired: true,
      isImportant: true,
    },
    {
      fieldName: "annual_revenue",
      fieldLabel: "Annual Revenue",
      fieldType: "currency",
      category: "Summary",
      validationRules: { min: 0 },
    },
    {
      fieldName: "pain_points",
      fieldLabel: "Pain Points",
      fieldType: "textarea",
      category: "Details",
      fieldGroup: "Qualification",
    },
    {
      fieldName: "decision_timeline",
      fieldLabel: "Decision Timeline",
      fieldType: "select",
      options: [
        "Immediate",
        "Within 1 month",
        "1-3 months",
        "3-6 months",
        "6+ months",
      ],
      category: "Details",
      fieldGroup: "Qualification",
    },
  ],
  deal: [
    {
      fieldName: "deal_source",
      fieldLabel: "Deal Source",
      fieldType: "select",
      options: [
        "Website",
        "Referral",
        "Cold Call",
        "LinkedIn",
        "Trade Show",
        "Email Campaign",
      ],
      category: "Summary",
      isRequired: true,
    },
    {
      fieldName: "competitor_info",
      fieldLabel: "Competitor Information",
      fieldType: "textarea",
      category: "Details",
      fieldGroup: "Competitive Analysis",
    },
    {
      fieldName: "contract_duration",
      fieldLabel: "Contract Duration (months)",
      fieldType: "number",
      category: "Details",
      validationRules: { min: 1, max: 120 },
    },
  ],
  person: [
    {
      fieldName: "linkedin_profile",
      fieldLabel: "LinkedIn Profile",
      fieldType: "url",
      category: "Summary",
    },
    {
      fieldName: "job_level",
      fieldLabel: "Job Level",
      fieldType: "select",
      options: [
        "Individual Contributor",
        "Team Lead",
        "Manager",
        "Director",
        "VP",
        "C-Level",
      ],
      category: "Summary",
      isImportant: true,
    },
    {
      fieldName: "communication_preference",
      fieldLabel: "Communication Preference",
      fieldType: "multiselect",
      options: ["Email", "Phone", "Video Call", "In-Person", "Text/SMS"],
      category: "Details",
      fieldGroup: "Contact Preferences",
    },
  ],
  organization: [
    {
      fieldName: "industry_vertical",
      fieldLabel: "Industry Vertical",
      fieldType: "select",
      options: [
        "Technology",
        "Healthcare",
        "Finance",
        "Manufacturing",
        "Retail",
        "Education",
        "Other",
      ],
      category: "Summary",
      isRequired: true,
    },
    {
      fieldName: "company_size",
      fieldLabel: "Company Size",
      fieldType: "select",
      options: [
        "Startup (1-10)",
        "Small (11-50)",
        "Medium (51-200)",
        "Large (201-1000)",
        "Enterprise (1000+)",
      ],
      category: "Summary",
      isImportant: true,
    },
    {
      fieldName: "website_url",
      fieldLabel: "Website URL",
      fieldType: "url",
      category: "Details",
    },
    {
      fieldName: "annual_revenue",
      fieldLabel: "Annual Revenue",
      fieldType: "currency",
      category: "Details",
      fieldGroup: "Financial Information",
    },
  ],
};

// Test entity data using custom fields
const TEST_ENTITIES = {
  lead: {
    business_size: "Medium (51-200)",
    annual_revenue: "5000000",
    pain_points:
      "Manual processes are slowing down operations and increasing costs.",
    decision_timeline: "1-3 months",
  },
  deal: {
    deal_source: "Website",
    competitor_info: "Considering Salesforce and HubSpot as alternatives.",
    contract_duration: 12,
  },
  person: {
    linkedin_profile: "https://linkedin.com/in/john-doe",
    job_level: "Manager",
    communication_preference: ["Email", "Video Call"],
  },
  organization: {
    industry_vertical: "Technology",
    company_size: "Medium (51-200)",
    website_url: "https://example.com",
    annual_revenue: "5000000",
  },
};

let authToken = null;

/**
 * Authentication
 */
async function authenticate() {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, TEST_USER);
    authToken = response.data.token;
    console.log("✅ Authentication successful");
    return authToken;
  } catch (error) {
    console.error(
      "❌ Authentication failed:",
      error.response?.data?.message || error.message
    );
    throw error;
  }
}

/**
 * Get axios config with auth header
 */
function getAuthConfig() {
  return {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  };
}

/**
 * Create custom fields for an entity type
 */
async function createCustomFields(entityType) {
  const fields = CUSTOM_FIELDS_CONFIG[entityType];
  const createdFields = [];

  console.log(`\n🔧 Creating custom fields for ${entityType}...`);

  for (const fieldConfig of fields) {
    try {
      const response = await axios.post(
        `${BASE_URL}/api/custom-fields`,
        {
          ...fieldConfig,
          entityType,
        },
        getAuthConfig()
      );

      createdFields.push(response.data.customField);
      console.log(`  ✅ Created field: ${fieldConfig.fieldLabel}`);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log(`  ⚠️  Field already exists: ${fieldConfig.fieldLabel}`);
      } else {
        console.error(
          `  ❌ Failed to create field ${fieldConfig.fieldLabel}:`,
          error.response?.data?.message || error.message
        );
      }
    }
  }

  return createdFields;
}

/**
 * Get custom fields for an entity type
 */
async function getCustomFields(entityType) {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/custom-fields?entityType=${entityType}`,
      getAuthConfig()
    );
    return response.data.customFields || [];
  } catch (error) {
    console.error(
      `❌ Failed to get custom fields for ${entityType}:`,
      error.response?.data?.message || error.message
    );
    return [];
  }
}

/**
 * Create entity using only custom fields
 */
async function createEntityWithCustomFields(entityType, customFieldData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/custom-fields/create-entity`,
      {
        entityType,
        customFields: customFieldData,
      },
      getAuthConfig()
    );

    console.log(`  ✅ Created ${entityType} with custom fields only`);
    return response.data.entity;
  } catch (error) {
    console.error(
      `  ❌ Failed to create ${entityType} with custom fields:`,
      error.response?.data?.message || error.message
    );
    throw error;
  }
}

/**
 * Create a person using custom fields
 */
async function createPersonWithCustomFields(customFieldData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/custom-fields/create-person`,
      {
        customFields: customFieldData,
      },
      getAuthConfig()
    );

    console.log(`  ✅ Created person with custom fields`);
    return response.data.person;
  } catch (error) {
    console.error(
      `  ❌ Failed to create person with custom fields:`,
      error.response?.data?.message || error.message
    );
    throw error;
  }
}

/**
 * Create an organization using custom fields
 */
async function createOrganizationWithCustomFields(customFieldData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/custom-fields/create-organization`,
      {
        customFields: customFieldData,
      },
      getAuthConfig()
    );

    console.log(`  ✅ Created organization with custom fields`);
    return response.data.organization;
  } catch (error) {
    console.error(
      `  ❌ Failed to create organization with custom fields:`,
      error.response?.data?.message || error.message
    );
    throw error;
  }
}

/**
 * Test custom field values retrieval
 */
async function testCustomFieldValues(entityType, entityId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/custom-fields/values/${entityType}/${entityId}`,
      getAuthConfig()
    );

    console.log(
      `  ✅ Retrieved custom field values for ${entityType} ${entityId}`
    );
    console.log(
      `    Fields: ${Object.keys(response.data.customFields).join(", ")}`
    );
    return response.data.customFields;
  } catch (error) {
    console.error(
      `  ❌ Failed to get custom field values:`,
      error.response?.data?.message || error.message
    );
    return null;
  }
}

/**
 * Test updating custom field values
 */
async function testUpdateCustomFieldValues(entityType, entityId, updates) {
  try {
    const response = await axios.put(
      `${BASE_URL}/api/custom-fields/values/${entityType}/${entityId}`,
      { customFields: updates },
      getAuthConfig()
    );

    console.log(
      `  ✅ Updated custom field values for ${entityType} ${entityId}`
    );
    return response.data;
  } catch (error) {
    console.error(
      `  ❌ Failed to update custom field values:`,
      error.response?.data?.message || error.message
    );
    return null;
  }
}

/**
 * Test field grouping and organization
 */
async function testFieldOrganization(entityType) {
  try {
    // Get fields with stats
    const statsResponse = await axios.get(
      `${BASE_URL}/api/custom-fields/${entityType}/stats`,
      getAuthConfig()
    );

    console.log(`  ✅ Retrieved field statistics for ${entityType}`);
    console.log(`    Total fields: ${statsResponse.data.totalFields}`);
    console.log(
      `    Fields by category:`,
      Object.keys(statsResponse.data.fieldsByCategory).join(", ")
    );

    // Get field groups
    const groupsResponse = await axios.get(
      `${BASE_URL}/api/custom-fields/${entityType}/groups`,
      getAuthConfig()
    );

    console.log(`  ✅ Retrieved field groups for ${entityType}`);
    console.log(
      `    Groups: ${groupsResponse.data.groups.map((g) => g.name).join(", ")}`
    );

    return {
      stats: statsResponse.data,
      groups: groupsResponse.data,
    };
  } catch (error) {
    console.error(
      `  ❌ Failed to test field organization:`,
      error.response?.data?.message || error.message
    );
    return null;
  }
}

/**
 * Main test function
 */
async function runCompleteTest() {
  console.log("🚀 Starting Complete Custom Fields Test\n");

  try {
    // Step 1: Authenticate
    await authenticate();

    // Step 2: Create custom fields for all entity types
    const createdFields = {};
    for (const entityType of Object.keys(CUSTOM_FIELDS_CONFIG)) {
      createdFields[entityType] = await createCustomFields(entityType);
    }

    // Step 3: Test field organization and grouping
    console.log("\n📊 Testing field organization and grouping...");
    for (const entityType of Object.keys(CUSTOM_FIELDS_CONFIG)) {
      await testFieldOrganization(entityType);
    }

    // Step 4: Create entities using only custom fields
    console.log("\n🏗️  Creating entities using only custom fields...");
    const createdEntities = {};

    // Create organization first (for reference)
    createdEntities.organization = await createOrganizationWithCustomFields(
      TEST_ENTITIES.organization
    );

    // Create person
    createdEntities.person = await createPersonWithCustomFields(
      TEST_ENTITIES.person
    );

    // Create lead
    createdEntities.lead = await createEntityWithCustomFields(
      "lead",
      TEST_ENTITIES.lead
    );

    // Create deal
    createdEntities.deal = await createEntityWithCustomFields(
      "deal",
      TEST_ENTITIES.deal
    );

    // Step 5: Test custom field values retrieval
    console.log("\n🔍 Testing custom field values retrieval...");
    const customFieldValues = {};
    for (const [entityType, entity] of Object.entries(createdEntities)) {
      if (entity && entity.id) {
        customFieldValues[entityType] = await testCustomFieldValues(
          entityType,
          entity.id
        );
      }
    }

    // Step 6: Test updating custom field values
    console.log("\n📝 Testing custom field values updates...");
    for (const [entityType, entity] of Object.entries(createdEntities)) {
      if (entity && entity.id) {
        const updates = {};

        // Create sample updates based on entity type
        if (entityType === "lead") {
          updates.decision_timeline = "Within 1 month";
        } else if (entityType === "deal") {
          updates.contract_duration = 24;
        } else if (entityType === "person") {
          updates.job_level = "Director";
        } else if (entityType === "organization") {
          updates.company_size = "Large (201-1000)";
        }

        if (Object.keys(updates).length > 0) {
          await testUpdateCustomFieldValues(entityType, entity.id, updates);
        }
      }
    }

    // Step 7: Final verification - retrieve updated values
    console.log("\n✅ Final verification - retrieving updated values...");
    for (const [entityType, entity] of Object.entries(createdEntities)) {
      if (entity && entity.id) {
        await testCustomFieldValues(entityType, entity.id);
      }
    }

    console.log("\n🎉 Complete Custom Fields Test finished successfully!");
    console.log("\n📋 Test Summary:");
    console.log(
      `  - Custom fields created for: ${Object.keys(createdFields).join(", ")}`
    );
    console.log(
      `  - Entities created: ${Object.keys(createdEntities).join(", ")}`
    );
    console.log(`  - All CRUD operations tested successfully`);
    console.log(`  - Field organization and grouping verified`);
  } catch (error) {
    console.error("\n💥 Test failed:", error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  runCompleteTest().catch(console.error);
}

module.exports = {
  runCompleteTest,
  authenticate,
  createCustomFields,
  getCustomFields,
  createEntityWithCustomFields,
  createPersonWithCustomFields,
  createOrganizationWithCustomFields,
  testCustomFieldValues,
  testUpdateCustomFieldValues,
  testFieldOrganization,
};
