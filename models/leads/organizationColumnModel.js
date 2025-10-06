const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const OrganizationColumnPreference = sequelize.define("OrganizationColumnPreference", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  masterUserID: { type: DataTypes.INTEGER, allowNull: true },
  columns: { type: DataTypes.JSON, allowNull: false, defaultValue: [] } // Array of {key, source}
});

module.exports = OrganizationColumnPreference;
