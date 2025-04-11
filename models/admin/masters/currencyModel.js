const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Currency = sequelize.define("Currency", {
  currency_desc: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  creationDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Currency;
