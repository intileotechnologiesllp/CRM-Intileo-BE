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
    allowNull: true, // Password can be null initially
  },
  designation: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  department:{
    type: DataTypes.STRING,
    allowNull: false,
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false, // Admin ID who created the user
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false, // Admin who created the user
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = MasterUser;