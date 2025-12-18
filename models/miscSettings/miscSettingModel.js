const { DataTypes } = require("sequelize");

const createMiscSettingModel = (sequelizeInstance) => {
  const MiscSetting = sequelizeInstance.define(
    "MiscSetting",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      maxImageSizeMB: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      }, // default 5MB
      allowedImageTypes: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "jpg,jpeg,png,gif",
      }, // comma-separated
    },
    {
      tableName: "MiscSettings",
      timestamps: true,
    }
  );
  return MiscSetting;
};

module.exports = createMiscSettingModel;
