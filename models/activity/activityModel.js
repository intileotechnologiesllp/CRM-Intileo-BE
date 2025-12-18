const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Lead = require("../../models/leads/leadsModel");
const Deal = require("../../models/deals/dealsModels");
const Person = require("../../models/leads/leadPersonModel");
const MasterUser = require("../../models/master/masterUserModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const User = require("../../models/master/masterUserModel");
const {
  syncActivityToGoogleCalendar,
} = require("../../utils/googleCalendarSync");

const createActivityModel = (sequelizeInstance) => {
  const Activity = sequelizeInstance.define(
    "Activity",
    {
      activityId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: {
        type: DataTypes.STRING, // Meeting, Task, Deadline, Email, etc.
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      startDateTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endDateTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      priority: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      guests: {
        type: DataTypes.TEXT, // Comma-separated or JSON string of emails
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      videoCallIntegration: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING, // Free/Busy
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      assignedTo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "MasterUsers", key: "masterUserID" },
      },
      dealId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Deals", key: "dealId" },
        onDelete: "SET NULL",
      },
      leadId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Leads", key: "leadId" },
        onDelete: "SET NULL",
      },
      personId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "LeadPersons", key: "personId" },
        onDelete: "SET NULL",
      },
      leadOrganizationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "LeadOrganizations", key: "leadOrganizationId" },
        onDelete: "SET NULL",
      },
      masterUserID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "MasterUsers", key: "masterUserID" },
        onDelete: "CASCADE",
      },
      isDone: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      contactPerson: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      organization: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      markedAsDoneTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      calendar_event_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      activityTypeFlag: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "time", // 👈 default value added here
      },
      allContactPersons: {
        type: DataTypes.TEXT, // JSON string to store multiple contact persons
        allowNull: true,
        comment:
          "Stores JSON array of multiple contact persons associated with this activity",
      },
    },
    {
      tableName: "Activities",
      timestamps: true,
    }
  );
  return Activity;
};

// Activity.afterCreate(async (activity, options) => {
//   try {
//     // Fetch user's OAuth token (from DB or session)
//     const user = await User.findByPk(activity.masterUserID);
//     if (!user || !user.googleOAuthToken) return;

//     // Sync to Google Calendar
//     const eventId = await syncActivityToGoogleCalendar(activity, user.googleOAuthToken);

//     // Save calendar_event_id for future updates/deletes
//     activity.calendar_event_id = eventId;
//     await activity.save();
//   } catch (err) {
//     console.error('Google Calendar sync failed:', err);
//     // Optionally log error or notify user
//   }
// });

Activity.afterCreate(async (activity, options) => {
  try {
    // Fetch user's OAuth token (from DB or session)
    const user = await User.findByPk(activity.masterUserID);
    if (!user || !user.googleOAuthToken) return;

    // Parse the token if it's a string
    let tokenObj;
    if (typeof user.googleOAuthToken === "string") {
      try {
        tokenObj = JSON.parse(user.googleOAuthToken);
      } catch (e) {
        tokenObj = {};
      }
    } else {
      tokenObj = user.googleOAuthToken;
    }

    // Use only the access_token
    const accessToken = tokenObj.access_token;
    if (!accessToken) return;

    // Sync to Google Calendar
    const eventId = await syncActivityToGoogleCalendar(activity, accessToken);

    // Save calendar_event_id for future updates/deletes
    activity.calendar_event_id = eventId;
    await activity.save();
  } catch (err) {
    console.error("Google Calendar sync failed:", err);
    // Optionally log error or notify user
  }
});

module.exports = createActivityModel;
