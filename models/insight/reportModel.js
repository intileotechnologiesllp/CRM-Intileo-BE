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
      allowNull: true,
      references: { 
        model: "Dashboards", // Changed to match actual table name
        key: "dashboardId" 
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Untitled Report",
    },
    entity: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    config: { type: DataTypes.JSON, allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    description: { type: DataTypes.TEXT, allowNull: true },
    folderId: { 
      type: DataTypes.INTEGER, 
      allowNull: true,
      // references: {
      //   model: "ReportFolders", // Reference the correct table
      //   key: "reportFolderId"
      // }
    },
    ownerId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: "Reports",
    timestamps: true,
  }
);

module.exports = Report;
