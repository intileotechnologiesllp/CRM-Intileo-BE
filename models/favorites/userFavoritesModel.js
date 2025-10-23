const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const UserFavorites = sequelize.define(
  "UserFavorites",
  {
    favoriteId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the user who is creating the favorite"
    },
    favoriteUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the user being favorited (masterUserID)"
    },
    nickname: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Custom nickname for the favorite user"
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Soft delete flag"
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    tableName: "user_favorites",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'favoriteUserId'],
        name: 'unique_user_favorite'
      },
      {
        fields: ['userId'],
        name: 'idx_user_favorites_user_id'
      },
      {
        fields: ['favoriteUserId'],
        name: 'idx_user_favorites_favorite_user_id'
      },
      {
        fields: ['isActive'],
        name: 'idx_user_favorites_is_active'
      }
    ]
  }
);

module.exports = UserFavorites;