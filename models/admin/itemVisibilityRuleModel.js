const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const ItemVisibilityRule = sequelize.define(
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
        model: "visibility_groups",
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
        model: "masterusers",
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
    tableName: "item_visibility_rules",
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

module.exports = ItemVisibilityRule;
