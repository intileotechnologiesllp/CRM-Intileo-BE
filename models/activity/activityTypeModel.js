// models/activitySettingModel.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const ActivityType = sequelize.define('ActivityType', {
  activityTypeId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
name:{
    type: DataTypes.STRING,
    allowNull: false,
  },
    icon: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'activity_types',
  timestamps: true,
});

module.exports = ActivityType;