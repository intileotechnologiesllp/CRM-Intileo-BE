// models/deals/lostReasonModel.js
const { DataTypes } = require('sequelize');


const createLostReasonModel = (sequelizeInstance) => {
const LostReason = sequelizeInstance.define('LostReason', {
  lostReasonId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Lost reason cannot be empty'
      },
      len: {
        args: [1, 255],
        msg: 'Lost reason must be between 1 and 255 characters'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: true, // Allow null for system-wide reasons
  },
  isSystemDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Mark system-provided reasons
  }
}, {
  tableName: 'LostReasons',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['reason', 'masterUserID'],
      name: 'unique_reason_per_user'
    },
    {
      fields: ['isActive'],
      name: 'idx_lost_reason_active'
    },
    {
      fields: ['sortOrder'],
      name: 'idx_lost_reason_sort'
    }
  ]
});
return LostReason
}

module.exports = createLostReasonModel;