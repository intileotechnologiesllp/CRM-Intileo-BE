const { DataTypes } = require("sequelize");
// const MasterUser = require("../master/masterUserModel");

const createNotificationPreferenceModel = (sequelizeInstance) => {
const NotificationPreference = sequelizeInstance.define(
  "NotificationPreference",
  {
    preferenceId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "MasterUsers",
        key: "masterUserID",  // Fixed: Use correct primary key
      },
      comment: "User who owns these preferences",
    },
    // In-App Notification Preferences
    inAppEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Master toggle for in-app notifications",
    },
    inAppDealCreated: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppDealUpdated: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppDealAssigned: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppDealWon: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppDealLost: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppLeadCreated: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppLeadAssigned: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppActivityCreated: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppActivityAssigned: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppActivityDue: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppEmailReceived: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppMention: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    inAppComment: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Push Notification Preferences
    pushEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Master toggle for push notifications",
    },
    pushDealCreated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    pushDealAssigned: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pushDealWon: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pushActivityAssigned: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pushActivityDue: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pushEmailReceived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    pushMention: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Email Notification Preferences
    emailEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Master toggle for email notifications",
    },
    emailDigestFrequency: {
      type: DataTypes.ENUM("none", "immediate", "daily", "weekly"),
      defaultValue: "daily",
      comment: "Email digest frequency",
    },
    emailDealAssigned: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    emailActivityDue: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    emailMention: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Notification Grouping Settings
    groupSimilarNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Group similar notifications together",
    },
    muteUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Mute all notifications until this time",
    },
    quietHoursStart: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: "Start time for quiet hours (e.g., 22:00)",
    },
    quietHoursEnd: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: "End time for quiet hours (e.g., 08:00)",
    },
  },
  {
    tableName: "NotificationPreferences",
    timestamps: true,
  }
);
return NotificationPreference
}

// Association
// NotificationPreference.belongsTo(MasterUser, {
//   foreignKey: "userId",
//   targetKey: "masterUserID",  // Specify the correct primary key in MasterUsers table
//   as: "user",
// });

module.exports = createNotificationPreferenceModel;
