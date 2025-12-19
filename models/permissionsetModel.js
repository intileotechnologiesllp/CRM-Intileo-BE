const { DataTypes } = require("sequelize");

const createPermissionSetModel = (sequelizeInstance) => {
  const PermissionSet = sequelizeInstance.define("PermissionSet", {
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
},
{
  tableName: "PermissionSets",
  timestamps: true,
});
return PermissionSet;
}

module.exports = createPermissionSetModel;
