const { DataTypes } = require("sequelize");


const createProductColumnModel = (sequelizeInstance) => {
const ProductColumn = sequelizeInstance.define(
  "ProductColumn",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    columns: { type: DataTypes.JSON, allowNull: false }, // Array of column keys/ids
  },
  {
    tableName: "ProductColumns",
    timestamps: true,
  }
);
return ProductColumn
}

module.exports = createProductColumnModel;