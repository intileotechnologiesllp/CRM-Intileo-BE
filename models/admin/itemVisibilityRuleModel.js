const { DataTypes } = require("sequelize");


const createItemVisibilityRuleModel = (sequelizeInstance) => {
const ItemVisibilityRule = sequelizeInstance.define(
  "ItemVisibilityRule",
  {
    ruleId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "GroupVisibilities",
        key: "groupId",
      },
    },
    entityType: {
      type: DataTypes.ENUM(
        "leads",
        "deals",
        "people",
        "organizations",
        "products",
        "activities"
      ),
      allowNull: false,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
    defaultVisibility: {
      type: DataTypes.ENUM(
        "owner_only",
        "group_only",
        "everyone",
        "item_owners_visibility_group"
      ),
      defaultValue: "item_owners_visibility_group",
    },
    canCreate: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    canView: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    canEdit: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    canDelete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    canExport: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    canBulkEdit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: "ItemVisibilityRules",
    timestamps: true,
    indexes: [
      {
        fields: ["groupId"],
      },
      {
        fields: ["entityType"],
      },
      {
        fields: ["masterUserID"],
      },
      {
        unique: true,
        fields: ["groupId", "entityType"],
        name: "unique_group_entity_rule",
      },
    ],
  }
);
return ItemVisibilityRule
}

module.exports = createItemVisibilityRuleModel;
