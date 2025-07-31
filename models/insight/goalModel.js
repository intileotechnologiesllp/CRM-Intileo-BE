const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

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
      allowNull: true, // Allow null for goals not assigned to dashboard yet
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
      allowNull: true, // Allow null for indefinite goals
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assignee: {
      type: DataTypes.STRING,
      allowNull: true,
    }, // User assigned to the goal
    assignId: {
      type: DataTypes.STRING,
      allowNull: true,
    }, // User ID assigned to the goal or 'everyone'
    pipeline: {
      type: DataTypes.STRING,
      allowNull: true,
    }, // Pipeline filter for deals
    trackingMetric: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Count",
    }, // "Count" or "Value"
    count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    }, // Target count when trackingMetric is "Count"
    value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    }, // Target value when trackingMetric is "Value"
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

module.exports = Goal;
