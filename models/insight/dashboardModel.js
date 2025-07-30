const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");


const Dashboard = sequelize.define(
  "Dashboard",
  {
    dashboardId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    folder: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "My dashboards",
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "dashboard",
    }, // folder or dashboard
    parentId: { type: DataTypes.INTEGER, allowNull: true }, // reference to parent folder
    ownerId: { type: DataTypes.INTEGER, allowNull: false }, // userId
  },
  {
    tableName: "Dashboards",
    timestamps: true,
  }
);


module.exports = Dashboard;
