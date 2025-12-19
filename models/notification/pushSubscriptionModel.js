const { DataTypes } = require("sequelize");
// const MasterUser = require("../master/masterUserModel");

const createPushSubscriptionModel = (sequelizeInstance) => {
const PushSubscription = sequelizeInstance.define(
  "PushSubscription",
  {
    subscriptionId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",  // Fixed: Use correct primary key
      },
      comment: "User who owns this subscription",
    },
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Push service endpoint URL",
    },
    keys: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "Subscription keys (p256dh and auth)",
    },
    deviceInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Device/browser information",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether subscription is active",
    },
    lastUsed: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last time a push was sent to this subscription",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Subscription expiration time",
    },
  },
  {
    tableName: "PushSubscriptions",
    timestamps: true,
    indexes: [
      {
        fields: ["userId"],
        name: "idx_user",
      },
      {
        unique: true,
        fields: ["endpoint"],
        name: "idx_endpoint_unique",
      },
    ],
  }
);
return PushSubscription
}

// Association
// PushSubscription.belongsTo(MasterUser, {
//   foreignKey: "userId",
//   targetKey: "masterUserID",  // Specify the correct primary key in MasterUsers table
//   as: "user",
// });

module.exports = createPushSubscriptionModel;
