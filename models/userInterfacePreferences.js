const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserInterfacePreference = sequelize.define(
  "UserInterfacePreference",
  {
    preferenceId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
      comment: "User ID who owns these interface preferences",
    },
    showAddActivityModalAfterWinning: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: "Show add activity modal after winning a deal",
    },
    openDetailsViewAfterCreating: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: "Open details view after creating a new item",
    },
    openDetailsViewForLeadDeal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: "Open details view for Lead/Deal",
    },
    openDetailsViewForPerson: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: "Open details view for Person",
    },
    openDetailsViewForOrganization: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: "Open details view for Organization",
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
    tableName: "UserInterfacePreferences",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["masterUserID"],
      },
    ],
  }
);

module.exports = UserInterfacePreference;
