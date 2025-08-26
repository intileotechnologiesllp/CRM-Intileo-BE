const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Lead = require("../../models/leads/leadsModel");
const Deal = require("../../models/deals/dealsModels");
const Person = require("../../models/leads/leadPersonModel");
const MasterUser = require("../../models/master/masterUserModel");
const Organization = require("../../models/leads/leadOrganizationModel");

const Activity = sequelize.define(
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
      references: { model: "masterusers", key: "masterUserID" },
    },
    dealId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "deals", key: "dealId" },
      onDelete: "SET NULL",
    },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "leads", key: "leadId" },
      onDelete: "SET NULL",
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "leadpeople", key: "personId" },
      onDelete: "SET NULL",
    },
    leadOrganizationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "leadorganizations", key: "leadOrganizationId" },
      onDelete: "SET NULL",
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "masterusers", key: "masterUserID" },
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
  },
  {
    tableName: "Activities",
    timestamps: true,
  }
);


module.exports = Activity;
