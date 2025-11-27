const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const PersonNote = sequelize.define(
  "PersonNote",
  {
    noteId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "leadpeople", key: "personId" },
      onDelete: "CASCADE",
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "masterusers", key: "masterUserID" },
    },
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "masterusers", key: "masterUserID" },
    },
  },
  {
    tableName: "PersonNotes",
    timestamps: true,
  }
);

module.exports = PersonNote;
