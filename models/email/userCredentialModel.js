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
  senderName: {
    type: DataTypes.STRING, // Optional sender name
    allowNull: true,
  },
  defaultEmail: {
    type: DataTypes.BOOLEAN, // New field for default email
    defaultValue: false, // Default to false
  },
});

module.exports = UserCredential;
