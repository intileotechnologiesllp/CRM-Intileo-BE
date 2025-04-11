const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Lead = sequelize.define("Lead", {
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  organization: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  value: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  expectedCloseDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sourceChannel: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Lead;