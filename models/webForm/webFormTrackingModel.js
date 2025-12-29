const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const WebFormTracking = sequelize.define("WebFormTracking", {
  trackingId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  formId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Reference to WebForm",
  },
  
  // Event tracking
  eventType: {
    type: DataTypes.ENUM(
      "view",           // Form was loaded/viewed
      "start",          // User started filling the form
      "field_focus",    // User focused on a field
      "field_complete", // User completed a field
      "submit_attempt", // User tried to submit
      "submit_success", // Form submitted successfully
      "submit_error",   // Submission failed
      "abandon"         // User left without submitting
    ),
    allowNull: false,
    comment: "Type of tracking event",
  },
  
  // Event details
  fieldName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Field name for field-specific events",
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Error message if submission failed",
  },
  
  // Session tracking
  sessionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Unique session identifier for the visitor",
  },
  visitorId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: "Unique visitor identifier (cookie-based)",
  },
  
  // Source information
  sourceUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "URL where the event occurred",
  },
  referrerUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: "Referrer URL",
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Browser user agent",
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: "IP address of visitor",
  },
  
  // Device information
  deviceType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: "Device type (desktop, mobile, tablet)",
  },
  browser: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: "Browser name and version",
  },
  os: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: "Operating system",
  },
  screenResolution: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: "Screen resolution (e.g., 1920x1080)",
  },
  
  // Time tracking
  timeOnForm: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Time spent on form in seconds",
  },
  timeToSubmit: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Time from start to submit in seconds",
  },
  
  // UTM tracking
  utmSource: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  utmMedium: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  utmCampaign: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  
  // Geographic data
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  
  // Additional metadata
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "JSON object for additional tracking data",
  },

  // Timestamps
  eventTimestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: "When the event occurred",
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "webFormTracking",
  timestamps: false,
  indexes: [
    { fields: ["formId"] },
    { fields: ["eventType"] },
    { fields: ["sessionId"] },
    { fields: ["visitorId"] },
    { fields: ["eventTimestamp"] },
  ],
});

module.exports = WebFormTracking;
