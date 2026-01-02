const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const createWebFormSubmissionModel = (sequelizeInstance) => {
const WebFormSubmission = sequelizeInstance.define("WebFormSubmission", {
  submissionId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  formId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Reference to WebForm",
  },
  
  // Submission data
  formData: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: "JSON object containing all submitted field values",
  },
  
  // Lead tracking
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Reference to created Lead if converted",
  },
  personId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Reference to created Person if applicable",
  },
  organizationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Reference to created Organization if applicable",
  },
  
  // Source tracking
  sourceUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "URL of the page where form was submitted",
  },
  referrerUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "Referrer URL (where user came from)",
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Browser user agent string",
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: "IP address of submitter (supports IPv6)",
  },
  
  // Geolocation (optional)
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: "Country from IP geolocation",
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: "City from IP geolocation",
  },
  
  // UTM tracking
  utmSource: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "UTM source parameter",
  },
  utmMedium: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "UTM medium parameter",
  },
  utmCampaign: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "UTM campaign parameter",
  },
  utmTerm: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "UTM term parameter",
  },
  utmContent: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "UTM content parameter",
  },
  
  // Status tracking
  status: {
    type: DataTypes.ENUM("pending", "converted", "duplicate", "spam", "failed"),
    defaultValue: "pending",
    comment: "Processing status of the submission",
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether the submission has been reviewed",
  },
  
  // GDPR consent
  consentGiven: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether GDPR consent was given",
  },
  consentTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "When consent was given",
  },
  consentIp: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: "IP address when consent was given",
  },
  
  // Quality scoring
  qualityScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Lead quality score (0-100)",
  },
  
  // Notes and processing
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Admin notes about this submission",
  },
  processedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "MasterUserID who processed the submission",
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "When the submission was processed",
  },
  
  // Spam detection
  spamScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    comment: "Spam probability score (0-1)",
  },
  isSpam: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Marked as spam",
  },

  // Timestamps
  submittedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: "When the form was submitted",
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "webFormSubmissions",
  timestamps: true,
  indexes: [
    { fields: ["formId"] },
    { fields: ["leadId"] },
    { fields: ["status"] },
    { fields: ["submittedAt"] },
    { fields: ["ipAddress"] },
    { fields: ["isSpam"] },
  ],
})
return WebFormSubmission;
};

module.exports = createWebFormSubmissionModel;