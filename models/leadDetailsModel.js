const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const LeadDetails = sequelize.define("LeadDetails", {
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Leads", // Name of the Lead table
      key: "id",
    },
  },
  labels: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  proposalValue: {
    type: DataTypes.FLOAT,
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
});

module.exports = LeadDetails;