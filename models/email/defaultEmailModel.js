const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const DefaultEmail = sequelize.define("DefaultEmail", {
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // Ensure one default email per user
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  appPassword: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  senderName: {
    type: DataTypes.STRING, // New field for sender's name
    allowNull: true,
  },
  isDefault: {
    type: DataTypes.BOOLEAN, // Field to indicate if this is the default email
    defaultValue: false, // Default to false
  },
});

module.exports = DefaultEmail;
