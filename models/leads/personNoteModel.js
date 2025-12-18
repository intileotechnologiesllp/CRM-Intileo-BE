const { DataTypes } = require("sequelize");

const createPersonNoteModel = (sequelizeInstance) => {
const PersonNote = sequelizeInstance.define(
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
      references: { model: "LeadPersons", key: "personId" },
      onDelete: "CASCADE",
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "MasterUsers", key: "masterUserID" },
    },
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "MasterUsers", key: "masterUserID" },
    },
  },
  {
    tableName: "PersonNotes",
    timestamps: true,
  }
);
return PersonNote
}

module.exports = createPersonNoteModel;
