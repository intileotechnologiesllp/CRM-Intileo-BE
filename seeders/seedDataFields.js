// Load environment variables first
require("dotenv").config();

const CustomField = require("../models/customFieldModel");
const { Op } = require("sequelize");

/**
 * Seed default and system fields for the unified field system
 * This creates fields that match Pipedrive's approach
 */
async function seedDataFields() {
  console.log("🌱 Seeding unified data fields...");

  try {
    // Default fields for both leads and deals (unified)
    const defaultFields = [
      {
        fieldName: "title",
        fieldLabel: "Title",
        fieldType: "text",
        fieldSource: "default",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "Default fields",
        isRequired: true,
        isImportant: true,
        displayOrder: 1,
        description: "The name/title of the lead or deal",
        masterUserID: 1, // System user ID
      },
      {
        fieldName: "value",
        fieldLabel: "Value",
        fieldType: "currency",
        fieldSource: "default",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "Default fields",
        isImportant: true,
        displayOrder: 2,
        description: "Expected or actual monetary value",
        masterUserID: 1,
      },
      {
        fieldName: "expectedCloseDate",
        fieldLabel: "Expected Close Date",
        fieldType: "date",
        fieldSource: "default",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "Default fields",
        displayOrder: 3,
        description: "When this lead/deal is expected to close",
        masterUserID: 1,
      },
      {
        fieldName: "probability",
        fieldLabel: "Probability",
        fieldType: "number",
        fieldSource: "default",
        entityType: "deal",
        category: "Default fields",
        displayOrder: 4,
        description: "Probability of closing this deal (%)",
        validationRules: { min: 0, max: 100 },
        masterUserID: 1,
      },
      {
        fieldName: "leadScore",
        fieldLabel: "Lead Score",
        fieldType: "number",
        fieldSource: "default",
        entityType: "lead",
        category: "Default fields",
        displayOrder: 5,
        description: "Qualification score for this lead",
        validationRules: { min: 0, max: 100 },
        masterUserID: 1,
      },
    ];

    // System fields (auto-generated, read-only)
    const systemFields = [
      {
        fieldName: "createdAt",
        fieldLabel: "Created",
        fieldType: "datetime",
        fieldSource: "system",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "System fields",
        isSystemField: true,
        displayOrder: 1,
        description: "When this record was created",
        masterUserID: 1,
      },
      {
        fieldName: "updatedAt",
        fieldLabel: "Last Modified",
        fieldType: "datetime",
        fieldSource: "system",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "System fields",
        isSystemField: true,
        displayOrder: 2,
        description: "When this record was last updated",
        masterUserID: 1,
      },
      {
        fieldName: "ownerId",
        fieldLabel: "Owner",
        fieldType: "person",
        fieldSource: "system",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "System fields",
        isSystemField: true,
        displayOrder: 3,
        description: "Who owns this record",
        masterUserID: 1,
      },
      {
        fieldName: "sourceChannel",
        fieldLabel: "Source",
        fieldType: "select",
        fieldSource: "system",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "System fields",
        isSystemField: true,
        displayOrder: 4,
        description: "How this lead/deal was acquired",
        options: [
          { value: "website", label: "Website" },
          { value: "email", label: "Email" },
          { value: "phone", label: "Phone" },
          { value: "referral", label: "Referral" },
          { value: "advertisement", label: "Advertisement" },
          { value: "social_media", label: "Social Media" },
          { value: "other", label: "Other" },
        ],
        masterUserID: 1,
      },
      {
        fieldName: "status",
        fieldLabel: "Status",
        fieldType: "select",
        fieldSource: "system",
        entityType: "both",
        entityScope: ["lead", "deal"],
        category: "System fields",
        isSystemField: true,
        displayOrder: 5,
        description: "Current status of the record",
        options: [
          { value: "active", label: "Active" },
          { value: "qualified", label: "Qualified" },
          { value: "unqualified", label: "Unqualified" },
          { value: "converted", label: "Converted" },
          { value: "closed", label: "Closed" },
        ],
        masterUserID: 1,
      },
    ];

    // Lead-specific fields
    const leadFields = [
      {
        fieldName: "leadQualificationStatus",
        fieldLabel: "Qualification Status",
        fieldType: "select",
        fieldSource: "default",
        entityType: "lead",
        category: "Default fields",
        displayOrder: 10,
        description: "Current qualification status of the lead",
        options: [
          { value: "new", label: "New" },
          { value: "contacted", label: "Contacted" },
          { value: "qualified", label: "Qualified" },
          { value: "unqualified", label: "Unqualified" },
          { value: "nurturing", label: "Nurturing" },
        ],
        masterUserID: 1,
      },
      {
        fieldName: "leadSource",
        fieldLabel: "Lead Source",
        fieldType: "select",
        fieldSource: "default",
        entityType: "lead",
        category: "Default fields",
        displayOrder: 11,
        description: "Original source of this lead",
        options: [
          { value: "organic_search", label: "Organic Search" },
          { value: "paid_search", label: "Paid Search" },
          { value: "social_media", label: "Social Media" },
          { value: "email_campaign", label: "Email Campaign" },
          { value: "referral", label: "Referral" },
          { value: "trade_show", label: "Trade Show" },
          { value: "webinar", label: "Webinar" },
          { value: "content_download", label: "Content Download" },
        ],
        masterUserID: 1,
      },
    ];

    // Deal-specific fields
    const dealFields = [
      {
        fieldName: "dealStage",
        fieldLabel: "Deal Stage",
        fieldType: "select",
        fieldSource: "default",
        entityType: "deal",
        category: "Default fields",
        isImportant: true,
        displayOrder: 10,
        description: "Current stage in the sales pipeline",
        options: [
          { value: "qualification", label: "Qualification" },
          { value: "needs_analysis", label: "Needs Analysis" },
          { value: "proposal", label: "Proposal" },
          { value: "negotiation", label: "Negotiation" },
          { value: "closed_won", label: "Closed Won" },
          { value: "closed_lost", label: "Closed Lost" },
        ],
        masterUserID: 1,
      },
      {
        fieldName: "pipeline",
        fieldLabel: "Pipeline",
        fieldType: "select",
        fieldSource: "default",
        entityType: "deal",
        category: "Default fields",
        displayOrder: 11,
        description: "Sales pipeline this deal belongs to",
        options: [
          { value: "sales", label: "Sales Pipeline" },
          { value: "partnerships", label: "Partnerships" },
          { value: "enterprise", label: "Enterprise Sales" },
        ],
        masterUserID: 1,
      },
      {
        fieldName: "lostReason",
        fieldLabel: "Lost Reason",
        fieldType: "select",
        fieldSource: "default",
        entityType: "deal",
        category: "Default fields",
        displayOrder: 12,
        description: "Reason why the deal was lost",
        options: [
          { value: "price", label: "Price" },
          { value: "competitor", label: "Competitor" },
          { value: "no_budget", label: "No Budget" },
          { value: "timing", label: "Timing" },
          { value: "not_interested", label: "Not Interested" },
          { value: "other", label: "Other" },
        ],
        masterUserID: 1,
      },
    ];

    // Combine all fields
    const allFields = [
      ...defaultFields,
      ...systemFields,
      ...leadFields,
      ...dealFields,
    ];

    // Insert fields, avoiding duplicates
    for (const fieldData of allFields) {
      const existing = await CustomField.findOne({
        where: {
          fieldName: fieldData.fieldName,
          entityType: fieldData.entityType,
          fieldSource: fieldData.fieldSource,
        },
      });

      if (!existing) {
        await CustomField.create(fieldData);
        console.log(
          `✅ Created field: ${fieldData.fieldLabel} (${fieldData.entityType})`
        );
      } else {
        console.log(
          `⏭️  Field already exists: ${fieldData.fieldLabel} (${fieldData.entityType})`
        );
      }
    }

    console.log("🎉 Data fields seeding completed!");
    return true;
  } catch (error) {
    console.error("❌ Error seeding data fields:", error);
    throw error;
  }
}

module.exports = { seedDataFields };

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDataFields()
    .then(() => {
      console.log("Seeding completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}
