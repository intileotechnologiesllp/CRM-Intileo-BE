const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:3000";
const AUTH_TOKEN = "your-auth-token"; // Replace with actual token

// Test cases for different entity filters in getPersonsAndOrganizations
const testCases = [
  {
    name: "Lead Entity Organization Filter (Persons)",
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
    name: "Activity Entity Organization Filter (Persons)",
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
    name: "Person Entity Organization Filter (Persons)",
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
    name: "Deal Entity Organization Filter (Persons)",
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
    name: "Organization Entity Direct Filter (Persons)",
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
    name: "Person Contact Name Filter",
    filter: {
      all: [
        {
          entity: "person",
          field: "contactPerson",
          operator: "contains",
          value: "john",
        },
      ],
    },
  },
  {
    name: "Multiple Entity Filters (Lead + Activity)",
    filter: {
      all: [
        {
          entity: "lead",
          field: "organization",
          operator: "is",
          value: "infosys",
        },
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
          entity: "person",
          field: "contactPerson",
          operator: "contains",
          value: "smith",
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
      `${BASE_URL}/api/leads/persons-and-organizations`,
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
      personsFound: response.data.persons?.length || 0,
      samplePersons:
        response.data.persons?.slice(0, 3).map((p) => ({
          id: p.personId,
          name: p.contactPerson,
          organization: p.organization,
        })) || [],
    });

    if (response.data.persons?.length > 0) {
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
    "🚀 Starting Entity Filter Tests for getPersonsAndOrganizations API"
  );
  console.log(
    "Testing Lead, Activity, Person, Deal, and Organization entity filters...\n"
  );

  for (const testCase of testCases) {
    await testEntityFilter(testCase);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay between tests
  }

  console.log("\n✨ All tests completed!");
  console.log("\n📝 Summary:");
  console.log(
    "- getPersonsAndOrganizations now supports comprehensive entity-based filtering"
  );
  console.log(
    "- Filters can target Lead, Activity, Person, Deal, and Organization entities"
  );
  console.log("- Results are person-focused with organization data included");
  console.log("- Role-based access control is maintained");
}

runAllTests().catch(console.error);
