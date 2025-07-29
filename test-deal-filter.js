const express = require("express");
const app = express();
app.use(express.json());

// Import the controller
const {
  getPersonsAndOrganizations,
} = require("./controllers/leads/leadContactController");

// Create a test request with Deal filter
const testRequest = {
  role: "admin", // Set as admin to avoid role restrictions
  adminId: 1,
  body: {
    filterId: {
      all: [
        {
          entity: "Deal",
          field: "title",
          operator: "is",
          value: "Updated Lead Title",
        },
      ],
    },
  },
  query: {},
};

const testResponse = {
  status: (code) => ({
    json: (data) => {
      console.log("\n=== RESPONSE ===");
      console.log("Status:", code);
      console.log("Data:", JSON.stringify(data, null, 2));
    },
  }),
};

console.log(
  "Testing Deal filter with:",
  JSON.stringify(testRequest.body.filterId, null, 2)
);

// Run the test
getPersonsAndOrganizations(testRequest, testResponse).catch((err) => {
  console.error("Test failed:", err);
});
