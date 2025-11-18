const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const ContactSyncHistory = sequelize.define(
  "ContactSyncHistory",
  {
    syncHistoryId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    syncConfigId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    syncType: {
      type: DataTypes.ENUM("manual", "auto", "scheduled"),
      allowNull: false,
      defaultValue: "manual",
    },
    syncDirection: {
      type: DataTypes.ENUM("google_to_crm", "crm_to_google", "bidirectional"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("in_progress", "completed", "failed", "partial"),
      allowNull: false,
      defaultValue: "in_progress",
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER, // Duration in seconds
      allowNull: true,
    },
    // Statistics
    totalContacts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdInCRM: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    updatedInCRM: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    deletedInCRM: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdInGoogle: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    updatedInGoogle: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    deletedInGoogle: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    skipped: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    conflicts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    errors: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    errorDetails: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    detailedLog: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "contactSyncHistories",
    timestamps: true,
    indexes: [
      { fields: ["syncConfigId"] },
      { fields: ["masterUserID"] },
      { fields: ["status"] },
      { fields: ["startedAt"] },
    ],
  }
);

module.exports = ContactSyncHistory;
