const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const PipelineVisibilityRule = sequelize.define(
  "PipelineVisibilityRule",
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
    pipelineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pipelines",
        key: "pipelineId",
      },
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "masterusers",
        key: "masterUserID",
      },
    },
    canView: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    canEdit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    canDelete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    canCreateDeals: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: "pipeline_visibility_rules",
    timestamps: true,
    indexes: [
      {
        fields: ["groupId"],
      },
      {
        fields: ["pipelineId"],
      },
      {
        fields: ["masterUserID"],
      },
      {
        unique: true,
        fields: ["groupId", "pipelineId"],
        name: "unique_group_pipeline_rule",
      },
    ],
  }
);

module.exports = PipelineVisibilityRule;
