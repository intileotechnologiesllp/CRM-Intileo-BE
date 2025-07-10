const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CustomField = sequelize.define(
  "CustomField",
  {
    fieldId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fieldName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fieldLabel: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    fieldType: {
      type: DataTypes.ENUM(
        "text",
        "textarea",
        "number",
        "decimal",
        "email",
        "phone",
        "url",
        "date",
        "datetime",
        "select",
        "multiselect",
        "checkbox",
        "radio",
        "file",
        "currency",
        "organization",
        "person"
      ),
      allowNull: false,
      defaultValue: "text",
    },
    fieldSource: {
      type: DataTypes.ENUM("custom", "default", "system"),
      allowNull: false,
      defaultValue: "custom",
      comment:
        "Source of the field: custom (user-created), default (built-in), system (read-only)",
    },
    entityType: {
      type: DataTypes.ENUM(
        "lead",
        "deal",
        "both", // Fields that apply to both leads and deals
        "person",
        "organization",
        "activity"
      ),
      allowNull: false,
      comment:
        "Entity type: lead, deal, both (lead+deal), person, organization, activity",
    },
    entityScope: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "Array of entity types this field applies to ['lead', 'deal'] for 'both' type",
    },
    options: {
      type: DataTypes.JSON, // For select, multiselect, radio options
      allowNull: true,
      comment: "JSON array of options for select/radio fields",
    },
    validationRules: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "JSON object with validation rules (required, min, max, pattern, etc.)",
    },
    defaultValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isImportant: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether field should be highlighted as important",
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "Ungrouped custom fields",
      comment:
        "Category for grouping fields (Default fields, System fields, Summary, Custom, etc.)",
    },
    fieldGroup: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment:
        "Field group for organizing fields within categories (Testing, Sales, etc.)",
    },
    isCollapsible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether this field category/group can be collapsed in UI",
    },
    isSystemField: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether this is a system field (read-only, auto-generated)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
    // Visibility fields for UI display
    showInAddView: {
      type: DataTypes.BOOLEAN,  
      defaultValue: false,
      comment: "Legacy field - whether to show in add/create forms",
    },
    showInDetailView: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Legacy field - whether to show in detail/edit forms",
    },
    showInListView: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether to show in list/table views",
    },
    // New visibility fields
    leadView: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether to show in lead forms and views",
    },
    dealView: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether to show in deal forms and views",
    },
    // Configuration fields
    placesWhereShown: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "JSON object defining where field should be shown (leadView, dealView, listView, pipelines)",
    },
    userSpecifications: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "JSON object with user permissions (editingUsers, viewingUsers)",
    },
    pipelineRestrictions: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "JSON object or string defining pipeline restrictions",
    },
    qualityRules: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "JSON object with quality rules (required, important, unique, minLength, maxLength, etc.)",
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "CustomFields",
    timestamps: true,
    indexes: [
      {
        fields: ["entityType", "masterUserID"],
      },
      {
        fields: ["fieldName", "entityType", "masterUserID"],
        unique: true,
        name: "unique_field_per_entity_user",
      },
      {
        fields: ["category", "entityType"],
        name: "idx_category_entity",
      },
      {
        fields: ["fieldSource", "entityType"],
        name: "idx_source_entity",
      },
    ],
  }
);

module.exports = CustomField;
