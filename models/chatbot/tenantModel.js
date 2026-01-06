const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Tenant = sequelize.define(
  "Tenant",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      defaultValue: "active",
      allowNull: false,
    },
  },
  {
    tableName: "tenants",
    timestamps: true,
  }
);

module.exports = Tenant;
