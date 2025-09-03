const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Organization = require("../../models/leads/leadOrganizationModel");

const LeadPerson = sequelize.define("LeadPerson", {
  personId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
    leadOrganizationId: {
    type: DataTypes.INTEGER,
    references: {
      model: Organization,
      key: "leadOrganizationId"
    },
    allowNull: true,
  },
  contactPerson: { // <-- Use contactPerson instead of name
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  phone: {
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
    personLabels: {
    type: DataTypes.STRING,
    allowNull: true, // Labels for the person/contact
  },
  organization:{
    type: DataTypes.STRING,
    allowNull: true, // Organization name associated with the person
  },
  masterUserID: {
  type: DataTypes.INTEGER,
  allowNull: false, // or true if you want to allow nulls
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
  // Add more fields as needed
});
// Person.belongsTo(Organization, { foreignKey: "organizationId" });
// Organization.hasMany(Person, { foreignKey: "organizationId" });
module.exports = LeadPerson;