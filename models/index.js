const Lead = require("./leads/leadsModel");
const LeadDetails = require("./leads/leadDetailsModel");
const Person = require("./leads/leadPersonModel");
const Organization = require("./leads/leadOrganizationModel");

// Associations
Lead.hasOne(LeadDetails, { foreignKey: "leadId", as: "details", onDelete: "CASCADE" });
LeadDetails.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

Lead.belongsTo(Person, { foreignKey: "personId" });
Person.hasMany(Lead, { foreignKey: "personId" });

Lead.belongsTo(Organization, { foreignKey: "leadOrganizationId" });
Organization.hasMany(Lead, { foreignKey: "leadOrganizationId" });
Person.belongsTo(Organization, { foreignKey: "leadOrganizationId", as: "LeadOrganization" });
Organization.hasMany(Person, { foreignKey: "leadOrganizationId", as: "persons" });

module.exports = {
  Lead,
  LeadDetails,
  Person,
  Organization,
};