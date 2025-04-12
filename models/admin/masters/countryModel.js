const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Country = sequelize.define("Country", {
  country_desc: {
    type: DataTypes.STRING,
    allowNull: false,
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
