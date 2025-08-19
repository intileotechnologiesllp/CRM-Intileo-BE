const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const MasterUser = require("../../models/master/masterUserModel"); // adjust path as needed

const InsightColumn = sequelize.define(
  "InsightColumn",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "masterusers", key: "masterUserID" },
    },
    entity: {
      type: DataTypes.STRING, // 'Deal', 'Person', 'Organization', etc.
      allowNull: false,
    },
    contextId: {
      type: DataTypes.INTEGER,
      allowNull: true, // e.g. dashboardId, reportId, etc. (optional, for per-dashboard/report settings)
    },
    columns: {
      type: DataTypes.JSON, // Array of { key: string, checked: boolean }
      allowNull: false,
    },
  },
  {
    tableName: "InsightColumns",
    timestamps: true,
  }
);

module.exports = InsightColumn;