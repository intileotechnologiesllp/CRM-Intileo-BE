const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const LostReason = sequelize.define('LostReason', {
  lostReasonId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reason: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'lost_reasons',
  timestamps: true,
});

module.exports = LostReason;