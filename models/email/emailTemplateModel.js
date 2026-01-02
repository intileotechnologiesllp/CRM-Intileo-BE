const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Attachment = require("../../models/email/attachmentModel");

const createEmailTemplateModel = (sequelizeInstance) => {
const EmailTemplate = sequelizeInstance.define(
  "EmailTemplate",
  {
    templateId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    templateName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
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
return EmailTemplate;
}

module.exports = createEmailTemplateModel;
