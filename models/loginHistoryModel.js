const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const LoginHistory = sequelize.define("LoginHistory", {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  loginTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  latitude: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  loginType: { // New field to handle login type
    type: DataTypes.ENUM("admin", "general", "master"),
    allowNull: false,
    validate: {
      isIn: {
        args: [["admin", "general", "master"]],
        msg: "Invalid login type. Must be 'admin', 'general', or 'master'.",
      },
    },
  },
});

module.exports = LoginHistory;