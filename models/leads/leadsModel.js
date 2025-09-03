// const { DataTypes } = require("sequelize");
// const sequelize = require("../../config/db");
// const LeadDetails = require("./leadDetailsModel"); // Import the LeadDetails model
// const { number } = require("joi");
const Organization = require("../../models/leads/leadOrganizationModel");
const Person = require("../../models/leads/leadPersonModel"); // Import the Person model
const Deal = require("../../models/deals/dealsModels");
const MasterUser = require("../../models/deals/dealsModels");
//.........................new changes original.....................................

const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const LeadDetails = require("./leadDetailsModel"); // Import the LeadDetails model
const { number } = require("joi");
// const { Organization } = require("..");
const Lead = sequelize.define("Lead", {
  // Primary Key
  leadId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  personId: {
    type: DataTypes.INTEGER,
    references: {
      model: Person,
      key: "personId",
    },
    allowNull: true,
  },
  leadOrganizationId: {
    type: DataTypes.INTEGER,
    references: {
      model: "leadOrganizations", // Name of the Organization table
      key: "leadOrganizationId",
    },
    allowNull: true,
  },

  // Contact Information
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: true, // Name of the contact person
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
    // defaultValue: "", // Default to an empty string
    // comment: "JSON array to store multiple phone numbers",
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true, // Email address of the person
  // defaultValue: [], // Default to an empty array
  // comment: "JSON array to store multiple email addresses",
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
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false, // User ID of the creator (e.g., admin)
    // references: { model: "masterusers", key: "masterUserID" },
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Default to false (not archived)
  },
  archiveTime: {
    type: DataTypes.DATE,
    allowNull: true, // The date/time when the lead was archived
  },
  questionShared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Default to false (not shared)
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Owner ID of the lead
  },
  ownerName: {
    type: DataTypes.STRING,
    allowNull: true, // Owner name of the lead
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
  SBUClass: {
    type: DataTypes.STRING,
    allowNull: true, // SBU Class of the lead
  },
  numberOfReportsPrepared: {
    type: DataTypes.INTEGER,
    allowNull: true, // Number of reports prepared for the project
  },
  sectoralSector: {
    type: DataTypes.STRING,
    allowNull: true, // Sectoral sector of the lead
  },
  seen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Default to false (not seen)
  },
  visibleTo: {
    type: DataTypes.STRING,
    allowNull: true, // Visibility of the lead (e.g., "Public", "Private")
  },
  sourceOrigin: {
    type: DataTypes.STRING,
    allowNull: true, // Source origin of the lead
  },
  dealId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Reference to associated deal when lead is converted",
    // references: { model: "deals", key: "dealId" },
  },

  // Lead-specific tracking fields
  sourceOriginID: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "ID reference for the source origin",
  },
  leadQuality: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Quality rating of the lead (hot, warm, cold)",
  },
  isQualified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether the lead has been qualified for conversion to deal",
  },
  qualificationDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "Date when the lead was qualified",
  },
  conversionDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "Date when the lead was converted to a deal",
  },
  value: {
    type: DataTypes.FLOAT,
    allowNull: true, // Value of the lead
  },
  proposalValueCurrency: {
    type: DataTypes.STRING,
    allowNull: true, // Currency for the proposal value
    defaultValue: "INR", // Default to INR
  },
  valueCurrency: {
    type: DataTypes.STRING,
    allowNull: true, // Currency for the lead value
    defaultValue: "INR", // Default to INR
  },

  // Visibility management fields
  visibilityLevel: {
    type: DataTypes.ENUM(
      "owner_only",
      "group_only",
      "everyone",
      "item_owners_visibility_group"
    ),
    defaultValue: "item_owners_visibility_group",
    comment: "Visibility level for the lead",
  },
  visibilityGroupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "GroupVisibility",
      key: "groupId",
    },
    comment: "Reference to the owner's visibility group",
  },
});


module.exports = Lead;