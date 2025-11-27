// models/deals/lostReasonSettingModel.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const LostReasonSetting = sequelize.define('LostReasonSetting', {
  settingId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: true, // Allow null for global settings
  },
  allowFreeFormReasons: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  requireReasonSelection: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  isGlobal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  }
}, {
  tableName: 'lost_reason_settings',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['masterUserID'],
      name: 'unique_setting_per_user'
    },
    {
      fields: ['isGlobal'],
      name: 'idx_lost_reason_setting_global'
    }
  ]
});

module.exports = LostReasonSetting;