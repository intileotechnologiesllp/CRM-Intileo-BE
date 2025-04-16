const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const GeneralUser = sequelize.define("GeneralUser", {
  generalUserId: {
    // Changed from id to generalUserId
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
      isEmail: {
        msg: "Must be a valid email address",
      },
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  creatorUserId: {
    type: DataTypes.INTEGER, // Admin ID who created the user
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = GeneralUser;
