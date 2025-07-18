const { getCustomFields } = require("./controllers/customFieldController");

// Mock request and response objects
const mockReq = {
  query: {
    entityType: "leads",
    includeDefaults: "true",
  },
};

const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log("Status:", code);
      console.log("Response:", JSON.stringify(data, null, 2));
    },
  }),
};

// Test the function
console.log("Testing getCustomFields with default fields...");
getCustomFields(mockReq, mockRes);
