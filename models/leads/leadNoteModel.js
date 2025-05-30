
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db"); // adjust path as needed


  const LeadNote = sequelize.define("LeadNote", {
    noteId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    leadId: { type: DataTypes.INTEGER, allowNull: false },
    masterUserID: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT('long'), allowNull: false }, // 'long' for large notes
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
  });


  module.exports = LeadNote;