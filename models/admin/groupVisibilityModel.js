const { DataTypes } = require("sequelize");


const createGroupVisibilityModel = (sequelizeInstance) => {
const GroupVisibility = sequelizeInstance.define("GroupVisibility", {
  groupId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  groupName: {
    type: DataTypes.STRING(70),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  pipelineIds: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lead: {
    type: DataTypes.ENUM("owner", "visibilitygroup", "everyone"),
    allowNull: true,
  },
  deal: {
    type: DataTypes.ENUM("owner", "visibilitygroup", "everyone"),
    allowNull: true,
  },
  person: {
    type: DataTypes.ENUM("owner", "visibilitygroup", "everyone"),
    allowNull: true,
  },
  Organization: {
    type: DataTypes.ENUM("owner", "visibilitygroup", "everyone"),
    allowNull: true,
  },
  memberIds: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentGroupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "MasterUsers",
      key: "masterUserID",
    },
  },
},
  {
    tableName: "GroupVisibilities",
    timestamps: true,
  }
);
return GroupVisibility
}

// GroupVisibility.sync({});
// GroupVisibility.belongsTo(MasterUser, {
//   foreignKey: "createdBy",
//   as: "creator",
// });


module.exports = createGroupVisibilityModel;
