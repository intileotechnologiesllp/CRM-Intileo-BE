const { DataTypes } = require("sequelize");


const createCardModel = (sequelizeInstance) => {
const Card = sequelizeInstance.define(
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
    uniqueId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    coordinates: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "Cards",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['uniqueId', 'type', 'dashboardId']
      }
    ]
  }
);
return Card
}

module.exports = createCardModel;
