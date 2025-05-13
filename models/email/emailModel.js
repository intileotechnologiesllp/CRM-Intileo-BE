const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Attachment = require("../../models/email/attachmentModel");

const Email = sequelize.define("Email", {
  emailID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  messageId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  inReplyTo: {
    type: DataTypes.STRING, // Stores the messageId of the email being replied to
    allowNull: true,
  },
  sender: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  senderName: {
    type: DataTypes.STRING, // New field for sender's name
    allowNull: true,
  },
  recipient: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  recipientName: {
    type: DataTypes.STRING, // New field for recipient's name
    allowNull: true,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  folder: {
    type: DataTypes.ENUM("inbox", "drafts", "outbox", "sent", "archive"),
    allowNull: false,
    defaultValue: "inbox",
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  cc: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  bcc: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  references: {
    type: DataTypes.TEXT,
    allowNull: true, // Allow NULL values
  },
  masterUserID:{
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // draftId:{
  //   type: DataTypes.INTEGER,
  //   allowNull: true,
  // },
  // isDraft:{
  //   type: DataTypes.BOOLEAN,
  //   defaultValue: true,
  // },
//   isOpened: {
//   type: DataTypes.BOOLEAN,
//   defaultValue: false,
// },
// isClicked: {
//   type: DataTypes.BOOLEAN,
//   defaultValue: false,
// },
  
},
{
  indexes: [
    {

      fields: ["messageId", "folder"], // Composite unique index
    },
  ],

});

Email.hasMany(Attachment, { foreignKey: "emailID", as: "attachments" });
Attachment.belongsTo(Email, { foreignKey: "emailID" });

module.exports = Email;
