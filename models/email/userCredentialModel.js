const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db"); // Adjust the path to your database configuration

const UserCredential = sequelize.define("UserCredential", {
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // Ensure one credential per user
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  appPassword: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // syncStartDate: {
  //   type: DataTypes.INTEGER, // Allow any number as a string
  //   allowNull: true, // Optional field
  //   defaultValue: "3", // Default to "3"
  // },
  // syncStartType: {
  //   type: DataTypes.ENUM("days", "months", "years"), // Restrict values to 'days', 'months', or 'years'
  //   allowNull: true, // Optional field
  //   defaultValue: "days", // Default to 'days'
  // },
});

module.exports = UserCredential;
