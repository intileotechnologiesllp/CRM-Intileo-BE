// models/activitySettingModel.js
const { DataTypes } = require('sequelize');


const createActivityTypeModel = (sequelizeInstance) => {
const ActivityType = sequelizeInstance.define('ActivityType', {
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
}, 
{
  tableName: 'ActivityTypes',
  timestamps: true,
});
return ActivityType
}


module.exports = createActivityTypeModel;