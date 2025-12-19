const { DataTypes } = require("sequelize");


const createDashboardModel = (sequelizeInstance) => {
const Dashboard = sequelizeInstance.define(
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
return Dashboard
}

// Dashboard.sync({alter: true});
module.exports = createDashboardModel;
