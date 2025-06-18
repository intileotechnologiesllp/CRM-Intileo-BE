const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Deal = require("../../models/deals/dealsModels");
const Person = require("../leads/leadPersonModel");
const Organization = require("../leads/leadOrganizationModel");

const DealParticipant = sequelize.define("DealParticipant", {
  participantId: {
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
  personId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Person,
      key: "personId"
    }
  },
  leadOrganizationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Organization,
      key: "leadOrganizationId"
    }
  }
}, {
  tableName: "DealParticipants",
  timestamps: false
});

// Associations
DealParticipant.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
DealParticipant.belongsTo(Person, { foreignKey: "personId", as: "Person" });
DealParticipant.belongsTo(Organization, { foreignKey: "leadOrganizationId", as: "Organization" });

module.exports = DealParticipant;