const { DataTypes } = require("sequelize");


const createDealColumnModel = (sequelizeInstance) => {
const DealColumn = sequelizeInstance.define(
  "DealColumn",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "MasterUsers", key: "masterUserID" },
    },
    columns: { type: DataTypes.JSON, allowNull: false }, // Array of column keys/ids
  },
  {
    tableName: "DealColumns",
    timestamps: true,
  }
);
return DealColumn
}

module.exports = createDealColumnModel;
