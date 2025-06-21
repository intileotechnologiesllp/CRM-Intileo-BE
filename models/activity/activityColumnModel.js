const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const MasterUser = require("../../models/master/masterUserModel"); // adjust path as needed

const ActivityColumn = sequelize.define("ActivityColumn", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  masterUserID: { type: DataTypes.INTEGER, allowNull: true, references: { model: MasterUser, key: "masterUserID" } },
  columns: { type: DataTypes.JSON, allowNull: false }, // Array of column keys/ids
}, {
  tableName: "ActivityColumns",
  timestamps: true,
});

module.exports = ActivityColumn;