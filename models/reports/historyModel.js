const { DataTypes } = require("sequelize");

const createHistoryModel = (sequelizeInstance) => {
const History = sequelizeInstance.define("History", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  programId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING,
    allowNull: false, // Mode (e.g., CREATE, UPDATE, DELETE)
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true, // ID of the user being modified
  },
  recordId:{
    type: DataTypes.INTEGER,
    allowNull: true, // ID of the record being modified
  },
  modifiedBy: {
    type: DataTypes.INTEGER,
    allowNull: true, // ID of the admin making the change
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true, // Description of the change
  },
  changes: {
    type: DataTypes.JSON, // JSON object to store modified data
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW, // Timestamp of the change
  },
},
{
  tableName: "Histories",
  timestamps: true,
}
);
return History
}

module.exports = createHistoryModel;
