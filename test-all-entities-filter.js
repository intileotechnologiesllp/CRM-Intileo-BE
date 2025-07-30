const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:3000";
const AUTH_TOKEN = "your-auth-token"; // Replace with actual token

// Test cases for different entity filters
const testCases = [
  {
    name: "Lead Entity Organization Filter",
    filter: {
      all: [
        {
          entity: "lead",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
      ],
    },
  },
  {
    name: "Activity Entity Organization Filter",
    filter: {
      all: [
        {
          entity: "activity",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
      ],
    },
  },
  {
    name: "Person Entity Organization Filter",
    filter: {
      all: [
        {
          entity: "person",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
      ],
    },
  },
  {
    name: "Deal Entity Organization Filter",
    filter: {
      all: [
        {
          entity: "deal",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
      ],
    },
  },
  {
    name: "Organization Entity Direct Filter",
    filter: {
      all: [
        {
          entity: "organization",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
      ],
    },
  },
  {
    name: "Multiple Entity Filters (Lead + Person)",
    filter: {
      all: [
        {
          entity: "lead",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
        {
          entity: "person",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
      ],
    },
  },
  {
    name: "Mixed Entity Filters with OR Logic",
    filter: {
      any: [
        {
          entity: "deal",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
        {
          entity: "activity",
          field: "organization",
          operator: "is",
          value: "tcs",
        },
      ],
    },
  },
];

async function testEntityFilter(testCase) {
  console.log(`\n=== Testing: ${testCase.name} ===`);
  console.log("Filter config:", JSON.stringify(testCase.filter, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/api/leads/organizations-and-persons`,
      {
        filterId: testCase.filter,
      },
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Status:", response.status);
    console.log("📊 Results:", {
      totalRecords: response.data.totalRecords,
      organizationsFound: response.data.organizations?.length || 0,
      sampleOrgs:
        response.data.organizations?.slice(0, 3).map((o) => ({
          id: o.leadOrganizationId,
          name: o.organization,
        })) || [],
    });

    if (response.data.organizations?.length > 0) {
      console.log("🎯 Filter working correctly!");
    } else {
      console.log("⚠️ No results found - check if data exists or filter logic");
    }
  } catch (error) {
    console.log(
      "❌ Error:",
      error.response?.status,
      error.response?.data?.message || error.message
    );
  }
}

async function runAllTests() {
  console.log(
    "🚀 Starting Entity Filter Tests for getOrganizationsAndPersons API"
  );
  console.log(
    "Testing Lead, Activity, Person, Deal, and Organization entity filters...\n"
  );

  for (const testCase of testCases) {
    await testEntityFilter(testCase);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay between tests
  }

  console.log("\n✨ All tests completed!");
}

runAllTests().catch(console.error);
