const Lead = require("./leads/leadsModel");
const LeadDetails = require("./leads/leadDetailsModel");
const Person = require("./leads/leadPersonModel");
const Organization = require("./leads/leadOrganizationModel");
const MasterUser = require("./master/masterUserModel");
const Activity = require("./activity/activityModel");
const Deal = require("./deals/dealsModels");
const CustomField = require("./customFieldModel");
const CustomFieldValue = require("./customFieldValueModel");
const Email = require("./email/emailModel");
const RecentSearch = require("./recentSearchModel");

// Associations
Lead.hasOne(LeadDetails, {
  foreignKey: "leadId",
  as: "details",
  onDelete: "CASCADE",
});
LeadDetails.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

Lead.belongsTo(Person, { as: "LeadPerson", foreignKey: "personId" });
Person.hasMany(Lead, { foreignKey: "personId" });

Lead.belongsTo(Organization, {
  as: "LeadOrganization",
  foreignKey: "leadOrganizationId",
});
Organization.hasMany(Lead, { foreignKey: "leadOrganizationId" });
Person.belongsTo(Organization, {
  foreignKey: "leadOrganizationId",
  as: "LeadOrganization",
});
Organization.hasMany(Person, {
  foreignKey: "leadOrganizationId",
  as: "LeadPerson",
});
Lead.belongsTo(MasterUser, { as: "Owner", foreignKey: "ownerId" });

// Activity associations - only define the hasMany side here
// The belongsTo associations are already defined in activityModel.js
Lead.hasMany(Activity, { foreignKey: "leadId", as: "Activities" });
Activity.belongsTo(MasterUser, {
  foreignKey: "assignedTo",
  as: "assignedUser",
});
Activity.belongsTo(Person, { foreignKey: "personId", as: "ActivityPerson" });
Activity.belongsTo(Organization, {
  foreignKey: "leadOrganizationId",
  as: "ActivityOrganization",
});

// // PersonNote associations
// Person.hasMany(PersonNote, { foreignKey: "personId", as: "notes" });
// PersonNote.belongsTo(Person, { foreignKey: "personId", as: "person" });
// MasterUser.hasMany(PersonNote, { foreignKey: "createdBy", as: "personNotes" });
// PersonNote.belongsTo(MasterUser, { foreignKey: "createdBy", as: "creator" });

// // OrganizationNote associations
// Organization.hasMany(OrganizationNote, { foreignKey: "leadOrganizationId", as: "notes" });
// OrganizationNote.belongsTo(Organization, { foreignKey: "leadOrganizationId", as: "LeadOrganization" });
// MasterUser.hasMany(OrganizationNote, { foreignKey: "createdBy", as: "organizationNotes" });
// OrganizationNote.belongsTo(MasterUser, { foreignKey: "createdBy", as: "creator" });

// Custom Field associations
CustomField.hasMany(CustomFieldValue, { foreignKey: "fieldId", as: "values" });
CustomFieldValue.belongsTo(CustomField, {
  foreignKey: "fieldId",
  as: "CustomField",
});

// Email-Deal associations
Email.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
Deal.hasMany(Email, { foreignKey: "dealId", as: "Emails" });

module.exports = {
  Lead,
  LeadDetails,
  Person,
  Organization,
  Activity,
  Deal,
  CustomField,
  CustomFieldValue,
  Email,
  RecentSearch,
};
