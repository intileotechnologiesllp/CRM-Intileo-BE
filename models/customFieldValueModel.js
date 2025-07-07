const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const CustomFieldValue = sequelize.define(
  "CustomFieldValue",
  {
    valueId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fieldId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "CustomFields",
        key: "fieldId",
      },
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the lead, deal, person, etc.",
    },
    entityType: {
      type: DataTypes.ENUM(
        "lead",
        "deal",
        "person",
        "organization",
        "activity"
      ),
      allowNull: false,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment:
        "Stored as JSON for complex values, plain text for simple values",
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "CustomFieldValues",
    timestamps: true,
    indexes: [
      {
        fields: ["fieldId", "entityId", "entityType"],
        unique: true,
      },
      {
        fields: ["entityType", "entityId"],
      },
    ],
  }
);

module.exports = CustomFieldValue;
