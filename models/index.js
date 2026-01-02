// const Lead = require("./leads/leadsModel");
// const LeadDetails = require("./leads/leadDetailsModel");
// const Person = require("./leads/leadPersonModel");
// const Organization = require("./leads/leadOrganizationModel");
// const MasterUser = require("./master/masterUserModel");
// const Activity = require("./activity/activityModel");
// const Deal = require("./deals/dealsModels");
// const Pipeline = require("./deals/pipelineModel");
// const PipelineStage = require("./deals/pipelineStageModel");
// const DealFile = require("./deals/dealFileModel");
// const CustomField = require("./customFieldModel");
// const CustomFieldValue = require("./customFieldValueModel");
// const Email = require("./email/emailModel");
// const RecentSearch = require("./recentSearchModel");
// const PersonNote = require("./leads/personNoteModel");
// const OrganizationNote = require("./leads/organizationNoteModel");
// const Dashboard = require("./insight/dashboardModel");
// const Report = require("./insight/reportModel");
// const Goal = require("./insight/goalModel");
// const GroupVisibility = require("../models/admin/groupVisibilityModel");
// const LeadOrganization = require("./leads/leadOrganizationModel");
// const DeviceActivity = require("./deviceActivity/deviceActivity");
// const permissionSet = require("./permissionsetModel");
// const Label = require("./admin/masters/labelModel");
// const ContactSyncConfig = require("./contact/contactSyncConfigModel");
// const ContactSyncHistory = require("./contact/contactSyncHistoryModel");
// const ContactChangeLog = require("./contact/contactChangeLogModel");
// const ContactSyncMapping = require("./contact/contactSyncMappingModel");
// const CompanySettings = require("./company/companySettingsModel");
// const Meeting = require("./meeting/meetingModel");
// const SchedulingLink = require("./meeting/schedulingLinkModel");
// const ProductColumn = require("./product/customColumnModel");

// // GroupVisibility.belongsTo(Person, { as: "GroupPerson", foreignKey: "personId" });
// // Person.hasMany(GroupVisibility, { foreignKey: "personId", as: "GroupVisibility" });

// // GroupVisibility.belongsTo(Organization, { as: "GroupOrganization", foreignKey: "leadOrganizationId" });
// // Organization.hasMany(GroupVisibility, { foreignKey: "leadOrganizationId", as: "GroupVisibility" });

// // GroupVisibility.belongsTo(Lead, { as: "GroupLead", foreignKey: "leadId" });
// // Lead.hasMany(GroupVisibility, { foreignKey: "leadId", as: "GroupVisibility" });

// // GroupVisibility.belongsTo(Deal, { as: "GroupDeal", foreignKey: "dealId" });
// // Deal.hasMany(GroupVisibility, { foreignKey: "dealId", as: "GroupVisibility" });

// // GroupVisibility.belongsTo(Pipeline, { as: "GroupPipeline", foreignKey: "pipelineId" });
// // Pipeline.hasMany(GroupVisibility, { foreignKey: "pipelineId", as: "GroupVisibility" });

// // Associations
// Lead.hasOne(LeadDetails, {
//   foreignKey: "leadId",
//   as: "details",
//   onDelete: "CASCADE",
// });
// LeadDetails.belongsTo(Lead, { foreignKey: "leadId", as: "lead" });

// Lead.belongsTo(Person, { as: "LeadPerson", foreignKey: "personId" });
// Person.hasMany(Lead, { foreignKey: "personId", as: "Leads" });

// Lead.belongsTo(Organization, {
//   as: "LeadOrganization",
//   foreignKey: "leadOrganizationId",
// });
// Organization.hasMany(Lead, { foreignKey: "leadOrganizationId", as: "Leads" });
// Person.belongsTo(Organization, {
//   foreignKey: "leadOrganizationId",
//   as: "LeadOrganization",
// });
// Organization.hasMany(Person, {
//   foreignKey: "leadOrganizationId",
//   as: "LeadPerson",
// });
// Lead.belongsTo(MasterUser, { as: "Owner", foreignKey: "ownerId" });

// // Activity associations - only define the hasMany side here
// // The belongsTo associations are already defined in activityModel.js
// Lead.hasMany(Activity, { foreignKey: "leadId", as: "Activities" });
// Person.hasMany(Activity, { foreignKey: "personId", as: "Activities" });
// Activity.belongsTo(MasterUser, {
//   foreignKey: "assignedTo",
//   as: "assignedUser",
// });
// Activity.belongsTo(MasterUser, {
//   foreignKey: "masterUserID",
//   as: "assignee",
// });
// Activity.belongsTo(Person, { foreignKey: "personId", as: "ActivityPerson" });
// Activity.belongsTo(Organization, {
//   foreignKey: "leadOrganizationId",
//   as: "ActivityOrganization",
// });
// Activity.belongsTo(Lead, {
//   foreignKey: "leadId",
//   as: "ActivityLead",
// });
// Activity.belongsTo(Deal, {
//   foreignKey: "dealId",
//   as: "ActivityDeal",
// });
// Deal.hasMany(Activity, { foreignKey: "dealId", as: "Activities" });

// // PersonNote associations
// Person.hasMany(PersonNote, { foreignKey: "personId", as: "personNotes" });
// PersonNote.belongsTo(Person, { foreignKey: "personId", as: "person" });
// MasterUser.hasMany(PersonNote, {
//   foreignKey: "createdBy",
//   as: "createdPersonNotes",
// });
// PersonNote.belongsTo(MasterUser, { foreignKey: "createdBy", as: "creator" });

// // OrganizationNote associations
// Organization.hasMany(OrganizationNote, {
//   foreignKey: "leadOrganizationId",
//   as: "orgNotes",
// });
// OrganizationNote.belongsTo(Organization, {
//   foreignKey: "leadOrganizationId",
//   as: "organization",
// });
// MasterUser.hasMany(OrganizationNote, {
//   foreignKey: "createdBy",
//   as: "createdOrgNotes",
// });
// OrganizationNote.belongsTo(MasterUser, {
//   foreignKey: "createdBy",
//   as: "creator",
// });

// // Custom Field associations
// CustomField.hasMany(CustomFieldValue, { foreignKey: "fieldId", as: "values" });
// CustomFieldValue.belongsTo(CustomField, {
//   foreignKey: "fieldId",
//   as: "CustomField",
// });

// // CustomField-MasterUser associations (for tracking who created the field)
// CustomField.belongsTo(MasterUser, {
//   foreignKey: "masterUserID",
//   as: "CreatedBy",
// });
// MasterUser.hasMany(CustomField, {
//   foreignKey: "masterUserID",
//   as: "CreatedCustomFields",
// });

// Email.belongsTo(MasterUser, { foreignKey: "masterUserID", as: "MasterUser" });

// // Email-Deal associations
// Email.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
// Deal.hasMany(Email, { foreignKey: "dealId", as: "Emails" });

// // Email-Lead associations
// Email.belongsTo(Lead, { foreignKey: "leadId", as: "Lead" });
// Lead.hasMany(Email, { foreignKey: "leadId", as: "Emails" });

// // Email-Label associations
// Email.belongsTo(Label, { foreignKey: "labelId", as: "Label" });
// Label.hasMany(Email, { foreignKey: "labelId", as: "Emails" });

// // Ensure Deal has the inverse belongsTo associations so includes work correctly
// // (some associations were defined only on the hasMany side previously)
// Deal.belongsTo(Lead, { foreignKey: "leadId", as: "Lead" });
// Deal.belongsTo(Person, { foreignKey: "personId", as: "Person" });
// Deal.belongsTo(Organization, {
//   foreignKey: "leadOrganizationId",
//   as: "Organization",
// });
// Deal.belongsTo(MasterUser, { foreignKey: "ownerId", as: "Owner" });

// // Pipeline associations
// Pipeline.hasMany(PipelineStage, {
//   foreignKey: "pipelineId",
//   as: "stages",
//   onDelete: "CASCADE",
// });
// PipelineStage.belongsTo(Pipeline, { foreignKey: "pipelineId", as: "pipeline" });

// // Deal-Pipeline associations
// Deal.belongsTo(Pipeline, { foreignKey: "pipelineId", as: "pipelineData" });
// Pipeline.hasMany(Deal, { foreignKey: "pipelineId", as: "deals" });

// // Deal-PipelineStage associations
// Deal.belongsTo(PipelineStage, { foreignKey: "stageId", as: "stageData" });
// PipelineStage.hasMany(Deal, { foreignKey: "stageId", as: "deals" });

// // Deal-File associations
// Deal.hasMany(DealFile, { foreignKey: "dealId", as: "files" });
// DealFile.belongsTo(Deal, { foreignKey: "dealId", as: "deal" });
// DealFile.belongsTo(MasterUser, { foreignKey: "uploadedBy", as: "uploader" });
// MasterUser.hasMany(DealFile, { foreignKey: "uploadedBy", as: "uploadedFiles" });

// // Person-Deal associations (belongsTo is already defined in dealsModels.js)
// Person.hasMany(Deal, { foreignKey: "personId", as: "Deals" });

// // Organization-Deal associations (belongsTo is already defined in dealsModels.js)
// Organization.hasMany(Deal, {
//   foreignKey: "leadOrganizationId",
//   as: "OrgDeals",
// });

// // Lead-Deal associations (belongsTo is already defined in dealsModels.js)
// // Lead.belongsTo(Deal, { foreignKey: "dealId", as: "DealLeads" });
// Lead.hasMany(Deal, { foreignKey: "leadId", as: "LeadDeals" });

// // Dashboard-Report-Goal associations
// // Dashboard.hasMany(Report, { foreignKey: "dashboardIds", as: "Reports" });
// // Report.belongsTo(Dashboard, { foreignKey: "dashboardIds", as: "Dashboard" });

// Dashboard.hasMany(Goal, { foreignKey: "dashboardId", as: "Goals" });
// Goal.belongsTo(Dashboard, { foreignKey: "dashboardId", as: "Dashboard" });

// LeadOrganization.belongsTo(MasterUser, {
//   foreignKey: "masterUserID",
//   targetKey: "masterUserID",
//   as: "MasterUser",
// });

// permissionSet.hasMany(MasterUser, {
//   foreignKey: "permissionSetId",
//   as: "pusers",
// });

// // Each user → belongs to one permission set
// MasterUser.belongsTo(permissionSet, {
//   foreignKey: "permissionSetId",
//   as: "permissionSet",
// });
// MasterUser.belongsTo(permissionSet, {
//   foreignKey: "permissionSetId",
//   as: "globalPermissionSet",
// });

// // Contact Sync Associations
// ContactSyncConfig.hasMany(ContactSyncHistory, {
//   foreignKey: "syncConfigId",
//   as: "SyncHistory",
//   onDelete: "CASCADE",
// });
// ContactSyncHistory.belongsTo(ContactSyncConfig, {
//   foreignKey: "syncConfigId",
//   as: "SyncConfig",
// });

// ContactSyncHistory.hasMany(ContactChangeLog, {
//   foreignKey: "syncHistoryId",
//   as: "ChangeLogs",
//   onDelete: "CASCADE",
// });
// ContactChangeLog.belongsTo(ContactSyncHistory, {
//   foreignKey: "syncHistoryId",
//   as: "SyncHistory",
// });

// ContactSyncConfig.belongsTo(MasterUser, {
//   foreignKey: "masterUserID",
//   targetKey: "masterUserID",
//   as: "MasterUser",
// });
// MasterUser.hasMany(ContactSyncConfig, {
//   foreignKey: "masterUserID",
//   as: "ContactSyncConfigs",
// });

// ContactSyncMapping.belongsTo(Person, {
//   foreignKey: "personId",
//   as: "Person",
// });
// Person.hasOne(ContactSyncMapping, {
//   foreignKey: "personId",
//   as: "GoogleMapping",
// });
// MasterUser.belongsTo(GroupVisibility, {
//   foreignKey: "groupId",
//   targetKey: "groupId",
//   as: "groupVisibility",
// });

// GroupVisibility.hasMany(MasterUser, {
//   foreignKey: "groupId",
//   sourceKey: "groupId",
//   as: "users",
// });

// module.exports = {
//   Lead,
//   LeadDetails,
//   Person,
//   Organization,
//   Activity,
//   Deal,
//   Pipeline,
//   PipelineStage,
//   DealFile,
//   CustomField,
//   CustomFieldValue,
//   Email,
//   RecentSearch,
//   PersonNote,
//   OrganizationNote,
//   Dashboard,
//   Report,
//   Goal,
//   DeviceActivity,
//   permissionSet,
//   Label,
//   ContactSyncConfig,
//   ContactSyncHistory,
//   ContactChangeLog,
//   ContactSyncMapping,
//   CompanySettings,
//   Meeting,
//   SchedulingLink,
//   ProductColumn
// };


const createActivityColumnModel = require("./activity/activityColumnModel.js");
const createActivityModel = require("./activity/activityModel.js");
const createActivitySettingModel = require("./activity/activitySettingModel.js");
const createActivityTypeModel = require("./activity/activityTypeModel.js");


const createCountryModel = require("./admin/masters/countryModel.js");
const createCurrencyModel = require("./admin/masters/currencyModel.js");
const createDepartmentModel = require("./admin/masters/departmentModel.js");
const createDesignationModel = require("./admin/masters/designationModel.js");
const createLabelModel = require("./admin/masters/labelModel.js");
const createLeadColumnModel = require("./admin/masters/leadColumnsModel.js");
const createOrganizationModel = require("./admin/masters/organizationModel.js");
const createProgramModel = require("./admin/masters/programModel.js");
const createRegionModel = require("./admin/masters/regionModel.js");
const createScopeModel = require("./admin/masters/scopeModel.js");
const createSectoralscopeModel = require("./admin/masters/sectoralScopeModel.js");
const createStatusModel = require("./admin/masters/statusModel.js");


const createGroupMembershipModel = require("./admin/groupMembershipModel.js");
const createGroupVisibilityModel = require("./admin/groupVisibilityModel.js");
const createItemVisibilityRuleModel = require("./admin/itemVisibilityRuleModel.js");
const createPipelineVisibilityRuleModel = require("./admin/pipelineVisibilityRuleModel.js");
const createVisibilityGroupModel = require("./admin/visibilityGroupModel.js");


const createCompanySettingModel = require("./company/companySettingsModel.js");


const createContactChangeLogModel = require("./contact/contactChangeLogModel.js");
const createContactSyncConfigModel = require("./contact/contactSyncConfigModel.js");
const createContactSyncHistoryModel = require("./contact/contactSyncHistoryModel.js");
const createContactSyncMappingModel = require("./contact/contactSyncMappingModel.js");


const createDealColumnModel = require("./deals/dealColumnModel.js");
const createDealFileModel = require("./deals/dealFileModel.js");
const createDealParticipantModel = require("./deals/dealPartcipentsModel.js");
const createDealDetailsModel = require("./deals/dealsDetailModel.js");
const createDealModel = require("./deals/dealsModels.js");
const createDealStageHistoryModel = require("./deals/dealsStageHistoryModel.js");
const createDealNoteModel = require("./deals/delasNoteModel.js");
const createLostReasonModel = require("./deals/lostReasonModel.js");
const createLostReasonSettingModel = require("./deals/lostReasonSettingModel.js");
const createPipelineModel = require("./deals/pipelineModel.js");
const createPipelineStageModel = require("./deals/pipelineStageModel.js");

 
const createDeviceActivityModel = require("./deviceActivity/deviceActivity.js");


const createAttachmentModel = require("./email/attachmentModel.js");
const createDefaultEmailModel = require("./email/defaultEmailModel.js");
const createEmailModel = require("./email/emailModel.js");
const createTemplateModel = require("./email/templateModel.js");
const createUserCredentialModel = require("./email/userCredentialModel.js")


const createUserFavoriteModel = require("./favorites/userFavoritesModel.js");


const createUserGoogleTokenModel = require("./googledrive/googledrive.js");


const createImportDataModel = require("./import/importDataModel.js");


const createCardModel = require("./insight/cardModel.js");
const createDashboardModel = require("./insight/dashboardModel.js");
const createGoalModel = require("./insight/goalModel.js");
const createReportFolderModel = require("./insight/reportFolderModel.js");
const createReportModel = require("./insight/reportModel.js");


const createEntityFileModel = require("./leads/entityFileModel.js");
const createLeadColumnPreferenceModel = require("./leads/leadColumnModel.js")
const createLeadDetailsModel = require("./leads/leadDetailsModel.js");
const createLeadFilterModel = require("./leads/leadFiltersModel.js");
const createLeadNoteModel = require("./leads/leadNoteModel.js");
const createLeadOrganizationModel = require("./leads/leadOrganizationModel.js");
const createLeadPersonModel = require("./leads/leadPersonModel.js");
const createLeadModel = require("./leads/leadsModel.js");
const createOrganizationColumnPreferenceModel = require("./leads/organizationColumnModel.js");
const createOrganizationFileModel = require("./leads/organizationFileModel.js");
const createOrganizationNoteModel = require("./leads/organizationNoteModel.js");
const createOrganizationSidebarPreferenceModel = require("./leads/organizationSidebarModel.js");
const createPersonColumnPreferenceModel = require("./leads/personColumnModel.js");
const createPersonFileModel = require("./leads/personFileModel.js");
const createPersonNoteModel = require("./leads/personNoteModel.js");
const createPersonSidebarPreferenceModel = require("./leads/personSidebarModel.js");


const createMeetingModel = require("./meeting/meetingModel.js");
const createSchedulingLinkModel = require("./meeting/schedulingLinkModel.js");
const createMiscSettingModel = require("./miscSettings/miscSettingModel.js");

const createNotificationModel = require("./notification/notificationModel.js");
const createNotificationPreferenceModel = require("./notification/notificationPreferenceModel.js");
const createPushSubscriptionModel = require('./notification/pushSubscriptionModel.js');


const createMasterUserPrivilegesModel = require("./privileges/masterUserPrivilegesModel.js");
const createProductColumnModel = require("./product/customColumnModel.js");
const createDealProductModel = require("./product/dealProductModel.js");
const createProductModel = require("./product/productModel.js");
const createProductVariationModel = require("./product/productVariationModel.js");


const createAuditTrailModel = require("./reports/auditTrailModel.js");
const createHistoryModel = require("./reports/historyModel.js");
const createLoginHistoryModel = require("./reports/loginHistoryModel.js");
const createRecentLoginHistoryModel = require("./reports/recentLoginHistoryModel.js");

const createAdminModel = require("./adminModel.js");
const createCustomFieldModel = require("./customFieldModel.js");
const createCustomFieldValueModel = require("./customFieldValueModel.js");
const createPermissionSetModel = require("./permissionsetModel.js");
const createRecentSearchModel = require("./recentSearchModel.js");
const createUserInterfacePreferencesModel = require("./userInterfacePreferences.js");
const createMasterUserModel = require("./master/masterUserModel.js");
// const createLostReasonModel = require("./lostReason/lostReasonModal.js");

const createStartupQuestionModel = require("./startupQuestionModel.js")
const createAutomationModel = require("./automation/automation.js");
const createEmailTemplateModel = require("./email/emailTemplateModel.js");
const MergeMapModel = require("./merge/mergeMap.js");
const TagMapModel = require("./merge/tagMap.js");


const createWebFormFieldModel = require("./webForm/webFormFieldModel.js");
const createWebFormSubmissionModel = require("./webForm/webFormSubmissionModel.js");
const createWebFormTrackingModel = require("./webForm/webFormTrackingModel.js");
const createWebFormModel = require("./webForm/webFormModel.js");

module.exports = {
  createActivityColumnModel,
  createActivityModel,
  createActivitySettingModel,
  createActivityTypeModel,

  createCountryModel,
  createCurrencyModel,
  createDepartmentModel,
  createDesignationModel,
  createLabelModel,
  createLeadColumnModel,
  createOrganizationModel,
  createProgramModel,
  createRegionModel,
  createScopeModel,
  createSectoralscopeModel,
  createStatusModel,

  createGroupMembershipModel,
  createGroupVisibilityModel,
  createItemVisibilityRuleModel,
  createPipelineVisibilityRuleModel,
  createVisibilityGroupModel,

  createCompanySettingModel,

  createContactChangeLogModel,
  createContactSyncConfigModel,
  createContactSyncHistoryModel,
  createContactSyncMappingModel,


  createDealColumnModel,
  createDealFileModel,
  createDealParticipantModel,
  createDealDetailsModel,
  createDealModel,
  createDealStageHistoryModel,
  createLostReasonModel,
  createDealNoteModel,
  createLostReasonSettingModel,
  createPipelineModel,
  createPipelineStageModel,


  createDeviceActivityModel,


  createAttachmentModel,
  createDefaultEmailModel,
  createEmailModel,
  createTemplateModel,
  createUserCredentialModel,


  createUserFavoriteModel,
  createUserGoogleTokenModel,
  createImportDataModel,


  createCardModel,
  createDashboardModel,
  createGoalModel,
  createReportFolderModel,
  createReportModel,


  createEntityFileModel,
  createLeadColumnPreferenceModel,
  createLeadDetailsModel,
  createLeadFilterModel,
  createLeadNoteModel,
  createLeadOrganizationModel,
  createLeadPersonModel,
  createLeadModel,
  createOrganizationColumnPreferenceModel,
  createOrganizationFileModel,
  createOrganizationNoteModel,
  createOrganizationSidebarPreferenceModel,
  createPersonColumnPreferenceModel,
  createPersonFileModel,
  createPersonNoteModel,
  createPersonSidebarPreferenceModel,


  createMeetingModel,
  createSchedulingLinkModel,
  createMiscSettingModel,


  createNotificationModel,
  createNotificationPreferenceModel,
  createPushSubscriptionModel,

  createMasterUserPrivilegesModel,
  createProductColumnModel,
  createDealProductModel,
  createProductModel,
  createProductVariationModel,

  createAuditTrailModel,
  createHistoryModel,
  createLoginHistoryModel,
  createRecentLoginHistoryModel,


  createMasterUserModel,
  createAdminModel,
  createCustomFieldModel,
  createCustomFieldValueModel,
  createPermissionSetModel,
  createRecentSearchModel,
  createUserInterfacePreferencesModel,

  createStartupQuestionModel,
  createAutomationModel,
  createEmailTemplateModel,
  MergeMapModel,
  TagMapModel,
  createWebFormFieldModel,
  createWebFormSubmissionModel,
  createWebFormTrackingModel,
  createWebFormModel
};