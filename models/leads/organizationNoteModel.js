const { DataTypes } = require("sequelize");

const createOrganizationNoteModel = (sequelizeInstance) => {
const OrganizationNote = sequelizeInstance.define(
  "OrganizationNote",
  {
    noteId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    leadOrganizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "LeadOrganizations", key: "leadOrganizationId" },
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
    tableName: "OrganizationNotes",
    timestamps: true,
  }
);
return OrganizationNote;
}

module.exports = createOrganizationNoteModel;
