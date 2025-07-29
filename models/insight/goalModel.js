const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Dashboard = require("./dashboardModel");

const Goal = sequelize.define(
  "Goal",
  {
    goalId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dashboardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "dashboards", key: "dashboardId" },
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: false,
    }, // "Deal", "Activity", "Forecast"
    goalType: {
      type: DataTypes.STRING,
      allowNull: false,
    }, // "Added", "Progressed", "Won"
    targetValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    targetType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "number",
    }, // "number", "value"
    period: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "monthly",
    }, // "daily", "weekly", "monthly", "quarterly", "yearly"
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "Goals",
    timestamps: true,
  }
);

Goal.belongsTo(Dashboard, { foreignKey: "dashboardId" });
Dashboard.hasMany(Goal, { foreignKey: "dashboardId" });

module.exports = Goal;
