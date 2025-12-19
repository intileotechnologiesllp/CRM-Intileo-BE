const { DataTypes } = require("sequelize");
// const Deal = require("../../models/deals/dealsModels");
// const Person = require("../leads/leadPersonModel");
// const Organization = require("../leads/leadOrganizationModel");


const createDealParticipantModel = (sequelizeInstance) => {
const DealParticipant = sequelizeInstance.define("DealParticipant", {
  participantId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dealId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Deals",
      key: "dealId"
    }
  },
  personId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "LeadPersons",
      key: "personId"
    }
  },
  leadOrganizationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "LeadOrganizations",
      key: "leadOrganizationId"
    }
  }
}, {
  tableName: "DealParticipants",
  timestamps: false
});
return DealParticipant
}

// Associations
// DealParticipant.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
// DealParticipant.belongsTo(Person, { foreignKey: "personId", as: "Person" });
// DealParticipant.belongsTo(Organization, { foreignKey: "leadOrganizationId", as: "Organization" });

module.exports = createDealParticipantModel;