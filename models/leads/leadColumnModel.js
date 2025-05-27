const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const LeadColumnPreference = sequelize.define("LeadColumnPreference", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  masterUserID: { type: DataTypes.INTEGER, allowNull: false },
  columns: { type: DataTypes.JSON, allowNull: false } // Array of {key, source}
});

module.exports = LeadColumnPreference;