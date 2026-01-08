const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Follower = sequelize.define(
  "Follower",
  {
    followerId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.ENUM("deal", "lead", "person", "organization"),
      allowNull: false,
      comment: "Type of entity being followed (deal, lead, person, organization)",
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the entity being followed",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the user who is following",
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Master user/organization ID for multi-tenancy",
    },
    addedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When the user started following",
    },
    addedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID who added this follower (may be different from userId for bulk adds)",
    },
  },
  {
    tableName: "Followers",
    timestamps: true,
    createdAt: "addedAt",
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["entityType", "entityId", "userId"],
        name: "unique_follower_per_entity",
      },
      {
        fields: ["entityType", "entityId"],
        name: "idx_entity_followers",
      },
      {
        fields: ["userId"],
        name: "idx_user_following",
      },
      {
        fields: ["masterUserID"],
        name: "idx_follower_master_user",
      },
    ],
  }
);

module.exports = Follower;
