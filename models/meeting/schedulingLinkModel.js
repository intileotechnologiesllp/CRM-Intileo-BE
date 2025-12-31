const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const MasterUser = require("../master/masterUserModel");

const SchedulingLink = sequelize.define(
  "SchedulingLink",
  {
    linkId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: MasterUser, key: "masterUserID" },
      onDelete: "CASCADE",
    },
    uniqueToken: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "Unique token for the booking link",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "Schedule a Meeting",
      comment: "Title displayed on the scheduling page",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Description shown to invitees",
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Duration of meetings in minutes",
    },
    timezone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "UTC",
      comment: "Timezone for displaying available slots",
    },
    bufferTimeBefore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Buffer time in minutes before each meeting",
    },
    bufferTimeAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Buffer time in minutes after each meeting",
    },
    advanceBookingDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "How many days in advance can meetings be booked",
    },
    workingHours: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON string of working hours per day of week",
      // Example: {"0": {"start": "09:00", "end": "17:00"}, "1": {"start": "09:00", "end": "17:00"}}
      // 0 = Sunday, 1 = Monday, etc.
    },
    meetingLocation: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Default location for meetings (can be overridden)",
    },
    requireEmail: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether email is required to book",
    },
    requireName: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether name is required to book",
    },
    requirePhone: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether phone is required to book",
    },
    customFields: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON array of custom fields to collect",
    },
    autoConfirm: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Automatically confirm bookings",
    },
    sendReminderEmail: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Send reminder email before meeting",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether the scheduling link is active",
    },
    bookingCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of meetings booked through this link",
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When this link was last used",
    },
  },
  {
    tableName: "SchedulingLinks",
    timestamps: true,
    indexes: [
      {
        fields: ["uniqueToken"],
        unique: true,
      },
      {
        fields: ["masterUserID"],
      },
      {
        fields: ["isActive"],
      },
    ],
  }
);

// Associations
SchedulingLink.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  as: "owner",
});

MasterUser.hasMany(SchedulingLink, {
  foreignKey: "masterUserID",
  as: "schedulingLinks",
});

SchedulingLink.sync({alter: false});

module.exports = SchedulingLink;

