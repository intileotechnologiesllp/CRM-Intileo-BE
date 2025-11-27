const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const MasterUser = require("../../models/master/masterUserModel"); // adjust path as needed

const DealColumn = sequelize.define(
  "DealColumn",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "masterusers", key: "masterUserID" },
    },
    columns: { type: DataTypes.JSON, allowNull: false }, // Array of column keys/ids
  },
  {
    tableName: "DealColumns",
    timestamps: true,
  }
);

module.exports = DealColumn;
