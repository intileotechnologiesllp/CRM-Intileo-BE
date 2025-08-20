const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Report = sequelize.define(
  "Report",
  {
    reportId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dashboardId: {
      type: DataTypes.INTEGER,
       allowNull: true, // Allow null for reports not assigned to dashboard yet
      references: { model: "dashboards", key: "dashboardId" },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Untitled Report",
    },
    entity: { type: DataTypes.STRING, allowNull: false }, // e.g. "Lead", "Deal"
    type: { type: DataTypes.STRING, allowNull: false }, // e.g. "Performance", "Conversion"
    config: { type: DataTypes.JSON, allowNull: true }, // chart config, filters, etc.
    position: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    description: { type: DataTypes.TEXT, allowNull: true },
    folderId: { type: DataTypes.INTEGER, allowNull: true }, // reference to parent folder
    ownerId: { type: DataTypes.INTEGER, allowNull: false }, // userId
  },
  {
    tableName: "Reports",
    timestamps: true,
  }
);

module.exports = Report;
