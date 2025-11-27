const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Deal = require("../../models/deals/dealsModels");

const DealDetails = sequelize.define("DealDetails", {
  dealDetailsId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dealId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Deal,
      key: "dealId"
    }
  },
  statusSummary: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  responsiblePerson: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  rfpReceivedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ownerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  wonTime:{
    type: DataTypes.DATE,
    allowNull: true,
  },
  lostTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scopeOfServiceType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  countryOfOrganizationCountry: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lostReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dealClosedOn: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  nextActivityDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  stateAndCountryProjectLocation:{
    type: DataTypes.STRING,
    allowNull: true,
  }

  // Add future fields here as needed
}, {
  tableName: "DealDetails",
  timestamps: true,
});

// Associations
DealDetails.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
Deal.hasOne(DealDetails, { foreignKey: "dealId", as: "details" });

module.exports = DealDetails;