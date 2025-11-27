const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const DeviceActivity = sequelize.define("DeviceActivity", {
  device: {
    type: DataTypes.STRING(100),
  },
  Location: {
    type: DataTypes.STRING(100),
  },
  ipAddress: {
    type: DataTypes.STRING(100),
  },
  loginTime: {
    type: DataTypes.STRING(100),
  },
  loginVia: {
    type: DataTypes.STRING(100),
  },
  loginOut: {
    type: DataTypes.STRING(100),
  },
  isActive: {
    type: DataTypes.BOOLEAN,
  },
});

module.exports = DeviceActivity;
