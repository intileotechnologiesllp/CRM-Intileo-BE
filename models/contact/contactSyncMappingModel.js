const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const ContactSyncMapping = sequelize.define(
  "ContactSyncMapping",
  {
    mappingId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    googleContactId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    googleResourceName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    googleEtag: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    crmUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    googleUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    syncStatus: {
      type: DataTypes.ENUM("synced", "pending", "conflict", "error"),
      allowNull: false,
      defaultValue: "synced",
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: "contactSyncMappings",
    timestamps: true,
    indexes: [
      { fields: ["masterUserID"] },
      { fields: ["personId"] },
      { fields: ["googleContactId"], unique: true },
      { fields: ["syncStatus"] },
      { fields: ["isDeleted"] },
    ],
  }
);

module.exports = ContactSyncMapping;
