// models/activitySettingModel.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const ActivitySetting = sequelize.define('ActivitySetting', {
  activitySettingId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    // comment: 'Company or admin ID for scoping settings',
  },
  showPopup: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Show schedule activity popup after marking done',
  },
  showType: {
    type: DataTypes.ENUM('always', 'pipelines'),
    defaultValue: 'always',
    allowNull: false,
    comment: 'Show popup always or only for specific pipelines',
  },
  pipelines: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of pipeline IDs if showType is pipelines',
  },
  defaultActivityType:{
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Task',
  },
  followUpTime: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'in 3 months',
  },
  allowUserDisable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }
}, {
  tableName: 'activity_settings',
  timestamps: true,
});

module.exports = ActivitySetting;
