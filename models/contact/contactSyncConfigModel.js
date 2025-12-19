const { DataTypes } = require("sequelize");


const createContactSyncConfigModel = (sequelizeInstance) => {
const ContactSyncConfig = sequelizeInstance.define(
  "ContactSyncConfig",
  {
    syncConfigId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    provider: {
      type: DataTypes.ENUM("google", "outlook", "office365"),
      allowNull: false,
      defaultValue: "google",
    },
    syncMode: {
      type: DataTypes.ENUM("google_to_crm", "crm_to_google", "bidirectional"),
      allowNull: false,
      defaultValue: "bidirectional",
    },
    syncDirection: {
      type: DataTypes.ENUM("one_way", "two_way"),
      allowNull: false,
      defaultValue: "two_way",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    autoSyncEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    syncFrequency: {
      type: DataTypes.INTEGER, // In minutes
      allowNull: true,
      defaultValue: 60, // 1 hour default
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    nextSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    googleEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    googleRefreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    googleAccessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    googleTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    syncGroupFilter: {
      type: DataTypes.STRING, // Specific contact group ID to sync
      allowNull: true,
    },
    conflictResolution: {
      type: DataTypes.ENUM("newest_wins", "google_wins", "crm_wins", "manual"),
      allowNull: false,
      defaultValue: "newest_wins",
    },
    deletionHandling: {
      type: DataTypes.ENUM("soft_delete", "hard_delete", "skip"),
      allowNull: false,
      defaultValue: "soft_delete",
    },
    fieldMapping: {
      type: DataTypes.JSON, // Custom field mappings
      allowNull: true,
      defaultValue: {},
    },
    syncStats: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSyncDuration: 0,
        totalContactsSynced: 0,
      },
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
    tableName: "ContactSyncConfigs",
    timestamps: true,
  }
);
return ContactSyncConfig
}

module.exports = createContactSyncConfigModel;
