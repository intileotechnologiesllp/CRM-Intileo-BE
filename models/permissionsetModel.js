const { DataTypes } = require("sequelize");

const createPermissionSetModel = (sequelizeInstance) => {
  const permissionSet = sequelizeInstance.define("permissionSet", {
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
  tableName: "permissionSets",
  timestamps: true,
});
return permissionSet;
}

module.exports = createPermissionSetModel;
