const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Card = sequelize.define(
  "Card",
  {
    cardId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dashboardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "Cards",
    timestamps: true,
  }
);

module.exports = Card;
