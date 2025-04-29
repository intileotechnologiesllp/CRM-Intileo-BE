const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Attachment = sequelize.define("Attachment", {
  attachmentID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  emailID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Emails", // Name of the Email table
      key: "emailID",
    },
    onDelete: "CASCADE", // Delete attachments if the associated email is deleted
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contentType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = Attachment;
