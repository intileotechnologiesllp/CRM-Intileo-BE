const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const OrganizationNote = sequelize.define(
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
      references: { model: "leadorganizations", key: "leadOrganizationId" },
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
    tableName: "OrganizationNotes",
    timestamps: true,
  }
);

OrganizationNote.associate = (models) => {
  OrganizationNote.belongsTo(models.Organization, {
    foreignKey: "leadOrganizationId",
    as: "organization",
  });
  OrganizationNote.belongsTo(models.MasterUser, {
    foreignKey: "createdBy",
    as: "creator",
  });
};

module.exports = OrganizationNote;
