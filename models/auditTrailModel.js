const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AuditTrail = sequelize.define("AuditTrail", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  entity: {
    type: DataTypes.STRING,
    allowNull: false, // The entity being modified (e.g., "Admin", "GeneralUser")
  },
  action: {
    type: DataTypes.ENUM("CREATE", "UPDATE", "DELETE", "SIGN_IN", "SIGN_OUT"),
    allowNull: false, // The type of action performed
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: true, // The ID of the entity being modified
  },
  performedBy: {
    type: DataTypes.STRING,
    allowNull: true, // The user who performed the action (e.g., email or userId)
  },

  changes: {
    type: DataTypes.JSON,
    allowNull: true, // JSON object to store the changes made
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW, // Timestamp of the action
  },
});

module.exports = AuditTrail;
