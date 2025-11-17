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
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "dashboard",
    }, // folder or dashboard
    parentId: { type: DataTypes.INTEGER, allowNull: true }, // reference to parent folder
    ownerId: { type: DataTypes.INTEGER, allowNull: false }, // userId
    coordinates: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    tableName: "Dashboards",
    timestamps: true,
  }
);

Dashboard.sync({alter: true});
module.exports = Dashboard;
