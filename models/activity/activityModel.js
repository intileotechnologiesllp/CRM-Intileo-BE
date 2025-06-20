const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Lead = require("../../models/leads/leadsModel");
const Deal = require("../../models/deals/dealsModels");
const Person = require("../../models/leads/leadPersonModel");

const Activity = sequelize.define("Activity", {
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
  references: { model: "LeadPeople", key: "personId" },
  onDelete: "SET NULL",
},
leadOrganizationId: {
  type: DataTypes.INTEGER,
  allowNull: true,
  references: { model: "Organizations", key: "leadOrganizationId" },
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
}, {
  tableName: "Activities",
  timestamps: true,
});

Activity.associate = (models) => {
  Activity.belongsTo(models.Person, { foreignKey: "assignedTo", as: "assignee" });
  Activity.belongsTo(models.Deal, { foreignKey: "dealId", as: "deal" });
  Activity.belongsTo(models.Lead, { foreignKey: "leadId", as: "lead" });
};

module.exports = Activity;