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
      references: {
        model: "Activities",
        key: "activityId",
      },
      // onDelete: "CASCADE",
      // onUpdate: "CASCADE",
    },

    timezone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "UTC",
      comment:
        "Timezone for the meeting (e.g., 'America/New_York', 'Asia/Kolkata')",
    },

    meetingStatus: {
      type: DataTypes.ENUM(
        "scheduled",
        "confirmed",
        "cancelled",
        "completed",
        "no_show"
      ),
      allowNull: false,
      defaultValue: "scheduled",
      comment: "Current status of the meeting",
    },

    recurrenceRule: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment:
        "iCal RRULE format string (e.g., 'FREQ=WEEKLY;INTERVAL=1;COUNT=5')",
    },

    recurrenceEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "End date for recurring meetings",
    },

    reminderMinutes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of reminder times in minutes (e.g., [15, 60])",
    },

    meetingUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Video conference URL",
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
      comment: "Unique calendar invite UID (ICS)",
    },

    sendInvites: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether email invites should be sent",
    },

    lastSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Last time calendar invites were sent",
    },

    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the meeting was cancelled",
    },

    cancelledBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "masterusers",
        key: "masterUserID",
      },
      // onDelete: "SET NULL",
      // onUpdate: "CASCADE",
      comment: "User who cancelled the meeting",
    },

    cancellationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for cancellation",
    },

    externalAttendees: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "External attendees (e.g., [{ name: 'John', email: 'john@example.com' }])",
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
      references: {
        model: "masterusers",
        key: "masterUserID",
      },
      // onDelete: "CASCADE",
      // onUpdate: "CASCADE",
    },
  },
  {
    tableName: "Meetings",
    timestamps: true,
    indexes: [
      { fields: ["activityId"], unique: true },
      { fields: ["meetingStatus"] },
      { fields: ["masterUserID"] },
      { fields: ["icsUid"] },
    ],
  }
);

/* =======================
   Associations
======================= */

// Meeting.belongsTo(Activity, {
//   foreignKey: "activityId",
//   as: "activity",
// });

// Activity.hasOne(Meeting, {
//   foreignKey: "activityId",
//   as: "meeting",
// });

// Meeting.belongsTo(MasterUser, {
//   foreignKey: "masterUserID",
//   as: "owner",
// });

// Meeting.belongsTo(MasterUser, {
//   foreignKey: "cancelledBy",
//   as: "cancelledByUser",
// });

// module.exports = Meeting;  
