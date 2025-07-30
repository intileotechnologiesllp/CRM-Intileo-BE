const Lead = require("./leads/leadsModel");
const LeadDetails = require("./leads/leadDetailsModel");
const Person = require("./leads/leadPersonModel");
const Organization = require("./leads/leadOrganizationModel");
const MasterUser = require("./master/masterUserModel");
const Activity = require("./activity/activityModel");
const Deal = require("./deals/dealsModels");
const Pipeline = require("./deals/pipelineModel");
const PipelineStage = require("./deals/pipelineStageModel");
const CustomField = require("./customFieldModel");
const CustomFieldValue = require("./customFieldValueModel");
const Email = require("./email/emailModel");
const RecentSearch = require("./recentSearchModel");
const PersonNote = require("./leads/personNoteModel");
const OrganizationNote = require("./leads/organizationNoteModel");
const Dashboard = require("./insight/dashboardModel");
const Report = require("./insight/reportModel");
const Goal = require("./insight/goalModel");

// Associations
Lead.hasOne(LeadDetails, {
  foreignKey: "leadId",
  as: "details",
  onDelete: "CASCADE",
});
LeadDetails.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

Lead.belongsTo(Person, { as: "LeadPerson", foreignKey: "personId" });
Person.hasMany(Lead, { foreignKey: "personId", as: "Leads" });

Lead.belongsTo(Organization, {
  as: "LeadOrganization",
  foreignKey: "leadOrganizationId",
});
Organization.hasMany(Lead, { foreignKey: "leadOrganizationId", as: "Leads" });
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
Person.hasMany(Activity, { foreignKey: "personId", as: "Activities" });
Activity.belongsTo(MasterUser, {
  foreignKey: "assignedTo",
  as: "assignedUser",
});
Activity.belongsTo(Person, { foreignKey: "personId", as: "ActivityPerson" });
Activity.belongsTo(Organization, {
  foreignKey: "leadOrganizationId",
  as: "ActivityOrganization",
});

// PersonNote associations
Person.hasMany(PersonNote, { foreignKey: "personId", as: "personNotes" });
PersonNote.belongsTo(Person, { foreignKey: "personId", as: "person" });
MasterUser.hasMany(PersonNote, {
  foreignKey: "createdBy",
  as: "createdPersonNotes",
});
PersonNote.belongsTo(MasterUser, { foreignKey: "createdBy", as: "creator" });

// OrganizationNote associations
Organization.hasMany(OrganizationNote, {
  foreignKey: "leadOrganizationId",
  as: "orgNotes",
});
OrganizationNote.belongsTo(Organization, {
  foreignKey: "leadOrganizationId",
  as: "organization",
});
MasterUser.hasMany(OrganizationNote, {
  foreignKey: "createdBy",
  as: "createdOrgNotes",
});
OrganizationNote.belongsTo(MasterUser, {
  foreignKey: "createdBy",
  as: "creator",
});

// Custom Field associations
CustomField.hasMany(CustomFieldValue, { foreignKey: "fieldId", as: "values" });
CustomFieldValue.belongsTo(CustomField, {
  foreignKey: "fieldId",
  as: "CustomField",
});

// CustomField-MasterUser associations (for tracking who created the field)
CustomField.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  as: "CreatedBy",
});
MasterUser.hasMany(CustomField, {
  foreignKey: "masterUserID",
  as: "CreatedCustomFields",
});

// Email-Deal associations
Email.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
Deal.hasMany(Email, { foreignKey: "dealId", as: "Emails" });

// Email-Lead associations
Email.belongsTo(Lead, { foreignKey: "leadId", as: "Lead" });
Lead.hasMany(Email, { foreignKey: "leadId", as: "Emails" });

// Pipeline associations
Pipeline.hasMany(PipelineStage, {
  foreignKey: "pipelineId",
  as: "stages",
  onDelete: "CASCADE",
});
PipelineStage.belongsTo(Pipeline, { foreignKey: "pipelineId", as: "pipeline" });

// Deal-Pipeline associations
Deal.belongsTo(Pipeline, { foreignKey: "pipelineId", as: "pipelineData" });
Pipeline.hasMany(Deal, { foreignKey: "pipelineId", as: "deals" });

// Deal-PipelineStage associations
Deal.belongsTo(PipelineStage, { foreignKey: "stageId", as: "stageData" });
PipelineStage.hasMany(Deal, { foreignKey: "stageId", as: "deals" });

// Person-Deal associations (belongsTo is already defined in dealsModels.js)
Person.hasMany(Deal, { foreignKey: "personId", as: "Deals" });

// Organization-Deal associations (belongsTo is already defined in dealsModels.js)
Organization.hasMany(Deal, {
  foreignKey: "leadOrganizationId",
  as: "OrgDeals",
});

// Lead-Deal associations (belongsTo is already defined in dealsModels.js)
Lead.hasMany(Deal, { foreignKey: "leadId", as: "LeadDeals" });

// Dashboard-Report-Goal associations
Dashboard.hasMany(Report, { foreignKey: "dashboardId", as: "Reports" });
Report.belongsTo(Dashboard, { foreignKey: "dashboardId", as: "Dashboard" });

Dashboard.hasMany(Goal, { foreignKey: "dashboardId", as: "Goals" });
Goal.belongsTo(Dashboard, { foreignKey: "dashboardId", as: "Dashboard" });

module.exports = {
  Lead,
  LeadDetails,
  Person,
  Organization,
  Activity,
  Deal,
  Pipeline,
  PipelineStage,
  CustomField,
  CustomFieldValue,
  Email,
  RecentSearch,
  PersonNote,
  OrganizationNote,
  Dashboard,
  Report,
  Goal,
};
