const { DataTypes } = require("sequelize");


const createContactChangeLogModel = (sequelizeInstance) => {
const ContactChangeLog = sequelizeInstance.define(
  "ContactChangeLog",
  {
    changeLogId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    syncHistoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Null if contact only exists in Google
    },
    googleContactId: {
      type: DataTypes.STRING,
      allowNull: true, // Null if contact only exists in CRM
    },
    operation: {
      type: DataTypes.ENUM(
        "created_in_crm",
        "updated_in_crm",
        "deleted_in_crm",
        "created_in_google",
        "updated_in_google",
        "deleted_in_google",
        "conflict_resolved",
        "skipped",
        "error"
      ),
      allowNull: false,
    },
    changeType: {
      type: DataTypes.ENUM("create", "update", "delete", "conflict", "skip", "error"),
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM("google_to_crm", "crm_to_google", "bidirectional"),
      allowNull: false,
    },
    contactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Change tracking
    fieldsBefore: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    fieldsAfter: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    changedFields: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    // Conflict information
    conflictReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    conflictResolution: {
      type: DataTypes.ENUM("newest_wins", "google_wins", "crm_wins", "manual"),
      allowNull: true,
    },
    winningSource: {
      type: DataTypes.ENUM("google", "crm"),
      allowNull: true,
    },
    // Timestamps from both systems
    crmUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    googleUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    errorStack: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
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
    tableName: "ContactChangeLogs",
    timestamps: true,
    indexes: [
      { fields: ["syncHistoryId"] },
      { fields: ["masterUserID"] },
      { fields: ["personId"] },
      { fields: ["googleContactId"] },
      { fields: ["operation"] },
      { fields: ["changeType"] },
      { fields: ["createdAt"] },
    ],
  }
);
return ContactChangeLog
}

module.exports = createContactChangeLogModel;
