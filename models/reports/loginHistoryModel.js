const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const LoginHistory = sequelize.define("LoginHistory", {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  device: {
    type: DataTypes.STRING(100)
  },
  location: {
    type: DataTypes.STRING(100)
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
  loginType: {
    // New field to handle login type
    type: DataTypes.ENUM("admin", "general", "master"),
    allowNull: false,
    validate: {
      isIn: {
        args: [["admin", "general", "master"]],
        msg: "Invalid login type. Must be 'admin', 'general', or 'master'.",
      },
    },
  },
  logoutTime: {
    type: DataTypes.DATE, // New column for logout time
    allowNull: true,
  },
  duration: {
    type: DataTypes.STRING, // New column for duration (e.g., "2 hours 15 minutes")
    allowNull: true,
  },
  username:{
    type: DataTypes.STRING,
    allowNull: true, // New field for username
  },
  totalSessionDuration:{
    type: DataTypes.STRING, // New column for total session duration (e.g., "2 hours 15 minutes")
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

LoginHistory.sync({ alter: true });

module.exports = LoginHistory;
