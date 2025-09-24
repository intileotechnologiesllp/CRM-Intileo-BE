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
    dashboardIds: {
      type: DataTypes.STRING,
      allowNull: true,
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
      references: {
        model: "ReportFolders", 
        key: "reportFolderId"
      }
    },
    ownerId: { type: DataTypes.INTEGER, allowNull: false },
    graphtype: { type: DataTypes.STRING, allowNull: false, defaultValue: "bar" },
    colors: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: "Reports",
    timestamps: true,
  }
);

module.exports = Report;
