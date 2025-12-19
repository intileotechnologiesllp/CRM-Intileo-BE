const { DataTypes } = require("sequelize");


const createDeviceActivityModel = (sequelizeInstance) => {
const DeviceActivity = sequelizeInstance.define("DeviceActivity", {
  device: {
    type: DataTypes.STRING(100),
  },
  Location: {
    type: DataTypes.STRING(100),
  },
  ipAddress: {
    type: DataTypes.STRING(100),
  },
  loginTime: {
    type: DataTypes.STRING(100),
  },
  loginVia: {
    type: DataTypes.STRING(100),
  },
  loginOut: {
    type: DataTypes.STRING(100),
  },
  isActive: {
    type: DataTypes.BOOLEAN,
  },
},
 {
    tableName: "DeviceActivities",
    timestamps: true,
  }
);
return DeviceActivity
}

module.exports = createDeviceActivityModel;
