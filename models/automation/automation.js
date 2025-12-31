const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Automation = sequelize.define(
  "Automation",
  {
    automationId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    automationData: {
        type: DataTypes.JSON,
        allowNull: false,
    },
    isActive:{
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue:true,
    },
    createdBy:{
        type: DataTypes.INTEGER,
        allowNull: false,
        // references: {
        //     model: 'admins',
        //     key: 'adminId',
        // },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "automations",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["automationId"],
        name: "automation_id",
      },
    ],
  }
);

module.exports = Automation;
