const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Pipeline = sequelize.define(
  "Pipeline",
  {
    pipelineId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pipelineName: {
      type: DataTypes.STRING(100),
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
    color: {
      type: DataTypes.STRING(7), // For hex color codes like #FF5733
      defaultValue: "#007BFF",
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "masterusers",
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
    tableName: "pipelines",
    timestamps: true,
    indexes: [
      {
        fields: ["masterUserID"],
      },
      {
        fields: ["isActive"],
      },
      {
        fields: ["isDefault"],
      },
    ],
  }
);

module.exports = Pipeline;
