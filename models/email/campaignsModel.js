const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const EmailTemplate = require("./emailTemplateModel");
const MasterUser = require("../master/masterUserModel");

const Campaigns = sequelize.define(
  "Campaigns",
  {
    campaignId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    campaignName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    receivers: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sender: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    emailContent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: EmailTemplate,
        key: "templateId",
      },
    },
    sendingTime: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    Engagement: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    createdBy: {
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
    indexes: [
      {
        fields: ["templateId"], // Composite unique index
      },
    ],
  }
);

Campaigns.belongsTo(MasterUser, {
  foreignKey: "createdBy",
  as: "creator"
});

Campaigns.belongsTo(EmailTemplate, {
  foreignKey: "emailContent",
  as: "template"
});

module.exports = Campaigns;
