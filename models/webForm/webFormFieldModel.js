const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const WebFormField = sequelize.define("WebFormField", {
  fieldId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  formId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Reference to WebForm",
  },
  
  // Field configuration
  fieldName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: "Internal field identifier (e.g., 'email', 'company_name')",
  },
  fieldLabel: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: "Display label for the field",
  },
  fieldType: {
    type: DataTypes.ENUM(
      "text",
      "email",
      "phone",
      "number",
      "textarea",
      "select",
      "radio",
      "checkbox",
      "date",
      "file",
      "url"
    ),
    allowNull: false,
    defaultValue: "text",
    comment: "Type of input field",
  },
  
  // Field options
  placeholder: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Placeholder text for the field",
  },
  defaultValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Default value for the field",
  },
  options: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "JSON array of options for select/radio/checkbox fields",
  },
  
  // Validation
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether the field is mandatory",
  },
  validationRule: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Custom validation regex or rule",
  },
  validationMessage: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Error message for validation failure",
  },
  minLength: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Minimum character length",
  },
  maxLength: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Maximum character length",
  },

  // Layout and ordering
  fieldOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Display order of the field (for drag-drop reordering)",
  },
  fieldWidth: {
    type: DataTypes.ENUM("full", "half", "third"),
    defaultValue: "full",
    comment: "Width of the field in the form layout",
  },
  
  // Lead mapping
  mapToLeadField: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Maps to Lead table field (e.g., 'email', 'phone', 'company')",
  },
  mapToPersonField: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Maps to Person table field",
  },
  mapToOrganizationField: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Maps to Organization table field",
  },
  storeInCustomField: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Store value in custom field if no standard mapping",
  },

  // Styling
  cssClass: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Custom CSS class for styling",
  },
  helpText: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Help text shown below the field",
  },

  // Timestamps
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "webFormFields",
  timestamps: true,
  indexes: [
    { fields: ["formId"] },
    { fields: ["fieldOrder"] },
  ],
});

module.exports = WebFormField;
