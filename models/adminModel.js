const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Admin = sequelize.define("Admin", {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  otp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  otpExpiration: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  loginType:{
    type: DataTypes.STRING,
    allowNull: false,
  }
});

module.exports = Admin;