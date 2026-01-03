// models/LeadCaptureAnalytics.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const LeadCaptureAnalytics = (sequelize) => {
  const LeadAnalytics = sequelize.define(
    "LeadCaptureAnalytics",
    {
      analyticsId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      formId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      masterUserId: {
        type: DataTypes.INTEGER,
        allowNull: true, // null for anonymous visitors
      },

      visitorEmail: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      viewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      firstInteractedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      submittedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM("VIEWED", "INTERACTED", "SUBMITTED", "ERROR"),
        defaultValue: "VIEWED",
      },

      totalInteractions: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },

      hasError: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      lastErrorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      deviceType: {
        type: DataTypes.ENUM("DESKTOP", "MOBILE", "TABLET"),
        allowNull: true,
      },

      referrer: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "lead_capture_analytics",
      timestamps: true,
      indexes: [
        { fields: ["formId"] },
        { fields: ["sessionId"] },
        { fields: ["status"] },
      ],
    }
  );
  return LeadAnalytics;
};

module.exports = LeadCaptureAnalytics;
