// Test helper function to demonstrate the structure
function testExtractDefaultFieldsFromModel() {
  console.log("Testing extractDefaultFieldsFromModel...");

  // Mock Deal model attributes
  const mockDealAttributes = {
    id: { type: { key: "INTEGER" } },
    title: { type: { key: "STRING" } },
    value: { type: { key: "DECIMAL" } },
    currency: { type: { key: "STRING" } },
    expectedCloseDate: { type: { key: "DATE" } },
    status: { type: { key: "STRING" } },
    probability: { type: { key: "INTEGER" } },
    lostReason: { type: { key: "STRING" } },
    owner: { type: { key: "STRING" } },
    createdAt: { type: { key: "DATE" } },
    updatedAt: { type: { key: "DATE" } },
    deletedAt: { type: { key: "DATE" } },
  };

  // Mock Lead model attributes
  const mockLeadAttributes = {
    id: { type: { key: "INTEGER" } },
    title: { type: { key: "STRING" } },
    personName: { type: { key: "STRING" } },
    organizationName: { type: { key: "STRING" } },
    email: { type: { key: "STRING" } },
    phone: { type: { key: "STRING" } },
    value: { type: { key: "DECIMAL" } },
    currency: { type: { key: "STRING" } },
    expectedCloseDate: { type: { key: "DATE" } },
    status: { type: { key: "STRING" } },
    source: { type: { key: "STRING" } },
    createdAt: { type: { key: "DATE" } },
    updatedAt: { type: { key: "DATE" } },
    deletedAt: { type: { key: "DATE" } },
  };

  // Helper function to simulate extractDefaultFieldsFromModel
  function extractDefaultFieldsFromModel(rawAttributes, entityType) {
    const typeMapping = {
      INTEGER: "number",
      DECIMAL: "decimal",
      DOUBLE: "decimal",
      FLOAT: "decimal",
      STRING: "text",
      TEXT: "textarea",
      DATE: "date",
      DATEONLY: "date",
      BOOLEAN: "checkbox",
      ENUM: "select",
      JSON: "textarea",
    };

    const excludedFields = [
      "id",
      "createdAt",
      "updatedAt",
      "deletedAt",
      "masterUserID",
    ];

    return Object.keys(rawAttributes)
      .filter((fieldName) => !excludedFields.includes(fieldName))
      .map((fieldName) => {
        const attribute = rawAttributes[fieldName];
        const sequelizeType = attribute.type.key;
        const uiType = typeMapping[sequelizeType] || "text";

        // Convert camelCase to readable label
        const label = fieldName
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());

        return {
          fieldName,
          fieldLabel: label,
          fieldType: uiType,
          dbColumn: fieldName,
          isRequired: !attribute.allowNull,
          entityType: entityType,
        };
      });
  }

  // Test with Deal model
  console.log("\\nDeal Default Fields:");
  const dealFields = extractDefaultFieldsFromModel(mockDealAttributes, "deals");
  console.log(JSON.stringify(dealFields, null, 2));

  // Test with Lead model
  console.log("\\nLead Default Fields:");
  const leadFields = extractDefaultFieldsFromModel(mockLeadAttributes, "leads");
  console.log(JSON.stringify(leadFields, null, 2));

  // Test organized response structure
  console.log("\\nOrganized Response Structure:");
  const organizedFields = {
    defaultFields: [...dealFields, ...leadFields],
    summary: [],
    ungroupedCustomFields: [],
    customGroups: {},
  };

  const fieldCounts = {
    defaultFields: dealFields.length + leadFields.length,
    customFields: 0,
    summary: 0,
    ungroupedCustomFields: 0,
    customGroups: 0,
  };

  console.log("organizedFields:", JSON.stringify(organizedFields, null, 2));
  console.log("fieldCounts:", JSON.stringify(fieldCounts, null, 2));
}

testExtractDefaultFieldsFromModel();
