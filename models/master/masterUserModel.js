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
  department: {
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
  loginType: {
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
  },
  profileImage: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bio: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true, // Default to active
  },
  deactivatedAt: {
    type: DataTypes.DATE,
    allowNull: true, // Date when user was deactivated
  },
  deactivatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true, // ID of admin who deactivated the user
  },
  deactivationReason: {
    type: DataTypes.TEXT,
    allowNull: true, // Reason for deactivation
  },
});

const MasterUserPrivileges = require("../privileges/masterUserPrivilegesModel");

MasterUser.hasOne(MasterUserPrivileges, {
  foreignKey: "masterUserID",
  as: "privileges", // Alias for the association
});

MasterUserPrivileges.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  as: "user", // Alias for the reverse association
});

module.exports = MasterUser;
