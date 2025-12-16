const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const MasterUser = require("../../models/master/masterUserModel"); // adjust path as needed

const ProductColumn = sequelize.define(
  "ProductColumn",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    columns: { type: DataTypes.JSON, allowNull: false }, // Array of column keys/ids
  },
  {
    tableName: "ProductColumns",
    timestamps: true,
  }
);
ProductColumn.sync();

module.exports = ProductColumn;