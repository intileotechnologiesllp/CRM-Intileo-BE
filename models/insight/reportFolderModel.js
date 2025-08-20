const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Dashboard = sequelize.define(
  "ReportFolder",
  {
    reportFolderId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    ownerId: { type: DataTypes.INTEGER, allowNull: false }, // userId
  },
  {
    tableName: "ReportFolders",
    timestamps: true,
  }
);

module.exports = Dashboard;
