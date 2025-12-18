const { DataTypes } = require("sequelize");

const createAdminModel = (sequelizeInstance) => {
  const Admin = sequelizeInstance.define(
    "Admin",
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      otp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otpExpiration: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      loginType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "Admins",
      timestamps: true,
    }
  );
   return Admin;
};

module.exports = createAdminModel;
