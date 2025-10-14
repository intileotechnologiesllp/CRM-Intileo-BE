const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const permissionSet = sequelize.define("permissionSet", {
  permissionSetId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  permissions: {
    type: DataTypes.JSON,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  groupName: {
    type: DataTypes.STRING(100),
  },
  description: {
    type: DataTypes.STRING,
  }
});

permissionSet.sync();

module.exports = permissionSet;
