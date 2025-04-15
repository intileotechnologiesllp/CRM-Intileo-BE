const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Currency = sequelize.define("Currency", {
  currencyId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  currency_desc: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "currency description is required", // Custom error message
      },
      notEmpty: {
        msg: "currency description cannot be empty", // Custom error message
      },
    },
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  creationDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW, // Set default value to the current timestamp
  },
});

module.exports = Currency;
