// Test the updated default fields function
const { getCustomFields } = require("./controllers/customFieldController");

// Mock request and response objects
const mockReq = {
  query: {
    entityType: "leads",
    includeDefaults: "true",
  },
  adminId: 1,
};

const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log("Status:", code);
      console.log(
        "Default Fields:",
        JSON.stringify(data.organizedFields?.defaultFields || [], null, 2)
      );
      console.log(
        "Field Counts:",
        JSON.stringify(data.fieldCounts || {}, null, 2)
      );
    },
  }),
};

// Test the function
console.log("Testing getCustomFields with specific default fields...");
getCustomFields(mockReq, mockRes);
