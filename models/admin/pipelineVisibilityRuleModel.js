const { DataTypes } = require("sequelize");


const createPipelineVisibilityRuleModel = (sequelizeInstance) => {
const PipelineVisibilityRule = sequelizeInstance.define(
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
        model: "GroupVisibilities",
        key: "groupId",
      },
    },
    pipelineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Pipelines",
        key: "pipelineId",
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
    tableName: "PipelineVisibilityRules",
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

return PipelineVisibilityRule
}

module.exports = createPipelineVisibilityRuleModel;
