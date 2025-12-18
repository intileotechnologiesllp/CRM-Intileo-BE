// models/activitySettingModel.js
const { DataTypes } = require('sequelize');


const createActivitySettingModel = (sequelizeInstance) => {
const ActivitySetting = sequelizeInstance.define('ActivitySetting', {
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
  },
  // Deal won popup settings
  showDealWonPopup: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Show schedule activity popup after marking deal as won',
  },
  dealWonActivityType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Task',
    comment: 'Default activity type for deal won popup',
  },
  dealWonFollowUpTime: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'in 3 months',
    comment: 'Default follow-up time for deal won popup',
  },
  allowUserDisableDealWon: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Allow users to disable deal won popup',
  }
}, {
  tableName: 'ActivitySettings',
  timestamps: true,
});
return ActivitySetting
}

module.exports = createActivitySettingModel;
