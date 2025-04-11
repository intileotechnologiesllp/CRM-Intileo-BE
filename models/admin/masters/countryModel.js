const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Country = sequelize.define("Country", {
  country_desc: {
    type: DataTypes.TEXT,
    allowNull: false,
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

module.exports = Country;
