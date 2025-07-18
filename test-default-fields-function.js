// Test the getDefaultFields function directly
const fs = require("fs");
const path = require("path");

// Read the controller file and extract the getDefaultFields function
const controllerContent = fs.readFileSync(
  path.join(__dirname, "controllers", "customFieldController.js"),
  "utf8"
);

// Simple test to verify the function exists and works
console.log("Testing getDefaultFields function...");

// Extract and evaluate the function
const functionMatch = controllerContent.match(
  /const getDefaultFields = \(entityType\) => \{[\s\S]*?\n\};/
);
if (functionMatch) {
  console.log("✓ getDefaultFields function found in controller");

  // Evaluate the function
  eval(functionMatch[0]);

  // Test with leads
  const leadFields = getDefaultFields("leads");
  console.log("\\nLead Default Fields:");
  console.log(`Found ${leadFields.length} default fields for leads:`);
  leadFields.forEach((field, index) => {
    console.log(`${index + 1}. ${field.fieldLabel} (${field.fieldType})`);
  });

  // Test with deals
  const dealFields = getDefaultFields("deals");
  console.log("\\nDeal Default Fields:");
  console.log(`Found ${dealFields.length} default fields for deals:`);
  dealFields.forEach((field, index) => {
    console.log(`${index + 1}. ${field.fieldLabel} (${field.fieldType})`);
  });

  // Show complete structure for first field
  console.log("\\nComplete structure of first field:");
  console.log(JSON.stringify(leadFields[0], null, 2));
} else {
  console.log("✗ getDefaultFields function not found in controller");
}
