const { DataTypes } = require("sequelize");


const createLeadNoteModel = (sequelizeInstance) => {
  const LeadNote = sequelizeInstance.define("LeadNote", {
    noteId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    leadId: { type: DataTypes.INTEGER, allowNull: false },
    masterUserID: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT('long'), allowNull: false }, // 'long' for large notes
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: "LeadNotes",
    timestamps: true,
  }
);
  return LeadNote
}


  module.exports = createLeadNoteModel;