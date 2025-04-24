const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const MasterUserPrivileges = sequelize.define("MasterUserPrivileges", {
  privilegeID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "MasterUsers", // Table name for MasterUser
      key: "masterUserID",
    },
    onDelete: "CASCADE",
  },
  permissions: {
    type: DataTypes.JSON, // Store permissions as a JSON object
    allowNull: false,
    defaultValue: {}, // Default to an empty object
  },
  
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false, // Admin ID who assigned the permission
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false, // Role of the creator (e.g., "admin")
  },
  mode:{
    type: DataTypes.STRING,
    allowNull: true,
  }
});

module.exports = MasterUserPrivileges;
