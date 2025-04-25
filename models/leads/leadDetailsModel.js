const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Lead = require("./leadsModel");

const LeadDetails = sequelize.define("LeadDetails", {
  leadDetailsId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Lead,
      key: "leadId",
    },
    onDelete: "CASCADE", // Delete LeadDetails if the associated Lead is deleted
  },
  RFP_receivedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  statusSummary: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  responsibleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  responsiblePerson: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  organizationCountry: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transferOwnerShip: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sourceOrgin: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  personName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  postalAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  birthday: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = LeadDetails;
