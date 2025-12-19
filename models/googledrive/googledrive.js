const { DataTypes } = require("sequelize");

const createUserGoogleTokenModel = (sequelizeInstance) => {
const UserGoogleToken = sequelizeInstance.define("UserGoogleToken", {
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
},
{
    tableName: "UserGoogleTokens",
    timestamps: true,
  }
);
return UserGoogleToken
}

UserGoogleToken.sync({});
module.exports = createUserGoogleTokenModel;
