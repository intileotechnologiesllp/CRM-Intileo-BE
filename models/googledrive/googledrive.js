const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const UserGoogleToken = sequelize.define("UserGoogleToken", {
  id:{
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // REQUIRED for upsert!
  },
  accessToken: DataTypes.TEXT,
  refreshToken: DataTypes.TEXT,
  expiryDate: DataTypes.DATE,
});

UserGoogleToken.sync({});
module.exports = UserGoogleToken;
