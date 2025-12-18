const { DataTypes } = require("sequelize");


const createActivityColumnModel = (sequelizeInstance) => {
const ActivityColumn = sequelizeInstance.define(
  "ActivityColumn",
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
    tableName: "ActivityColumns",
    timestamps: true,
  }
);
return ActivityColumn
}

module.exports = createActivityColumnModel;
