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
    content: {
      type: DataTypes.TEXT,
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

PersonNote.associate = (models) => {
  PersonNote.belongsTo(models.Person, { foreignKey: "personId", as: "person" });
  PersonNote.belongsTo(models.MasterUser, {
    foreignKey: "createdBy",
    as: "creator",
  });
};

module.exports = PersonNote;
