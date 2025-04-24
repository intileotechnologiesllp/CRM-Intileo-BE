const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const MasterUser = sequelize.define("MasterUser", {
  masterUserID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  designation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  department:{
    type: DataTypes.STRING,
    allowNull: true,
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false, // Admin ID who created the user
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false, // Admin who created the user
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "active", // Default status
  },
  resetToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetTokenExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  loginType:{
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
  userType: {
    type: DataTypes.STRING,
    allowNull: false, // "admin" or "general"
  },
  mobileNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  }
});

module.exports = MasterUser;