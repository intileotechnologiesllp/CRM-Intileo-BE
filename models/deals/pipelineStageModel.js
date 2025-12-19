const { DataTypes } = require("sequelize");


const createPipelineStageModel = (sequelizeInstance) => {
const PipelineStage = sequelizeInstance.define(
  "PipelineStage",
  {
    stageId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pipelineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Pipelines",
        key: "pipelineId",
      },
    },
    stageName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    stageOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    probability: {
      type: DataTypes.DECIMAL(5, 2), // 0.00 to 100.00
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0,
        max: 100,
      },
    },
    dealRottenDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "Number of days after which deals in this stage are considered rotten",
    },
    color: {
      type: DataTypes.STRING(7), // For hex color codes
      defaultValue: "#28A745",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
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
    tableName: "PipelineStages",
    timestamps: true,
    indexes: [
      {
        fields: ["pipelineId"],
      },
      {
        fields: ["masterUserID"],
      },
      {
        fields: ["isActive"],
      },
      {
        fields: ["stageOrder"],
      },
    ],
  }
);
return PipelineStage
}

module.exports = createPipelineStageModel;
