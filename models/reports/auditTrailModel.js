const { DataTypes } = require("sequelize");

const createAuditTrailModel = (sequelizeInstance) => {
const AuditTrail = sequelizeInstance.define("AuditTrail", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  programId: {
    type: DataTypes.INTEGER,
    allowNull: true, // The ID of the program associated with the action
  },
  mode: {
    type: DataTypes.STRING(50), // Changed from ENUM to STRING for flexibility
    allowNull: true, // Allows storing any string value for the mode
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true, // The user who performed the action (e.g., email or userId)
  },
  error_desc: {
    type: DataTypes.TEXT,
    allowNull: true, // Error message if an error occurred
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: true, // The ID of the user who performed the action
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW, // Timestamp of the action
  },
},
{
  tableName: "AuditTrails",
  timestamps: true,
}
);
return AuditTrail
}

module.exports = createAuditTrailModel;
