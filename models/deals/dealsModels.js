const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Lead = require("../leads/leadsModel");
const Person = require("../leads/leadPersonModel");
const Organization = require("../leads/leadOrganizationModel");

const Deal = sequelize.define("Deal", {
  dealId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    references: {
      model: Lead,
      key: "leadId"
    },
    allowNull: true,
  },
  personId: {
    type: DataTypes.INTEGER,
    references: {
      model: Person,
      key: "personId"
    },
    allowNull: true,
  },
  leadOrganizationId: {
    type: DataTypes.INTEGER,
    references: {
      model: Organization,
      key: "leadOrganizationId"
    },
    allowNull: true,
  },
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  organization: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pipeline: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pipelineStage: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expectedCloseDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sourceChannel: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sourceChannelId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  serviceType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  proposalValue: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  proposalCurrency: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  esplProposalNo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  projectLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  organizationCountry: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  proposalSentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sourceRequired: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  questionerShared: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sectorialSector: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sbuClass: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: true },
  },
  sourceOrgin: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Default to false (not archived)
  },
  status:{
    type: DataTypes.STRING,
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: "Deals",
  timestamps: true,
});

// Associations (optional)
Deal.belongsTo(Lead, { foreignKey: "leadId", as: "Lead" });
Deal.belongsTo(Person, { foreignKey: "personId", as: "Person" });
Deal.belongsTo(Organization, { foreignKey: "leadOrganizationId", as: "Organization" });

module.exports = Deal;