
/**
 * Set up associations between models for a database connection
 * @param {Object} models - Object containing all models for a connection
 */
const setupAssociations = (models) => {
  const { MasterUser, AuditTrail, History, LoginHistory, RecentLoginHistory, Admin, CustomField, CustomFieldValue, PermissionSet, RecentSearch, UserInterfacePreference, Country, Currency, Department, Designation, Label, Organization, Program, Region, Scope, Sectoralscope, Status, GroupVisibility, ItemVisibilityRule, GroupMembership, VisibilityGroup, Pipeline, PipelineStage, PipelineVisibilityRule, LeadColumn, LeadOrganization, OrganizationColumnPreference, OrganizationFile, OrganizationNote, OrganizationSidebarPreference, LeadPerson, PersonColumnPreference, PersonFile, PersonNote, PersonSidebarPreference, Lead, LeadNote, LeadFilter, LeadDetail, LeadColumnPreference, EntityFile, Dashboard, Card, Goal, ReportFolder, Report, ImportData, UserGoogleToken, UserFavorite, Email, Attachment, DefaultEmail, Template, UserCredential, DeviceActivity, LostReason, LostReasonSetting, Deal, DealStageHistory, DealNote, DealDetail, DealParticipant, DealFile, DealColumn, ContactChangeLog, ContactSyncHistory, ContactSyncConfig, ContactSyncMapping, CompanySetting, Activity, ActivityColumn, ActivitySetting, ActivityType, Meeting, SchedulingLink, MiscSetting, Notification, NotificationPreference, PushSubscription, MasterUserPrivileges, Product, ProductVariation, DealProduct, ProductColumn } = models;
  


GroupVisibility.belongsTo(LeadPerson, { as: "GroupPerson", foreignKey: "personId" });
LeadPerson.hasMany(GroupVisibility, { foreignKey: "personId", as: "GroupVisibility" });


GroupVisibility.belongsTo(LeadOrganization, { as: "GroupOrganization", foreignKey: "leadOrganizationId" });
LeadOrganization.hasMany(GroupVisibility, { foreignKey: "leadOrganizationId", as: "GroupVisibility" });


GroupVisibility.belongsTo(Lead, { as: "GroupLead", foreignKey: "leadId" });
Lead.hasMany(GroupVisibility, { foreignKey: "leadId", as: "GroupVisibility" });


GroupVisibility.belongsTo(Deal, { as: "GroupDeal", foreignKey: "dealId" });
Deal.hasMany(GroupVisibility, { foreignKey: "dealId", as: "GroupVisibility" });


GroupVisibility.belongsTo(Pipeline, { as: "GroupPipeline", foreignKey: "pipelineId" });
Pipeline.hasMany(GroupVisibility, { foreignKey: "pipelineId", as: "GroupVisibility" });


// VisibilityGroup associations
VisibilityGroup.hasMany(GroupMembership, {
  foreignKey: "groupId",
  as: "memberships",
});

VisibilityGroup.hasMany(PipelineVisibilityRule, {
  foreignKey: "groupId",
  as: "pipelineRules",
});

VisibilityGroup.hasMany(ItemVisibilityRule, {
  foreignKey: "groupId",
  as: "itemRules",
});

// GroupMembership associations
GroupMembership.belongsTo(VisibilityGroup, {
  foreignKey: "groupId",
  as: "group",
});

GroupMembership.belongsTo(MasterUser, {
  foreignKey: "userId",
  as: "user",
});

GroupMembership.belongsTo(MasterUser, {
  foreignKey: "assignedBy",
  as: "assignedByUser",
});

// PipelineVisibilityRule associations
PipelineVisibilityRule.belongsTo(VisibilityGroup, {
  foreignKey: "groupId",
  as: "group",
});

PipelineVisibilityRule.belongsTo(Pipeline, {
  foreignKey: "pipelineId",
  as: "pipeline",
});

// ItemVisibilityRule associations
ItemVisibilityRule.belongsTo(VisibilityGroup, {
  foreignKey: "groupId",
  as: "group",
});

// MasterUser-GroupMembership associations
MasterUser.hasMany(GroupMembership, {
  foreignKey: "userId",
  as: "groupMemberships",
});

// Pipeline-PipelineVisibilityRule associations
Pipeline.hasMany(PipelineVisibilityRule, {
  foreignKey: "pipelineId",
  as: "visibilityRules",
});


Lead.hasOne(LeadDetail, {
  foreignKey: "leadId",
  as: "details",
  onDelete: "CASCADE",
});
LeadDetail.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });


Lead.belongsTo(LeadPerson, { as: "LeadPerson", foreignKey: "personId" });
LeadPerson.hasMany(Lead, { foreignKey: "personId", as: "Leads" });


Lead.belongsTo(LeadOrganization, {
  as: "LeadOrganization",
  foreignKey: "leadOrganizationId",
});
LeadOrganization.hasMany(Lead, { foreignKey: "leadOrganizationId", as: "Leads" });


LeadPerson.belongsTo(LeadOrganization, {
  foreignKey: "leadOrganizationId",
  as: "LeadOrganization",
});
LeadOrganization.hasMany(LeadPerson, {
  foreignKey: "leadOrganizationId",
  as: "LeadPerson",
});


Lead.belongsTo(MasterUser, { as: "Owner", foreignKey: "ownerId" });

// // Activity associations - only define the hasMany side here
// // The belongsTo associations are already defined in activityModel.js

Lead.hasMany(Activity, { foreignKey: "leadId", as: "Activities" });
Activity.belongsTo(Lead, {
  foreignKey: "leadId",
  as: "ActivityLead",
});


LeadPerson.hasMany(Activity, { foreignKey: "personId", as: "Activities" });
Activity.belongsTo(LeadPerson, { foreignKey: "personId", as: "ActivityPerson" });

Activity.belongsTo(MasterUser, {
  foreignKey: "assignedTo",
  as: "assignedUser",
});

Activity.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  as: "assignee",
});

LeadOrganization.hasMany(Activity, { foreignKey: "leadOrganizationId", as: "Activities" });
Activity.belongsTo(LeadOrganization, {
  foreignKey: "leadOrganizationId",
  as: "ActivityOrganization",
});


Activity.belongsTo(Deal, {
  foreignKey: "dealId",
  as: "ActivityDeal",
});
Deal.hasMany(Activity, { foreignKey: "dealId", as: "Activities" });

// // PersonNote associations
LeadPerson.hasMany(PersonNote, { foreignKey: "personId", as: "personNotes" });
PersonNote.belongsTo(LeadPerson, { foreignKey: "personId", as: "person" });


MasterUser.hasMany(PersonNote, {
  foreignKey: "createdBy",
  as: "createdPersonNotes",
});
PersonNote.belongsTo(MasterUser, { foreignKey: "createdBy", as: "creator" });

// // OrganizationNote associations
LeadOrganization.hasMany(OrganizationNote, {
  foreignKey: "leadOrganizationId",
  as: "orgNotes",
});
OrganizationNote.belongsTo(LeadOrganization, {
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


// // Custom Field associations
CustomField.hasMany(CustomFieldValue, { foreignKey: "fieldId", as: "values" });
CustomFieldValue.belongsTo(CustomField, {
  foreignKey: "fieldId",
  as: "CustomField",
});


// // CustomField-MasterUser associations (for tracking who created the field)
CustomField.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  as: "CreatedBy",
});
MasterUser.hasMany(CustomField, {
  foreignKey: "masterUserID",
  as: "CreatedCustomFields",
});

Email.belongsTo(MasterUser, { foreignKey: "masterUserID", as: "MasterUser" });

// // Email-Deal associations
Email.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
Deal.hasMany(Email, { foreignKey: "dealId", as: "Emails" });


// // Email-Lead associations
Email.belongsTo(Lead, { foreignKey: "leadId", as: "Lead" });
Lead.hasMany(Email, { foreignKey: "leadId", as: "Emails" });


// // Email-Label associations
Email.belongsTo(Label, { foreignKey: "labelId", as: "Label" });
Label.hasMany(Email, { foreignKey: "labelId", as: "Emails" });


// // Ensure Deal has the inverse belongsTo associations so includes work correctly
// // (some associations were defined only on the hasMany side previously)

Deal.belongsTo(Lead, { foreignKey: "leadId", as: "Lead" });
Deal.belongsTo(LeadPerson, { foreignKey: "personId", as: "Person" });
Deal.belongsTo(LeadOrganization, {
  foreignKey: "leadOrganizationId",
  as: "Organization",
});
Deal.belongsTo(MasterUser, { foreignKey: "ownerId", as: "Owner" });

// // Pipeline associations
Pipeline.hasMany(PipelineStage, {
  foreignKey: "pipelineId",
  as: "stages",
  onDelete: "CASCADE",
});
PipelineStage.belongsTo(Pipeline, { foreignKey: "pipelineId", as: "pipeline" });

// // Deal-Pipeline associations
Deal.belongsTo(Pipeline, { foreignKey: "pipelineId", as: "pipelineData" });
Pipeline.hasMany(Deal, { foreignKey: "pipelineId", as: "deals" });

// // Deal-PipelineStage associations
Deal.belongsTo(PipelineStage, { foreignKey: "stageId", as: "stageData" });
PipelineStage.hasMany(Deal, { foreignKey: "stageId", as: "deals" });

// // Deal-File associations
Deal.hasMany(DealFile, { foreignKey: "dealId", as: "files" });
DealFile.belongsTo(Deal, { foreignKey: "dealId", as: "deal" });
DealFile.belongsTo(MasterUser, { foreignKey: "uploadedBy", as: "uploader" });
MasterUser.hasMany(DealFile, { foreignKey: "uploadedBy", as: "uploadedFiles" });

// // Person-Deal associations (belongsTo is already defined in dealsModels.js)
LeadPerson.hasMany(Deal, { foreignKey: "personId", as: "Deals" });

// // Organization-Deal associations (belongsTo is already defined in dealsModels.js)
LeadOrganization.hasMany(Deal, {
  foreignKey: "leadOrganizationId",
  as: "OrgDeals",
});

// // Lead-Deal associations (belongsTo is already defined in dealsModels.js)
Lead.belongsTo(Deal, { foreignKey: "dealId", as: "DealLeads" });
Lead.hasMany(Deal, { foreignKey: "leadId", as: "LeadDeals" });

// // Dashboard-Report-Goal associations
Dashboard.hasMany(Report, { foreignKey: "dashboardId", as: "Reports" });
Report.belongsTo(Dashboard, { foreignKey: "dashboardId", as: "Dashboard" });

Dashboard.hasMany(Goal, { foreignKey: "dashboardId", as: "Goals" });
Goal.belongsTo(Dashboard, { foreignKey: "dashboardId", as: "Dashboard" });

LeadOrganization.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  targetKey: "masterUserID",
  as: "MasterUser",
});

PermissionSet.hasMany(MasterUser, {
  foreignKey: "permissionSetId",
  as: "pusers",
});

// // Each user → belongs to one permission set
MasterUser.belongsTo(PermissionSet, {
  foreignKey: "permissionSetId",
  as: "permissionSet",
});
MasterUser.belongsTo(PermissionSet, {
  foreignKey: "permissionSetId",
  as: "globalPermissionSet",
});

// // Contact Sync Associations
ContactSyncConfig.hasMany(ContactSyncHistory, {
  foreignKey: "syncConfigId",
  as: "SyncHistory",
  onDelete: "CASCADE",
});
ContactSyncHistory.belongsTo(ContactSyncConfig, {
  foreignKey: "syncConfigId",
  as: "SyncConfig",
});

ContactSyncHistory.hasMany(ContactChangeLog, {
  foreignKey: "syncHistoryId",
  as: "ChangeLogs",
  onDelete: "CASCADE",
});
ContactChangeLog.belongsTo(ContactSyncHistory, {
  foreignKey: "syncHistoryId",
  as: "SyncHistory",
});

ContactSyncConfig.belongsTo(MasterUser, {
  foreignKey: "masterUserID",
  targetKey: "masterUserID",
  as: "MasterUser",
});
MasterUser.hasMany(ContactSyncConfig, {
  foreignKey: "masterUserID",
  as: "ContactSyncConfigs",
});

ContactSyncMapping.belongsTo(LeadPerson, {
  foreignKey: "personId",
  as: "Person",
});
LeadPerson.hasOne(ContactSyncMapping, {
  foreignKey: "personId",
  as: "GoogleMapping",
});

MasterUser.belongsTo(GroupVisibility, {
  foreignKey: "groupId",
  targetKey: "groupId",
  as: "groupVisibility",
});

GroupVisibility.hasMany(MasterUser, {
  foreignKey: "groupId",
  sourceKey: "groupId",
  as: "users",
});
  
GroupVisibility.belongsTo(MasterUser, {
  foreignKey: "createdBy",
  as: "creator",
});

// Notification associations
Notification.belongsTo(MasterUser, {
  foreignKey: "userId",
  targetKey: "masterUserID",
  as: "recipient",
});

Notification.belongsTo(MasterUser, {
  foreignKey: "actionBy",
  targetKey: "masterUserID",
  as: "actor",
});

MasterUser.hasMany(Notification, {
  foreignKey: "userId",
  sourceKey: "masterUserID",
  as: "receivedNotifications",
});

MasterUser.hasMany(Notification, {
  foreignKey: "actionBy",
  sourceKey: "masterUserID",
  as: "sentNotifications",
});

// NotificationPreference associations
NotificationPreference.belongsTo(MasterUser, {
  foreignKey: "userId",
  targetKey: "masterUserID",
  as: "user",
});

MasterUser.hasOne(NotificationPreference, {
  foreignKey: "userId",
  sourceKey: "masterUserID",
  as: "notificationPreferences",
});

// PushSubscription associations
PushSubscription.belongsTo(MasterUser, {
  foreignKey: "userId",
  targetKey: "masterUserID",
  as: "user",
});

MasterUser.hasMany(PushSubscription, {
  foreignKey: "userId",
  sourceKey: "masterUserID",
  as: "pushSubscriptions",
});

ProductVariation.belongsTo(Product, {
  foreignKey: "productId",
  as: "product",
});

Product.hasMany(ProductVariation, {
  foreignKey: "productId",
  as: "variations",
});

Product.belongsTo(MasterUser, {
  foreignKey: "ownerId",
  as: "owner",
});

MasterUser.hasMany(Product, {
  foreignKey: "ownerId",
  as: "masterproduct",
});

console.log("✅ Associations set up successfully");
  
  return models;
};

module.exports = { setupAssociations };