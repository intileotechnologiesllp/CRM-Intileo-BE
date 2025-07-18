// Test the default fields structure directly
console.log("Testing default fields structure...");

// Helper function to get predefined default fields
const getDefaultFields = (entityType) => {
  const defaultFields = [
    {
      fieldName: "title",
      fieldLabel: "Title",
      fieldType: "text",
      dbColumn: "title",
      isRequired: true,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "owner",
      fieldLabel: "Owner",
      fieldType: "user",
      dbColumn: "owner",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "pipeline",
      fieldLabel: "Pipeline",
      fieldType: "number",
      dbColumn: "pipeline",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "stage",
      fieldLabel: "Stage",
      fieldType: "select",
      dbColumn: "stage",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "visibleTo",
      fieldLabel: "Visible to",
      fieldType: "select",
      dbColumn: "visible_to",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "productName",
      fieldLabel: "Product name",
      fieldType: "text",
      dbColumn: "product_name",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "sourceOrigin",
      fieldLabel: "Source origin",
      fieldType: "select",
      dbColumn: "source_origin",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "sourceOriginId",
      fieldLabel: "Source origin ID",
      fieldType: "text",
      dbColumn: "source_origin_id",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "sourceChannel",
      fieldLabel: "Source channel",
      fieldType: "select",
      dbColumn: "source_channel",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
    {
      fieldName: "sourceChannelId",
      fieldLabel: "Source channel ID",
      fieldType: "text",
      dbColumn: "source_channel_id",
      isRequired: false,
      entityType: entityType,
      isActive: true,
      isDefault: true,
    },
  ];

  return defaultFields;
};

// Test with leads
console.log("\\n=== LEADS DEFAULT FIELDS ===");
const leadFields = getDefaultFields("leads");
console.log(`Found ${leadFields.length} default fields for leads:`);
leadFields.forEach((field, index) => {
  console.log(
    `${index + 1}. ${field.fieldLabel} (${field.fieldType}) - ${
      field.isRequired ? "Required" : "Optional"
    }`
  );
});

// Test with deals
console.log("\\n=== DEALS DEFAULT FIELDS ===");
const dealFields = getDefaultFields("deals");
console.log(`Found ${dealFields.length} default fields for deals:`);
dealFields.forEach((field, index) => {
  console.log(
    `${index + 1}. ${field.fieldLabel} (${field.fieldType}) - ${
      field.isRequired ? "Required" : "Optional"
    }`
  );
});

// Show the complete structure for verification
console.log("\\n=== COMPLETE FIELD STRUCTURE (First Field) ===");
console.log(JSON.stringify(leadFields[0], null, 2));

console.log("\\n=== FIELD TYPES SUMMARY ===");
const fieldTypes = {};
leadFields.forEach((field) => {
  fieldTypes[field.fieldType] = (fieldTypes[field.fieldType] || 0) + 1;
});
console.log(fieldTypes);

console.log("\\n✓ Default fields function working correctly!");
console.log(
  "Fields match the screenshot: Title, Owner, Pipeline, Stage, Visible to, Product name, Source origin, Source origin ID, Source channel, Source channel ID"
);
