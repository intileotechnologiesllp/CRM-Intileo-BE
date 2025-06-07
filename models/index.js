const Lead = require("./leads/leadsModel");
const LeadDetails = require("./leads/leadDetailsModel");
const Person = require("./leads/leadPersonModel");
const Organization = require("./leads/leadOrganizationModel");
const MasterUser = require("./master/masterUserModel");

// Associations
Lead.hasOne(LeadDetails, { foreignKey: "leadId", as: "details", onDelete: "CASCADE" });
LeadDetails.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

Lead.belongsTo(Person, { as: "LeadPerson",foreignKey: "personId" });
Person.hasMany(Lead, { foreignKey: "personId" });

Lead.belongsTo(Organization, { as:"LeadOrganization",foreignKey: "leadOrganizationId" });
Organization.hasMany(Lead, { foreignKey: "leadOrganizationId" });
Person.belongsTo(Organization, { foreignKey: "leadOrganizationId", as: "LeadOrganization" });
Organization.hasMany(Person, { foreignKey: "leadOrganizationId", as: "LeadPerson" });
Lead.belongsTo(MasterUser, { as: "Owner", foreignKey: "ownerId" });

module.exports = {
  Lead,
  LeadDetails,
  Person,
  Organization,
};