const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const EmailTemplate = require("./emailTemplateModel");
const Campaigns = require("./campaignsModel");

const CampaignsSender = sequelize.define(
  "CampaignsSender",
  {

    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    campaignId: {
      type: DataTypes.INTEGER,
      references:{
        model: Campaigns,
        key: 'campaignId',
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    replyToMail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    indexes: [
      {
        fields: ["id"], // Composite unique index
      },
    ],
  }
);

CampaignsSender.sync({alter: false})

module.exports = CampaignsSender;
