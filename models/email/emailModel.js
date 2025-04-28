const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Email = sequelize.define("Email", {
  emailID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  messageId: {
    type: DataTypes.STRING,
    unique: true, // Ensure no duplicate emails
    allowNull: false,
  },
  sender: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  recipient: {
    type: DataTypes.STRING,
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
});

module.exports = Email;
