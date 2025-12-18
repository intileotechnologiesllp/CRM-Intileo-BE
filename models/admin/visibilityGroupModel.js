const { DataTypes } = require("sequelize");


const createVisibilityGroupModel = (sequelizeInstance) => {
const VisibilityGroup = sequelizeInstance.define(
  "VisibilityGroup",
  {
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
    parentGroupId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "GroupVisibilities",
        key: "groupId",
      },
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    hierarchyLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Depth level in hierarchy (0=root, 1=child, etc.)",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "VisibilityGroups",
    timestamps: true,
    indexes: [
      {
        fields: ["masterUserID"],
      },
      {
        fields: ["parentGroupId"],
      },
      {
        fields: ["isDefault"],
      },
      {
        fields: ["isActive"],
      },
      {
        unique: true,
        fields: ["groupName", "masterUserID"],
        name: "unique_group_name_per_user",
      },
    ],
  }
);
return VisibilityGroup
}

// Self-referencing association for parent-child relationships
// VisibilityGroup.hasMany(VisibilityGroup, {
//   as: "childGroups",
//   foreignKey: "parentGroupId",
// });

// VisibilityGroup.belongsTo(VisibilityGroup, {
//   as: "parentGroup",
//   foreignKey: "parentGroupId",
// });

module.exports = createVisibilityGroupModel;
