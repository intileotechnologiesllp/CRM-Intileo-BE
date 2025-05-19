const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const MiscSettings = sequelize.define("MiscSettings", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  maxImageSizeMB: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 }, // default 5MB
  allowedImageTypes: { type: DataTypes.STRING, allowNull: false, defaultValue: "jpg,jpeg,png,gif" }, // comma-separated
});

module.exports = MiscSettings;