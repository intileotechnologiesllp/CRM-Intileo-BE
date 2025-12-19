const { DataTypes } = require("sequelize");
// const Lead = require("../leads/leadsModel");
// const Person = require("../leads/leadPersonModel");
// const Organization = require("../leads/leadOrganizationModel");
// const MasterUser = require("../master/masterUserModel");


const createDealModel = (sequelizeInstance) => {
const Deal = sequelizeInstance.define(
  "Deal",
  {
    dealId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    leadId: {
      type: DataTypes.INTEGER,
      references: {
        model: "Leads",
        key: "leadId",
      },
      allowNull: true,
    },
    personId: {
      type: DataTypes.INTEGER,
      references: {
        model: "LeadPersons",
        key: "personId",
      },
      allowNull: true,
    },
    leadOrganizationId: {
      type: DataTypes.INTEGER,
      references: {
        model: "LeadOrganizations",
        key: "leadOrganizationId",
      },
      allowNull: true,
    },
    contactPerson: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    organization: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
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
    // New pipeline foreign keys
    pipelineId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Pipelines",
        key: "pipelineId",
      },
    },
    stageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "PipelineStages",
        key: "stageId",
      },
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
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Deal-specific system fields (moved from Lead model)
    productName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Product or service name for this deal",
    },
    weightedValue: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Weighted value based on probability and deal value",
    },
    lastStageChange: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when the stage was last changed",
    },
    nextActivityDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date of the next scheduled activity",
    },
    lastActivityDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date of the last completed activity",
    },
    wonTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when the deal was won",
    },
    lastEmailReceived: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date of the last email received from contact",
    },
    lastEmailSent: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date of the last email sent to contact",
    },
    lostTime: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when the deal was lost",
    },
    dealClosedOn: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when the deal was closed (won or lost)",
    },

    // Activity metrics
    totalActivities: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Total number of activities associated with this deal",
    },
    doneActivities: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Number of completed activities",
    },
    activitiesToDo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Number of pending activities",
    },
    emailMessagesCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Total number of email messages exchanged",
    },

    // Product and revenue fields
    productQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Quantity of products in this deal",
    },
    productAmount: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Total amount for products in this deal",
    },
    MRR: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Monthly Recurring Revenue",
    },
    ARR: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Annual Recurring Revenue",
    },
    ACV: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "Annual Contract Value",
    },

    // Deal status fields
    lostReason: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Reason why the deal was lost",
    },
    archiveStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Status of archived deals",
    },
    probability: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Deal probability percentage (0-100)",
      validate: {
        min: 0,
        max: 100,
      },
    },
    stage: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Current stage in the sales pipeline (replaces pipelineStage)",
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

    // Deal conversion tracking
    isConvertedToLead: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: "Flag to indicate if this deal was converted back to a lead",
    },
    convertedToLeadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when the deal was converted back to a lead",
    },
    convertedToLeadBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID who converted the deal back to a lead",
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
    visibilityGroupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "GroupVisibilities",
      key: "groupId",
    },
    comment: "Reference to the owner's visibility group",
  },
  },
  {
    tableName: "Deals",
    timestamps: true,
  }
);
return Deal
}

// Associations (optional)
// Deal.belongsTo(Lead, { foreignKey: "leadId", as: "Lead" });
// Deal.belongsTo(Person, { foreignKey: "personId", as: "Person" });
// Deal.belongsTo(Organization, {foreignKey: "leadOrganizationId", as: "Organization"});
// Deal.belongsTo(MasterUser, { foreignKey: "ownerId", as: "Owner" });


module.exports = createDealModel;