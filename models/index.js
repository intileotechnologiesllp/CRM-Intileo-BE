// const Lead = require("./leads/leadsModel");
// const LeadDetails = require("./leads/leadDetailsModel");
// const Person = require("./leads/leadPersonModel");
// const Organization = require("./leads/leadOrganizationModel");

// // Associations
// Lead.hasOne(LeadDetails, { foreignKey: "leadId", as: "details", onDelete: "CASCADE" });
// LeadDetails.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

// Lead.belongsTo(Person, { foreignKey: "personId" });
// Person.hasMany(Lead, { foreignKey: "personId" });

// Lead.belongsTo(Organization, { foreignKey: "organizationId" });
// Organization.hasMany(Lead, { foreignKey: "organizationId" });

// module.exports = {
//   Lead,
//   LeadDetails,
//   Person,
//   Organization,
// };