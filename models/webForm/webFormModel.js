const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const WebForm = sequelize.define("WebForm", {
  formId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  formName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: "Display name of the form",
  },
  formTitle: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "Title shown on the form",
  },
  formDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Description or instructions for the form",
  },
  embedCode: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Generated embed code for website integration",
  },
  uniqueKey: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: "Unique identifier for public API access",
  },
  status: {
    type: DataTypes.ENUM("active", "inactive", "draft"),
    defaultValue: "draft",
    comment: "Form status",
  },
  
  // Styling and customization
  primaryColor: {
    type: DataTypes.STRING(20),
    defaultValue: "#3B82F6",
    comment: "Primary color for form styling (HEX)",
  },
  buttonText: {
    type: DataTypes.STRING(100),
    defaultValue: "Submit",
    comment: "Text for submit button",
  },
  successMessage: {
    type: DataTypes.TEXT,
    defaultValue: "Thank you! We will contact you soon.",
    comment: "Message shown after successful submission",
  },
  redirectUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "URL to redirect after successful submission",
  },

  // Lead configuration
  leadSource: {
    type: DataTypes.STRING(100),
    defaultValue: "Website Form",
    comment: "Source to be set for captured leads",
  },
  autoAssignTo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "MasterUserID to auto-assign leads to",
  },
  defaultPipelineId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Default pipeline for created leads",
  },
  defaultStageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Default stage for created leads",
  },

  // Tracking and analytics
  totalSubmissions: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Total number of submissions",
  },
  totalViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Total number of form views/loads",
  },
  conversionRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    comment: "Submission rate (submissions/views * 100)",
  },

  // Multi-tenancy and permissions
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Creator of the form",
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Organization ID for multi-tenant support",
  },
  
  // Security
  allowedDomains: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "JSON array of allowed domains for CORS",
  },
  enableCaptcha: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Enable CAPTCHA verification",
  },
  enableDoubleOptIn: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Enable email verification for submissions",
  },

  // GDPR and compliance
  gdprCompliant: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: "Include GDPR consent checkbox",
  },
  consentText: {
    type: DataTypes.TEXT,
    defaultValue: "I agree to the processing of my personal data",
    comment: "Text for GDPR consent checkbox",
  },
  privacyPolicyUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "Link to privacy policy",
  },

  // Notifications
  notifyEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Email to notify on new submissions",
  },
  enableNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: "Enable email notifications for new submissions",
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
  tableName: "webForms",
  timestamps: true,
  indexes: [
    { fields: ["uniqueKey"] },
    { fields: ["masterUserID"] },
    { fields: ["status"] },
    { fields: ["organizationId"] },
  ],
});

module.exports = WebForm;
