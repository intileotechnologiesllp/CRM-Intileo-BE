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
        "person",
        "organization",
        "activity"
      ),
      allowNull: false,
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
      comment: "Category for grouping fields (Summary, Details, etc.)",
    },
    fieldGroup: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Field group for organizing fields within categories",
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
      },
    ],
  }
);

module.exports = CustomField;
