const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Activity = require("../activity/activityModel");
const MasterUser = require("../master/masterUserModel");

const Meeting = sequelize.define(
  "Meeting",
  {
    meetingId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    activityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "Activities", key: "activityId" },
      onDelete: "CASCADE",
    },
    timezone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "UTC",
      comment: "Timezone for the meeting (e.g., 'America/New_York', 'Asia/Kolkata')",
    },
    meetingStatus: {
      type: DataTypes.ENUM("scheduled", "confirmed", "cancelled", "completed", "no_show"),
      allowNull: false,
      defaultValue: "scheduled",
      comment: "Current status of the meeting",
    },
    recurrenceRule: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "iCal RRULE format string for recurring meetings (e.g., 'FREQ=DAILY;INTERVAL=1;COUNT=5')",
    },
    recurrenceEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "End date for recurring meetings",
    },
    reminderMinutes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON array of reminder times in minutes before meeting (e.g., '[15, 60]')",
    },
    meetingUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL for video conference (Zoom, Teams, Google Meet, etc.)",
    },
    organizerEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Email of the meeting organizer",
    },
    organizerName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Name of the meeting organizer",
    },
    icsUid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "Unique identifier for calendar invite (ICS UID)",
    },
    sendInvites: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether to send email invites to attendees",
    },
    lastSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When invites were last sent",
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the meeting was cancelled",
    },
    cancelledBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "masterusers", key: "masterUserID" },
      comment: "User who cancelled the meeting",
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for cancellation",
    },
    externalAttendees: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON array of external attendees not in CRM (e.g., [{\"name\": \"John\", \"email\": \"john@example.com\"}])",
    },
    meetingNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Post-meeting notes and follow-ups",
    },
    followUpRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether a follow-up is required",
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "masterusers", key: "masterUserID" },
      onDelete: "CASCADE",
    },
  },
  {
    tableName: "Meetings",
    timestamps: true,
    indexes: [
      {
        fields: ["activityId"],
        unique: true,
      },
      {
        fields: ["meetingStatus"],
      },
      {
        fields: ["masterUserID"],
      },
      {
        fields: ["icsUid"],
      },
    ],
  }
);

// Associations
Meeting.belongsTo(Activity, {
  foreignKey: "activityId",
  as: "activity",
  onDelete: "CASCADE",
});

Activity.hasOne(Meeting, {
  foreignKey: "activityId",
  as: "meeting",
});

Meeting.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  as: "owner",
});

Meeting.belongsTo(MasterUser, {
  foreignKey: "cancelledBy",
  as: "cancelledByUser",
});

module.exports = Meeting;

