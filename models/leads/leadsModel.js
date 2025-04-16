const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Lead = sequelize.define("Lead", {
  // Primary Key
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  // Contact Information
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: false, // Name of the contact person
  },
  organization: {
    type: DataTypes.STRING,
    allowNull: true, // Organization name
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true, // Title of the lead
  },
  valueLabels: {
    type: DataTypes.STRING,
    allowNull: true, // Value labels for categorization
  },
  expectedCloseDate: {
    type: DataTypes.DATE,
    allowNull: true, // Expected close date for the lead
  },
  sourceChannel: {
    type: DataTypes.STRING,
    allowNull: true, // Source channel (e.g., website, referral)
  },
  sourceChannelID: {
    type: DataTypes.STRING,
    allowNull: true, // ID of the source channel
  },
  serviceType: {
    type: DataTypes.STRING,
    allowNull: true, // Type of service requested
  },
  scopeOfServiceType: {
    type: DataTypes.STRING,
    allowNull: true, // Scope of the service type
  },

  // Person Information
  phone: {
    type: DataTypes.STRING,
    allowNull: true, // Phone number of the person
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true, // Email address of the person
    validate: {
      isEmail: true, // Ensure valid email format
    },
  },
  company: {
    type: DataTypes.STRING,
    allowNull: true, // Company name
  },
  proposalValue: {
    type: DataTypes.FLOAT,
    allowNull: true, // Proposal value in currency
  },
  esplProposalNo: {
    type: DataTypes.STRING,
    allowNull: true, // ESPL proposal number
  },
  projectLocation: {
    type: DataTypes.STRING,
    allowNull: true, // Location of the project
  },
  organizationCountry: {
    type: DataTypes.STRING,
    allowNull: true, // Country of the organization
  },
  proposalSentDate: {
    type: DataTypes.DATE,
    allowNull: true, // Date when the proposal was sent
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false, // User ID of the creator (e.g., admin)
  },
  

  // Timestamps
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = Lead;
