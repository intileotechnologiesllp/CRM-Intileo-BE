const { sequelize } = require("./config/db");
const CustomField = require("./models/customFieldModel");
const CustomFieldValue = require("./models/customFieldValueModel");
const { Lead, Deal } = require("./models");

async function testCustomFields() {
  try {
    console.log("🚀 Testing Custom Fields functionality...\n");

    // Test 1: Create Custom Fields
    console.log("1. Creating custom fields...");

    const leadPriorityField = await CustomField.create({
      fieldName: "project_priority",
      fieldLabel: "Project Priority",
      fieldType: "select",
      entityType: "lead",
      options: ["High", "Medium", "Low"],
      category: "Summary",
      isRequired: true,
      isImportant: true,
      masterUserID: 1,
    });

    const leadBudgetField = await CustomField.create({
      fieldName: "project_budget",
      fieldLabel: "Project Budget",
      fieldType: "currency",
      entityType: "lead",
      category: "Financial",
      isRequired: false,
      isImportant: true,
      masterUserID: 1,
    });

    const dealSourceField = await CustomField.create({
      fieldName: "deal_source",
      fieldLabel: "Deal Source",
      fieldType: "select",
      entityType: "deal",
      options: ["Website", "Referral", "Cold Call", "Email Campaign"],
      category: "Details",
      isRequired: false,
      isImportant: false,
      masterUserID: 1,
    });

    console.log("✅ Custom fields created successfully");
    console.log(`   - Lead Priority Field ID: ${leadPriorityField.fieldId}`);
    console.log(`   - Lead Budget Field ID: ${leadBudgetField.fieldId}`);
    console.log(`   - Deal Source Field ID: ${dealSourceField.fieldId}\n`);

    // Test 2: Create Custom Field Values
    console.log("2. Creating custom field values...");

    // Assuming we have a lead with ID 1 and deal with ID 1
    const leadId = 1;
    const dealId = 1;

    const leadPriorityValue = await CustomFieldValue.create({
      fieldId: leadPriorityField.fieldId,
      entityId: leadId,
      entityType: "lead",
      value: "High",
      masterUserID: 1,
    });

    const leadBudgetValue = await CustomFieldValue.create({
      fieldId: leadBudgetField.fieldId,
      entityId: leadId,
      entityType: "lead",
      value: "50000",
      masterUserID: 1,
    });

    const dealSourceValue = await CustomFieldValue.create({
      fieldId: dealSourceField.fieldId,
      entityId: dealId,
      entityType: "deal",
      value: "Website",
      masterUserID: 1,
    });

    console.log("✅ Custom field values created successfully");
    console.log(`   - Lead Priority Value ID: ${leadPriorityValue.valueId}`);
    console.log(`   - Lead Budget Value ID: ${leadBudgetValue.valueId}`);
    console.log(`   - Deal Source Value ID: ${dealSourceValue.valueId}\n`);

    // Test 3: Retrieve Custom Fields
    console.log("3. Retrieving custom fields...");

    const leadFields = await CustomField.findAll({
      where: { entityType: "lead", masterUserID: 1 },
      order: [
        ["category", "ASC"],
        ["displayOrder", "ASC"],
      ],
    });

    console.log("✅ Lead custom fields retrieved:");
    leadFields.forEach((field) => {
      console.log(
        `   - ${field.fieldLabel} (${field.fieldType}) - Category: ${field.category}`
      );
    });

    const dealFields = await CustomField.findAll({
      where: { entityType: "deal", masterUserID: 1 },
      order: [
        ["category", "ASC"],
        ["displayOrder", "ASC"],
      ],
    });

    console.log("✅ Deal custom fields retrieved:");
    dealFields.forEach((field) => {
      console.log(
        `   - ${field.fieldLabel} (${field.fieldType}) - Category: ${field.category}`
      );
    });
    console.log("");

    // Test 4: Retrieve Custom Field Values with Field Info
    console.log("4. Retrieving custom field values with field info...");

    const leadCustomFieldValues = await CustomFieldValue.findAll({
      where: { entityType: "lead", entityId: leadId, masterUserID: 1 },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          attributes: [
            "fieldId",
            "fieldName",
            "fieldLabel",
            "fieldType",
            "options",
          ],
        },
      ],
    });

    console.log("✅ Lead custom field values with field info:");
    leadCustomFieldValues.forEach((value) => {
      console.log(`   - ${value.CustomField.fieldLabel}: ${value.value}`);
    });

    const dealCustomFieldValues = await CustomFieldValue.findAll({
      where: { entityType: "deal", entityId: dealId, masterUserID: 1 },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          attributes: [
            "fieldId",
            "fieldName",
            "fieldLabel",
            "fieldType",
            "options",
          ],
        },
      ],
    });

    console.log("✅ Deal custom field values with field info:");
    dealCustomFieldValues.forEach((value) => {
      console.log(`   - ${value.CustomField.fieldLabel}: ${value.value}`);
    });
    console.log("");

    // Test 5: Update Custom Field Values
    console.log("5. Updating custom field values...");

    await leadBudgetValue.update({ value: "75000" });
    await dealSourceValue.update({ value: "Referral" });

    console.log("✅ Custom field values updated successfully");
    console.log(`   - Lead Budget updated to: 75000`);
    console.log(`   - Deal Source updated to: Referral\n`);

    // Test 6: Field Statistics
    console.log("6. Calculating field statistics...");

    const fieldStats = await CustomField.findAll({
      where: { masterUserID: 1 },
      include: [
        {
          model: CustomFieldValue,
          as: "values",
          required: false,
          attributes: ["entityId", "value"],
        },
      ],
    });

    console.log("✅ Field statistics:");
    fieldStats.forEach((field) => {
      const values = field.values || [];
      const filledValues = values.filter(
        (v) => v.value !== null && v.value !== ""
      ).length;
      const usage =
        values.length > 0
          ? Math.round((filledValues / values.length) * 100)
          : 0;

      console.log(
        `   - ${field.fieldLabel} (${field.entityType}): ${filledValues}/${values.length} filled (${usage}% usage)`
      );
    });

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Error details:", error.message);
  }
}

// Run the test
if (require.main === module) {
  testCustomFields()
    .then(() => {
      console.log("\n✅ Custom Fields test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Test failed:", error);
      process.exit(1);
    });
}

module.exports = testCustomFields;
