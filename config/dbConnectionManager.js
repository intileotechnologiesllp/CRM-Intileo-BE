const { getClientDbConnection, getClientConfig } = require("./db");
const bcrypt = require("bcrypt");
const {
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


  createAutomationModel,
  createEmailTemplateModel,
  MergeMapModel,
  TagMapModel,

  createWebFormFieldModel,
  createWebFormSubmissionModel,
  createWebFormTrackingModel,
  createWebFormModel,
  createStartupQuestionModel


} = require("../models");

const { setupAssociations } = require("./associations");
const { Organizations } = require("aws-sdk");

class DatabaseConnectionManager {
  static modelInstances = new Map();
  static associatedModels = new Map();
  
  /**
   * Get model instance for a specific connection
   */
  static getModel(connection, modelName) {
    const connectionKey = `${connection.config.host}_${connection.config.database}`;
    const modelKey = `${connectionKey}_${modelName}`;
    
    if (this.modelInstances.has(modelKey)) {
      return this.modelInstances.get(modelKey);
    }
    
    let model;
    switch (modelName) {
      case 'MasterUser':
        model = createMasterUserModel(connection);
        break;
      case 'AuditTrail':
        model = createAuditTrailModel(connection);
        break;
      case 'History':
        model = createHistoryModel(connection);
        break;
      case 'LoginHistory':
        model = createLoginHistoryModel(connection);
        break;
      case 'RecentLoginHistory':
        model = createRecentLoginHistoryModel(connection);
        break;
      case 'Admin':
        model = createAdminModel(connection);
        break;
      case 'CustomField':
        model = createCustomFieldModel(connection);
        break;
      case 'CustomFieldValue':
        model = createCustomFieldValueModel(connection);
        break;
      case 'PermissionSet':
        model = createPermissionSetModel(connection);
        break;
      case 'RecentSearch':
        model = createRecentSearchModel(connection);
        break;
      case 'UserInterfacePreference':
        model = createUserInterfacePreferencesModel(connection);
        break;
      case 'Country':
        model = createCountryModel(connection);
        break;
      case 'Currency':
        model = createCurrencyModel(connection);
        break;
      case 'Department':
        model = createDepartmentModel(connection);
        break;
      case 'Designation':
        model = createDesignationModel(connection);
        break;
      case 'Label':
        model = createLabelModel(connection);
        break;
      case 'Organization':
        model = createOrganizationModel(connection);
        break;
      case 'Program':
        model = createProgramModel(connection);
        break;
      case 'Region':
        model = createRegionModel(connection);
        break;
      case 'Scope':
        model = createScopeModel(connection);
        break;
      case 'Sectoralscope':
        model = createSectoralscopeModel(connection);
        break;
      case 'Status':
        model = createStatusModel(connection);
        break;
      case 'GroupVisibility':
        model = createGroupVisibilityModel(connection);
        break;
      case 'ItemVisibilityRule':
        model = createItemVisibilityRuleModel(connection);
        break;
      case 'GroupMembership':
        model = createGroupMembershipModel(connection);
        break;
      case 'VisibilityGroup':
        model = createVisibilityGroupModel(connection);
        break;
      case 'Pipeline':
        model = createPipelineModel(connection);
        break;
      case 'PipelineStage':
        model = createPipelineStageModel(connection);
        break;
      case 'PipelineVisibilityRule':
        model = createPipelineVisibilityRuleModel(connection);
        break;
      case 'LeadColumn':
        model = createLeadColumnModel(connection);
        break;
      case 'LeadOrganization':
        model = createLeadOrganizationModel(connection);
        break;
      case 'OrganizationColumnPreference':
        model = createOrganizationColumnPreferenceModel(connection);
        break;
      case 'OrganizationFile':
        model = createOrganizationFileModel(connection);
        break;
      case 'OrganizationNote':
        model = createOrganizationNoteModel(connection);
        break;
      case 'OrganizationSidebarPreference':
        model = createOrganizationSidebarPreferenceModel(connection);
        break;
      case 'LeadPerson':
        model = createLeadPersonModel(connection);
        break;
      case 'PersonColumnPreference':
        model = createPersonColumnPreferenceModel(connection);
        break;
      case 'PersonFile':
        model = createPersonFileModel(connection);
        break;
      case 'PersonNote':
        model = createPersonNoteModel(connection);
        break;
      case 'PersonSidebarPreference':
        model = createPersonSidebarPreferenceModel(connection);
        break;
      case 'Lead':
        model = createLeadModel(connection);
        break;
      case 'LeadNote':
        model = createLeadNoteModel(connection);
        break;
      case 'LeadFilter':
        model = createLeadFilterModel(connection);
        break;
      case 'LeadDetail':
        model = createLeadDetailsModel(connection);
        break;
      case 'LeadColumnPreference':
        model = createLeadColumnPreferenceModel(connection);
        break;
      case 'EntityFile':
        model = createEntityFileModel(connection);
        break;
      case 'Dashboard':
        model = createDashboardModel(connection);
        break;
      case 'Card':
        model = createCardModel(connection);
        break;
      case 'Goal':
        model = createGoalModel(connection);
        break;
      case 'ReportFolder':
        model = createReportFolderModel(connection);
        break;
      case 'Report':
        model = createReportModel(connection);
        break;
      case 'ImportData':
        model = createImportDataModel(connection);
        break;
      case 'UserGoogleToken':
        model = createUserGoogleTokenModel(connection);
        break;
      case 'UserFavorite':
        model = createUserFavoriteModel(connection);
        break;
      case 'Email':
        model = createEmailModel(connection);
        break;
      case 'Attachment':
        model = createAttachmentModel(connection);
        break;
      case 'DefaultEmail':
        model = createDefaultEmailModel(connection);
        break;
      case 'Template':
        model = createTemplateModel(connection);
        break;
      case 'UserCredential':
        model = createUserCredentialModel(connection);
        break;
      case 'DeviceActivity':
        model = createDeviceActivityModel(connection);
        break;
      case 'LostReason':
        model = createLostReasonModel(connection);
        break;
      case 'LostReasonSetting':
        model = createLostReasonSettingModel(connection);
        break;
      case 'Deal':
        model = createDealModel(connection);
        break;
      case 'DealStageHistory':
        model = createDealStageHistoryModel(connection);
        break;
      case 'DealNote':
        model = createDealNoteModel(connection);
        break;
      case 'DealDetail':
        model = createDealDetailsModel(connection);
        break;
      case 'DealParticipant':
        model = createDealParticipantModel(connection);
        break;
      case 'DealFile':
        model = createDealFileModel(connection);
        break;
      case 'DealColumn':
        model = createDealColumnModel(connection);
        break;
      case 'ContactChangeLog':
        model = createContactChangeLogModel(connection);
        break;
      case 'ContactSyncHistory':
        model = createContactSyncHistoryModel(connection);
        break;
      case 'ContactSyncConfig':
        model = createContactSyncConfigModel(connection);
        break;
      case 'ContactSyncMapping':
        model = createContactSyncMappingModel(connection);
        break;
      case 'CompanySetting':
        model = createCompanySettingModel(connection);
        break;
      case 'Activity':
        model = createActivityModel(connection);
        break;
      case 'ActivityColumn':
        model = createActivityColumnModel(connection);
        break;
      case 'ActivitySetting':
        model = createActivitySettingModel(connection);
        break;
      case 'ActivityType':
        model = createActivityTypeModel(connection);
        break;
      case 'Meeting':
        model = createMeetingModel(connection);
        break;
      case 'SchedulingLink':
        model = createSchedulingLinkModel(connection);
        break;
      case 'MiscSetting':
        model = createMiscSettingModel(connection);
        break;
      case 'Notification':
        model = createNotificationModel(connection);
        break;
      case 'NotificationPreference':
        model = createNotificationPreferenceModel(connection);
        break;
      case 'PushSubscription':
        model = createPushSubscriptionModel(connection);
        break;
      case 'MasterUserPrivileges':
        model = createMasterUserPrivilegesModel(connection);
        break;
      case 'Product':
        model = createProductModel(connection);
        break;
      case 'ProductVariation':
        model = createProductVariationModel(connection);
        break;
      case 'DealProduct':
        model = createDealProductModel(connection);
        break;
      case 'ProductColumn':
        model = createProductColumnModel(connection);
        break;
      case 'Automation':
        model = createAutomationModel(connection);
        break;
      case 'EmailTemplate':
        model = createEmailTemplateModel(connection);
        break;
      case 'MergeMap':
        model = MergeMapModel(connection);
        break;
      case 'TagMap':
        model = TagMapModel(connection);
        break;
      case 'WebFormField':
        model = createWebFormFieldModel(connection);
        break;
      case 'WebFormSubmission':
        model = createWebFormSubmissionModel(connection);
        break;
      case 'WebFormTracking':
        model = createWebFormTrackingModel(connection);
        break;
      case 'WebForm':
        model = createWebFormModel(connection);
        break;
      case 'StartupQuestion':
        model = createStartupQuestionModel(connection);
        break;
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
    
    this.modelInstances.set(modelKey, model);
    return model;
  }
  
  /**
   * Get all models with associations for a specific connection
   */
  static getAllModels(connection) {
    const connectionKey = `${connection.config.host}_${connection.config.database}`;
    
    // Return cached models with associations if exists
    if (this.associatedModels.has(connectionKey)) {
      return this.associatedModels.get(connectionKey);
    }
    
    // Get individual models
    const models = {
      MasterUser: this.getModel(connection, 'MasterUser'),
      AuditTrail: this.getModel(connection, 'AuditTrail'),
      History: this.getModel(connection, 'History'),
      LoginHistory: this.getModel(connection, 'LoginHistory'),
      RecentLoginHistory: this.getModel(connection, 'RecentLoginHistory'),
      Admin: this.getModel(connection, 'Admin'),
      CustomField: this.getModel(connection, 'CustomField'),
      CustomFieldValue: this.getModel(connection, 'CustomFieldValue'),
      PermissionSet: this.getModel(connection, 'PermissionSet'),
      RecentSearch: this.getModel(connection, 'RecentSearch'),
      UserInterfacePreference: this.getModel(connection, 'UserInterfacePreference'),
      Country: this.getModel(connection, 'Country'),
      Currency: this.getModel(connection, 'Currency'),
      Department: this.getModel(connection, 'Department'),
      Designation: this.getModel(connection, 'Designation'),
      Label: this.getModel(connection, 'Label'),
      Organization: this.getModel(connection, 'Organization'),
      Program: this.getModel(connection, 'Program'),
      Region: this.getModel(connection, 'Region'),
      Scope: this.getModel(connection, 'Scope'),
      Sectoralscope: this.getModel(connection, 'Sectoralscope'),
      Status: this.getModel(connection, 'Status'),
      GroupVisibility: this.getModel(connection, 'GroupVisibility'),
      ItemVisibilityRule: this.getModel(connection, 'ItemVisibilityRule'),
      GroupMembership: this.getModel(connection, 'GroupMembership'),
      VisibilityGroup: this.getModel(connection, 'VisibilityGroup'),
      Pipeline: this.getModel(connection, 'Pipeline'),
      PipelineStage: this.getModel(connection, 'PipelineStage'),
      PipelineVisibilityRule: this.getModel(connection, 'PipelineVisibilityRule'),
      LeadColumn: this.getModel(connection, 'LeadColumn'),
      LeadOrganization: this.getModel(connection, 'LeadOrganization'),
      OrganizationColumnPreference: this.getModel(connection, 'OrganizationColumnPreference'),
      OrganizationFile: this.getModel(connection, 'OrganizationFile'),
      OrganizationNote: this.getModel(connection, 'OrganizationNote'),
      OrganizationSidebarPreference: this.getModel(connection, 'OrganizationSidebarPreference'),
      LeadPerson: this.getModel(connection, 'LeadPerson'),
      PersonColumnPreference: this.getModel(connection, 'PersonColumnPreference'),
      PersonFile: this.getModel(connection, 'PersonFile'),
      PersonNote: this.getModel(connection, 'PersonNote'),
      PersonSidebarPreference: this.getModel(connection, 'PersonSidebarPreference'),
      Lead: this.getModel(connection, 'Lead'),
      LeadNote: this.getModel(connection, 'LeadNote'),
      LeadFilter: this.getModel(connection, 'LeadFilter'),
      LeadDetail: this.getModel(connection, 'LeadDetail'),
      LeadColumnPreference: this.getModel(connection, 'LeadColumnPreference'),
      EntityFile: this.getModel(connection, 'EntityFile'),
      Dashboard: this.getModel(connection, 'Dashboard'),
      Card: this.getModel(connection, 'Card'),
      Goal: this.getModel(connection, 'Goal'),
      ReportFolder: this.getModel(connection, 'ReportFolder'),
      Report: this.getModel(connection, 'Report'),
      ImportData: this.getModel(connection, 'ImportData'),
      UserGoogleToken: this.getModel(connection, 'UserGoogleToken'),
      UserFavorite: this.getModel(connection, 'UserFavorite'),
      Email: this.getModel(connection, 'Email'),
      Attachment: this.getModel(connection, 'Attachment'),
      DefaultEmail: this.getModel(connection, 'DefaultEmail'),
      Template: this.getModel(connection, 'Template'),
      UserCredential: this.getModel(connection, 'UserCredential'),
      DeviceActivity: this.getModel(connection, 'DeviceActivity'),
      LostReason: this.getModel(connection, 'LostReason'),
      LostReasonSetting: this.getModel(connection, 'LostReasonSetting'),
      Deal: this.getModel(connection, 'Deal'),
      DealStageHistory: this.getModel(connection, 'DealStageHistory'),
      DealNote: this.getModel(connection, 'DealNote'),
      DealDetail: this.getModel(connection, 'DealDetail'),
      DealParticipant: this.getModel(connection, 'DealParticipant'),
      DealFile: this.getModel(connection, 'DealFile'),
      DealColumn: this.getModel(connection, 'DealColumn'),
      ContactChangeLog: this.getModel(connection, 'ContactChangeLog'),
      ContactSyncHistory: this.getModel(connection, 'ContactSyncHistory'),
      ContactSyncConfig: this.getModel(connection, 'ContactSyncConfig'),
      ContactSyncMapping: this.getModel(connection, 'ContactSyncMapping'),
      CompanySetting: this.getModel(connection, 'CompanySetting'),
      Activity: this.getModel(connection, 'Activity'),
      ActivityColumn: this.getModel(connection, 'ActivityColumn'),
      ActivitySetting: this.getModel(connection, 'ActivitySetting'),
      ActivityType: this.getModel(connection, 'ActivityType'),
      Meeting: this.getModel(connection, 'Meeting'),
      SchedulingLink: this.getModel(connection, 'SchedulingLink'),
      MiscSetting: this.getModel(connection, 'MiscSetting'),
      Notification: this.getModel(connection, 'Notification'),
      NotificationPreference: this.getModel(connection, 'NotificationPreference'),
      PushSubscription: this.getModel(connection, 'PushSubscription'),
      MasterUserPrivileges: this.getModel(connection, 'MasterUserPrivileges'),
      Product: this.getModel(connection, 'Product'),
      ProductVariation: this.getModel(connection, 'ProductVariation'),
      DealProduct: this.getModel(connection, 'DealProduct'),
      ProductColumn: this.getModel(connection, 'ProductColumn'),
      Automation: this.getModel(connection, 'Automation'),
      EmailTemplate: this.getModel(connection, 'EmailTemplate'),
      MergeMap: this.getModel(connection, 'MergeMap'),
      TagMap: this.getModel(connection, 'TagMap'),
      WebFormField: this.getModel(connection, 'WebFormField'),
      WebFormSubmission: this.getModel(connection, 'WebFormSubmission'),
      WebFormTracking: this.getModel(connection, 'WebFormTracking'),
      WebForm: this.getModel(connection, 'WebForm'),
      StartupQuestion: this.getModel(connection, 'StartupQuestion'),
    };
    
    // Set up associations
    const modelsWithAssociations = setupAssociations(models);
    
    // Cache the models with associations
    this.associatedModels.set(connectionKey, modelsWithAssociations);
    
    return modelsWithAssociations;
  }
  
  /**
   * Sync all models for a connection in correct order
   */
  static async syncModels(connection, models) {
    try {
      console.log("🔄 Syncing database models...");
      
      // Sync in correct order: parent tables first
      await models.MasterUser.sync({ alter: false, force: false });
      console.log("✅ MasterUsers table synced");
      
      await models.AuditTrail.sync({ alter: false, force: false });
      console.log("✅ AuditTrail table synced");

      await models.History.sync({ alter: false, force: false });
      console.log("✅ AuditTrail table synced");

      await models.LoginHistory.sync({ alter: false, force: false });
      console.log("✅ AuditTrail table synced");

      await models.RecentLoginHistory.sync({ alter: false, force: false });
      console.log("✅ RecentLoginHistory table synced");

      await models.Admin.sync({ alter: false, force: false });
      console.log("✅ AuditTrail table synced");

      await models.CustomField.sync({ alter: false, force: false });
      console.log("✅ CustomField table synced");

      await models.CustomFieldValue.sync({ alter: false, force: false });
      console.log("✅ CustomFieldValue table synced");
  
      await models.PermissionSet.sync({ alter: false, force: false });
      console.log("✅ PermissionSet table synced");

      await models.RecentSearch.sync({ alter: false, force: false });
      console.log("✅ RecentSearch table synced");

      await models.UserInterfacePreference.sync({ alter: false, force: false });
      console.log("✅ UserInterfacePreference table synced");

      await models.Country.sync({ alter: false, force: false });
      console.log("✅ Country table synced");

      await models.Currency.sync({ alter: false, force: false });
      console.log("✅ Currency table synced");

      await models.Department.sync({ alter: false, force: false });
      console.log("✅ Department table synced");

      await models.Designation.sync({ alter: false, force: false });
      console.log("✅ Designation table synced");

      await models.Label.sync({ alter: false, force: false });
      console.log("✅ Label table synced");

      await models.Organization.sync({ alter: false, force: false });
      console.log("✅ Organization table synced");

      await models.Program.sync({ alter: false, force: false });
      console.log("✅ Program table synced");

      await models.Region.sync({ alter: false, force: false });
      console.log("✅ Region table synced");

      await models.Scope.sync({ alter: false, force: false });
      console.log("✅ Scope table synced");

      await models.Sectoralscope.sync({ alter: false, force: false });
      console.log("✅ Sectoralscope table synced");

      await models.Status.sync({ alter: false, force: false });
      console.log("✅ Status table synced");

      await models.GroupVisibility.sync({ alter: false, force: false });
      console.log("✅ GroupVisibility table synced");

      await models.ItemVisibilityRule.sync({ alter: false, force: false });
      console.log("✅ ItemVisibilityRule table synced");

      await models.GroupMembership.sync({ alter: false, force: false });
      console.log("✅ GroupMembership table synced");

      await models.VisibilityGroup.sync({ alter: false, force: false });
      console.log("✅ VisibilityGroup table synced");

      await models.Pipeline.sync({ alter: false, force: false });
      console.log("✅ Pipeline table synced");

      await models.PipelineStage.sync({ alter: false, force: false });
      console.log("✅ PipelineStage table synced");

      await models.PipelineVisibilityRule.sync({ alter: false, force: false });
      console.log("✅ PipelineVisibilityRule table synced");

      await models.LeadColumn.sync({ alter: false, force: false });
      console.log("✅ LeadColumn table synced");

      await models.LeadOrganization.sync({ alter: false, force: false });
      console.log("✅ LeadOrganization table synced");

      await models.OrganizationColumnPreference.sync({ alter: false, force: false });
      console.log("✅ OrganizationColumnPreference table synced");

      await models.OrganizationFile.sync({ alter: false, force: false });
      console.log("✅ OrganizationFile table synced");

      await models.OrganizationNote.sync({ alter: false, force: false });
      console.log("✅ OrganizationNote table synced");

      await models.OrganizationSidebarPreference.sync({ alter: false, force: false });
      console.log("✅ OrganizationSidebarPreference table synced");


      await models.LeadPerson.sync({ alter: false, force: false });
      console.log("✅ LeadPerson table synced");


      await models.PersonColumnPreference.sync({ alter: false, force: false });
      console.log("✅ PersonColumnPreference table synced");

      await models.PersonFile.sync({ alter: false, force: false });
      console.log("✅ PersonFile table synced");

      await models.PersonNote.sync({ alter: false, force: false });
      console.log("✅ PersonNote table synced");

      await models.PersonSidebarPreference.sync({ alter: false, force: false });
      console.log("✅ PersonSidebarPreference table synced");

      await models.Lead.sync({ alter: false, force: false });
      console.log("✅ Lead table synced");

      await models.LeadNote.sync({ alter: false, force: false });
      console.log("✅ LeadNote table synced");

      await models.LeadFilter.sync({ alter: false, force: false });
      console.log("✅ LeadFilter table synced");

      await models.LeadDetail.sync({ alter: false, force: false });
      console.log("✅ LeadDetail table synced");

      await models.LeadColumnPreference.sync({ alter: false, force: false });
      console.log("✅ LeadColumnPreference table synced");

      await models.EntityFile.sync({ alter: false, force: false });
      console.log("✅ EntityFile table synced");

      await models.Dashboard.sync({ alter: false, force: false });
      console.log("✅ Dashboard table synced");

      await models.Card.sync({ alter: false, force: false });
      console.log("✅ Card table synced");

      await models.Goal.sync({ alter: false, force: false });
      console.log("✅ Goal table synced");

      await models.ReportFolder.sync({ alter: false, force: false });
      console.log("✅ ReportFolder table synced");

      await models.Report.sync({ alter: false, force: false });
      console.log("✅ Report table synced");

      await models.ImportData.sync({ alter: false, force: false });
      console.log("✅ ImportData table synced");

      await models.UserGoogleToken.sync({ alter: false, force: false });
      console.log("✅ UserGoogleToken table synced");

      await models.UserFavorite.sync({ alter: false, force: false });
      console.log("✅ UserFavorite table synced");

      await models.Email.sync({ alter: false, force: false });
      console.log("✅ Email table synced");

      await models.Attachment.sync({ alter: false, force: false });
      console.log("✅ Attachment table synced");

      await models.DefaultEmail.sync({ alter: false, force: false });
      console.log("✅ DefaultEmail table synced");

      await models.Template.sync({ alter: false, force: false });
      console.log("✅ Template table synced");

      await models.UserCredential.sync({ alter: false, force: false });
      console.log("✅ UserCredential table synced");

      await models.DeviceActivity.sync({ alter: false, force: false });
      console.log("✅ DeviceActivity table synced");

      await models.LostReason.sync({ alter: false, force: false });
      console.log("✅ LostReason table synced");

      await models.LostReasonSetting.sync({ alter: false, force: false });
      console.log("✅ LostReasonSetting table synced");

      await models.Deal.sync({ alter: false, force: false });
      console.log("✅ Deal table synced");

      await models.DealStageHistory.sync({ alter: false, force: false });
      console.log("✅ DealStageHistory table synced");

      await models.DealNote.sync({ alter: false, force: false });
      console.log("✅ DealNote table synced");

      await models.DealDetail.sync({ alter: false, force: false });
      console.log("✅ DealDetail table synced");

      await models.DealParticipant.sync({ alter: false, force: false });
      console.log("✅ DealParticipant table synced");

      await models.DealFile.sync({ alter: false, force: false });
      console.log("✅ DealFile table synced");

      await models.DealColumn.sync({ alter: false, force: false });
      console.log("✅ DealColumn table synced");

      await models.ContactChangeLog.sync({ alter: false, force: false });
      console.log("✅ ContactChangeLog table synced");

      await models.ContactSyncHistory.sync({ alter: false, force: false });
      console.log("✅ ContactSyncHistory table synced");

      await models.ContactSyncConfig.sync({ alter: false, force: false });
      console.log("✅ ContactSyncConfig table synced");

      await models.ContactSyncMapping.sync({ alter: false, force: false });
      console.log("✅ ContactSyncMapping table synced");

      await models.CompanySetting.sync({ alter: false, force: false });
      console.log("✅ CompanySetting table synced");

      await models.Activity.sync({ alter: false, force: false });
      console.log("✅ Activity table synced");

      await models.ActivityColumn.sync({ alter: false, force: false });
      console.log("✅ ActivityColumn table synced");

      await models.ActivitySetting.sync({ alter: false, force: false });
      console.log("✅ ActivitySetting table synced");

      await models.ActivityType.sync({ alter: false, force: false });
      console.log("✅ ActivityType table synced");

      await models.Meeting.sync({ alter: false, force: false });
      console.log("✅ Meeting table synced");

      await models.SchedulingLink.sync({ alter: false, force: false });
      console.log("✅ SchedulingLink table synced");

      await models.MiscSetting.sync({ alter: false, force: false });
      console.log("✅ MiscSetting table synced");

      await models.Notification.sync({ alter: false, force: false });
      console.log("✅ Notification table synced");

      await models.NotificationPreference.sync({ alter: false, force: false });
      console.log("✅ NotificationPreference table synced");

      await models.PushSubscription.sync({ alter: false, force: false });
      console.log("✅ PushSubscription table synced");

      await models.MasterUserPrivileges.sync({ alter: false, force: false });
      console.log("✅ MasterUserPrivileges table synced");

      await models.Product.sync({ alter: false, force: false });
      console.log("✅ Product table synced");

      await models.ProductVariation.sync({ alter: false, force: false });
      console.log("✅ ProductVariation table synced");

      await models.DealProduct.sync({ alter: false, force: false });
      console.log("✅ DealProduct table synced");

      await models.ProductColumn.sync({ alter: false, force: false });
      console.log("✅ ProductColumn table synced");

      await models.Automation.sync({ alter: false, force: false });
      console.log("✅ Automation table synced");

      await models.EmailTemplate.sync({ alter: false, force: false });
      console.log("✅ EmailTemplate table synced");

      await models.MergeMap.sync({ alter: false, force: false });
      console.log("✅ MergeMap table synced");

      await models.TagMap.sync({ alter: false, force: false });
      console.log("✅ TagMap table synced");

      await models.WebFormField.sync({ alter: false, force: false });
      console.log("✅ WebFormField table synced");

      await models.WebFormSubmission.sync({ alter: false, force: false });
      console.log("✅ WebFormSubmission table synced");

      await models.WebFormTracking.sync({ alter: false, force: false });
      console.log("✅ WebFormTracking table synced");

      await models.WebForm.sync({ alter: false, force: false });
      console.log("✅ WebForm table synced");

      await models.StartupQuestion.sync({ alter: false, force: false });
      console.log("✅ StartupQuestion table synced");

      console.log("✅ All models synced successfully");


      await this.ensureDefaultPermissionSet(models);
      await this.ensureDefaultGroupVisibility(models);
      await this.ensureDefaultLeadColumnPreferences(models);
      await this.ensureDefaultOrganizationColumnPreferences(models);
      await this.ensureDefaultDealColumnPreferences(models);
      await this.ensureDefaultActivityColumnPreferences(models);
      await this.ensureDefaultProductColumnPreferences(models);
      await this.ensureDefaultPersonColumnPreferences(models);
      await this.ensureDefaultCurrencies(models);
      // Note: CustomFields are NOT seeded by default - users create them as needed
      await this.ensureDefaultPrograms(models);
      
    } catch (error) {
      console.error("❌ Error syncing models:", error);
      
      // More detailed error information
      if (error.original && error.original.code === 'ER_CANT_CREATE_TABLE') {
        console.error("Foreign key constraint error details:");
        console.error("SQL:", error.sql);
        
        // Try syncing without foreign keys first
        console.log("🔄 Attempting to sync without foreign keys...");
        
        // Drop foreign key constraint and retry
        try {
          await connection.query('SET FOREIGN_KEY_CHECKS = 0');
          
          // Sync tables without foreign key constraints
      await models.MasterUser.sync({ alter: false, force: false });
      await models.AuditTrail.sync({ alter: false, force: false });
      await models.History.sync({ alter: false, force: false });
      await models.LoginHistory.sync({ alter: false, force: false });
      await models.RecentLoginHistory.sync({ alter: false, force: false });
      await models.Admin.sync({ alter: false, force: false });
      await models.CustomField.sync({ alter: false, force: false });
      await models.CustomFieldValue.sync({ alter: false, force: false });
      await models.PermissionSet.sync({ alter: false, force: false });
      await models.RecentSearch.sync({ alter: false, force: false });
      await models.UserInterfacePreference.sync({ alter: false, force: false });
      await models.Country.sync({ alter: false, force: false });
      await models.Currency.sync({ alter: false, force: false });
      await models.Department.sync({ alter: false, force: false });
      await models.Designation.sync({ alter: false, force: false });
      await models.Label.sync({ alter: false, force: false });
      await models.Organization.sync({ alter: false, force: false });
      await models.Program.sync({ alter: false, force: false });
      await models.Region.sync({ alter: false, force: false });
      await models.Scope.sync({ alter: false, force: false });
      await models.Sectoralscope.sync({ alter: false, force: false });
      await models.Status.sync({ alter: false, force: false });
      await models.GroupVisibility.sync({ alter: false, force: false });
      await models.ItemVisibilityRule.sync({ alter: false, force: false });
      await models.GroupMembership.sync({ alter: false, force: false });
      await models.VisibilityGroup.sync({ alter: false, force: false });
      await models.Pipeline.sync({ alter: false, force: false });
      await models.PipelineStage.sync({ alter: false, force: false });
      await models.PipelineVisibilityRule.sync({ alter: false, force: false });
      await models.LeadColumn.sync({ alter: false, force: false });
      await models.LeadOrganization.sync({ alter: false, force: false });
      await models.OrganizationColumnPreference.sync({ alter: false, force: false });
      await models.OrganizationFile.sync({ alter: false, force: false });
      await models.OrganizationNote.sync({ alter: false, force: false });
      await models.OrganizationSidebarPreference.sync({ alter: false, force: false });
      await models.LeadPerson.sync({ alter: false, force: false });
      await models.PersonColumnPreference.sync({ alter: false, force: false });
      await models.PersonFile.sync({ alter: false, force: false });
      await models.PersonNote.sync({ alter: false, force: false });
      await models.PersonSidebarPreference.sync({ alter: false, force: false });
      await models.Lead.sync({ alter: false, force: false });
      await models.LeadNote.sync({ alter: false, force: false });
      await models.LeadFilter.sync({ alter: false, force: false });
      await models.LeadDetail.sync({ alter: false, force: false });
      await models.LeadColumnPreference.sync({ alter: false, force: false });
      await models.EntityFile.sync({ alter: false, force: false });
      await models.Dashboard.sync({ alter: false, force: false });
      await models.Card.sync({ alter: false, force: false });
      await models.Goal.sync({ alter: false, force: false });
      await models.ReportFolder.sync({ alter: false, force: false });
      await models.Report.sync({ alter: false, force: false });
      await models.ImportData.sync({ alter: false, force: false });
      await models.UserGoogleToken.sync({ alter: false, force: false });
      await models.UserFavorite.sync({ alter: false, force: false });
      await models.Email.sync({ alter: false, force: false });
      await models.Attachment.sync({ alter: false, force: false });
      await models.DefaultEmail.sync({ alter: false, force: false });
      await models.Template.sync({ alter: false, force: false });
      await models.UserCredential.sync({ alter: false, force: false });
      await models.DeviceActivity.sync({ alter: false, force: false });
      await models.LostReason.sync({ alter: false, force: false });
      await models.LostReasonSetting.sync({ alter: false, force: false });
      await models.Deal.sync({ alter: false, force: false });
      await models.DealStageHistory.sync({ alter: false, force: false });
      await models.DealNote.sync({ alter: false, force: false });
      await models.DealDetail.sync({ alter: false, force: false });
      await models.DealParticipant.sync({ alter: false, force: false });
      await models.DealFile.sync({ alter: false, force: false });
      await models.DealColumn.sync({ alter: false, force: false });
      await models.ContactChangeLog.sync({ alter: false, force: false });
      await models.ContactSyncHistory.sync({ alter: false, force: false });
      await models.ContactSyncConfig.sync({ alter: false, force: false });
      await models.ContactSyncMapping.sync({ alter: false, force: false });
      await models.CompanySetting.sync({ alter: false, force: false });
      await models.Activity.sync({ alter: false, force: false });
      await models.ActivityColumn.sync({ alter: false, force: false });
      await models.ActivitySetting.sync({ alter: false, force: false });
      await models.ActivityType.sync({ alter: false, force: false });
      await models.Meeting.sync({ alter: false, force: false });
      await models.SchedulingLink.sync({ alter: false, force: false });
      await models.MiscSetting.sync({ alter: false, force: false });
      await models.Notification.sync({ alter: false, force: false });
      await models.NotificationPreference.sync({ alter: false, force: false });
      await models.PushSubscription.sync({ alter: false, force: false });
      await models.MasterUserPrivileges.sync({ alter: false, force: false });
      await models.Product.sync({ alter: false, force: false });
      await models.ProductVariation.sync({ alter: false, force: false });
      await models.DealProduct.sync({ alter: false, force: false });
      await models.ProductColumn.sync({ alter: false, force: false });
      await models.Automation.sync({ alter: false, force: false });
      await models.EmailTemplate.sync({ alter: false, force: false });
      await models.MergeMap.sync({ alter: false, force: false });
      await models.TagMap.sync({ alter: false, force: false });
      await models.WebFormField.sync({ alter: false, force: false });
      await models.WebFormSubmission.sync({ alter: false, force: false });
      await models.WebFormTracking.sync({ alter: false, force: false });
      await models.WebForm.sync({ alter: false, force: false });
      await models.StartupQuestion.sync({ alter: false, force: false });

          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
          
          console.log("✅ Models synced with foreign keys disabled/enabled");
        } catch (retryError) {
          console.error("❌ Even sync without foreign keys failed:", retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }
  

  static async ensureDefaultGroupVisibility(models) {
  try {
    const { GroupVisibility } = models;
    
    // Check if default permission set already exists
    const existingGroupVisibility = await GroupVisibility.findOne({
      where: { isDefault: 1 }
    });
    
    if (existingGroupVisibility) {
      console.log("✅ Default GroupVisibility already exists, skipping creation");
      return existingGroupVisibility;
    }

    
    const defaultGroupVisibility = await GroupVisibility.create({
      groupName: 'Default',
      description: 'should add by default to all created users',
      isDefault : 1,
      isActive : 1,
      lead : "everyone",
      deal : "everyone",
      person : "everyone",
      Organization : "everyone",
    });
    
    console.log(`✅ Default PermissionSet created with ID: ${defaultGroupVisibility.groupId}`);
    
    return defaultGroupVisibility;
  } catch (error) {
    console.error("❌ Error creating default permission set:", error);
    throw error;
  }
  }


  static async ensureDefaultPermissionSet(models) {
  try {
    const { PermissionSet } = models;
    
    // Check if default permission set already exists
    const existingPermissionSet = await PermissionSet.findOne({
      where: { name: 'Default' }
    });
    
    if (existingPermissionSet) {
      console.log("✅ Default PermissionSet already exists, skipping creation");
      return existingPermissionSet;
    }
    
    // Create default permission set
    const defaultPermissions = {
      "0": true, "1": true, "2": true, "3": true, "4": true, "5": true,
      "6": true, "7": true, "8": true, "9": true, "10": true, "11": true,
      "12": true, "13": true, "14": true, "15": true, "16": true, "17": true,
      "18": false, "19": true, "20": true, "21": true, "22": true, "23": true,
      "24": true, "25": true, "26": true, "27": true, "28": true, "29": true,
      "30": true
    };
    
    const defaultPermissionSet = await PermissionSet.create({
      name: 'Default',
      groupName: 'Deal',
      description: 'should add by default to all created users',
      permissions: defaultPermissions
    });
    
    console.log(`✅ Default PermissionSet created with ID: ${defaultPermissionSet.permissionSetId}`);
    
    return defaultPermissionSet;
  } catch (error) {
    console.error("❌ Error creating default permission set:", error);
    throw error;
  }
  }

  static async ensureDefaultLeadColumnPreferences(models) {
  try {
    const { LeadColumnPreference } = models;
    
    // Check if default lead column preferences already exist
    const existingPreferences = await LeadColumnPreference.findOne({
      where: { masterUserID: null }
    });
    
    if (existingPreferences) {
      console.log("✅ Default LeadColumnPreferences already exist, skipping creation");
      return existingPreferences;
    }
    
    // Default columns configuration from migration
    const defaultColumns = [
      {"key":"contactPerson","check":true},
      {"key":"value","check":false},
      {"key":"valueCurrency","check":true},
      {"key":"organization","check":true},
      {"key":"title","check":true},
      {"key":"valueLabels","check":true},
      {"key":"expectedCloseDate","check":true},
      {"key":"sourceChannel","check":true},
      {"key":"phone","check":true},
      {"key":"email","check":true},
      {"key":"organizationCountry","check":true},
      {"key":"status","check":true},
      {"key":"isArchived","check":true},
      {"key":"archiveTime","check":true},
      {"key":"ownerName","check":true},
      {"key":"createdAt","check":false},
      {"key":"updatedAt","check":false},
      {"key":"numberOfReportsPrepared","check":false},
      {"key":"sectoralSector","check":false},
      {"key":"seen","check":false},
      {"key":"visibleTo","check":false},
      {"key":"RFP_receivedDate","check":false},
      {"key":"statusSummary","check":false},
      {"key":"responsiblePerson","check":false},
      {"key":"organizationName","check":false},
      {"key":"sourceOrgin","check":true},
      {"key":"personName","check":false},
      {"key":"notes","check":false},
      {"key":"postalAddress","check":false},
      {"key":"birthday","check":false},
      {"key":"jobTitle","check":false},
      {"key":"currency","check":false},
      {"key":"nextActivityDate","check":false},
      {"key":"nextActivityStatus","check":false},
      {"key":"address","check":false},
      {"key":"espl_proposal_no","label":"ESPL Proposal No","type":"text","isCustomField":true,"fieldId":29,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":true},
      {"key":"no._of_reports_prepared_for_the_project","label":"No. of reports prepared for the project","type":"singleselect","isCustomField":true,"fieldId":105,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"organization_country","label":"Organization Country","type":"text","isCustomField":true,"fieldId":31,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"project_location","label":"Project Location","type":"text","isCustomField":true,"fieldId":30,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"proposal_sent_date","label":"Proposal Sent Date","type":"date","isCustomField":true,"fieldId":32,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"proposal_value","label":"Proposal Value","type":"text","isCustomField":true,"fieldId":28,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"questioner_shared?","label":"Questioner Shared?","type":"singleselect","isCustomField":true,"fieldId":104,"isRequired":false,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"sbu_class","label":"SBU Class","type":"singleselect","isCustomField":true,"fieldId":35,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"scope_of_service_type","label":"Scope of Service Type","type":"singleselect","isCustomField":true,"fieldId":27,"isRequired":false,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"sectoral_sector","label":"Sectoral Sector","type":"multiselect","isCustomField":true,"fieldId":34,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"service_type","label":"Service Type","type":"text","isCustomField":true,"fieldId":26,"isRequired":false,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":false},
      {"key":"source","label":"Source","type":"singleselect","isCustomField":true,"fieldId":33,"isRequired":true,"isImportant":true,"fieldSource":"custom","entityType":"lead","check":true}
    ];
    
    const defaultPreferences = await LeadColumnPreference.create({
      masterUserID: null,
      columns: defaultColumns
    });
    
    console.log(`✅ Default LeadColumnPreferences created with ID: ${defaultPreferences.id}`);
    
    return defaultPreferences;
  } catch (error) {
    console.error("❌ Error creating default lead column preferences:", error);
    throw error;
  }
  }

  static async ensureDefaultOrganizationColumnPreferences(models) {
  try {
    const { OrganizationColumnPreference } = models;
    
    // Check if default organization column preferences already exist
    const existingPreferences = await OrganizationColumnPreference.findOne({
      where: { masterUserID: null }
    });
    
    if (existingPreferences) {
      console.log("✅ Default OrganizationColumnPreferences already exist, skipping creation");
      return existingPreferences;
    }
    
    // Default columns configuration from migration
    const defaultColumns = [
      {"key":"organization","check":true},
      {"key":"organizationLabels","check":true},
      {"key":"address","check":true},
      {"key":"visibleTo","check":true},
      {"key":"ownerName","check":true},
      {"key":"wonDeals","check":true},
      {"key":"lostDeals","check":true},
      {"key":"openDeals","check":true},
      {"key":"peopleCount","check":true},
      {"key":"lastActivityDate","check":true},
      {"key":"nextActivityDate","check":true},
      {"key":"doneActivitiesCount","check":true},
      {"key":"totalActivitiesCount","check":true},
      {"key":"activitiesTodoCount","check":false},
      {"key":"createdAt","check":false},
      {"key":"updatedAt","check":false}
    ];
    
    const defaultPreferences = await OrganizationColumnPreference.create({
      masterUserID: null,
      columns: defaultColumns
    });
    
    console.log(`✅ Default OrganizationColumnPreferences created with ID: ${defaultPreferences.id}`);
    
    return defaultPreferences;
  } catch (error) {
    console.error("❌ Error creating default organization column preferences:", error);
    throw error;
  }
  }

  /**
    * Ensure default DealColumns exist in the database
    */
  static async ensureDefaultDealColumnPreferences(models) {
  try {
    const { DealColumn } = models;
    
    // Check if default preferences already exist
    const existingPreferences = await DealColumn.findOne({
    where: { masterUserID: null }
    });
    
    if (existingPreferences) {
    console.log("✅ Default DealColumns already exist, skipping creation");
    return existingPreferences;
    }
    
    // Create default deal column preferences with masterUserID = null (global defaults)
    const defaultColumns = [
    {"key":"contactPerson","check":true},{"key":"organization","check":true},{"key":"title","check":true},{"key":"value","check":true},{"key":"valueCurrency","check":true},{"key":"pipeline","check":false},{"key":"pipelineStage","check":true},{"key":"label","check":true},{"key":"expectedCloseDate","check":true},{"key":"sourceChannel","check":false},{"key":"sourceRequired","check":false},{"key":"phone","check":false},{"key":"email","check":true},{"key":"sourceOrgin","check":false},{"key":"isArchived","check":true},{"key":"status","check":true},{"key":"createdAt","check":true},{"key":"updatedAt","check":true},{"key":"statusSummary","check":false},{"key":"responsiblePerson","check":false},{"key":"rfpReceivedDate","check":false},{"key":"ownerName","check":true},{"key":"wonTime","check":false},{"key":"lostTime","check":false},{"key":"lostReason","check":true},{"key":"dealClosedOn","check":true},{"key":"nextActivityDate","check":false}
    ];
    
    const dealColumnsData = await DealColumn.create({
    masterUserID: null,
    columns: defaultColumns  // Don't stringify - Sequelize handles JSON columns automatically
    });
    
    console.log(`✅ Default DealColumns created with ID: ${dealColumnsData.id}`);
    return dealColumnsData;
    
  } catch (error) {
    console.error("Error ensuring default DealColumns:", error);
    throw error;
  }
  }

  /**
    * Ensure default ActivityColumns exist in the database
    */
  static async ensureDefaultActivityColumnPreferences(models) {
  try {
    const { ActivityColumn } = models;
    
    // Check if default preferences already exist
    const existingPreferences = await ActivityColumn.findOne({
    where: { masterUserID: null }
    });
    
    if (existingPreferences) {
    console.log("✅ Default ActivityColumns already exist, skipping creation");
    return existingPreferences;
    }
    
    // Create default activity column preferences with masterUserID = null (global defaults)
    const defaultColumns = [
    {"key":"subject","check":false,"entityType":"Activity"},{"key":"priority","check":false,"entityType":"Activity"},{"key":"location","check":false,"entityType":"Activity"},{"key":"videoCallIntegration","check":false,"entityType":"Activity"},{"key":"description","check":false,"entityType":"Activity"},{"key":"status","check":false,"entityType":"Activity"},{"key":"notes","check":false,"entityType":"Activity"},{"key":"assignedTo","check":true,"entityType":"Activity"},{"key":"isDone","check":true,"entityType":"Activity"},{"key":"contactPerson","check":true,"entityType":"Activity"},{"key":"email","check":true,"entityType":"Activity"},{"key":"organization","check":true,"entityType":"Activity"},{"key":"dueDate","check":true,"entityType":"Activity"},{"key":"markedAsDoneTime","check":false,"entityType":"Activity"},{"key":"createdAt","check":false,"entityType":"Activity"},{"key":"updatedAt","check":false,"entityType":"Activity"},{"key":"contactPerson","check":false,"entityType":"Deal"},{"key":"valueCurrency","check":false,"entityType":"Deal"},{"key":"organization","check":true,"entityType":"Deal"},{"key":"title","check":false,"entityType":"Deal"},{"key":"value","check":false,"entityType":"Deal"},{"key":"pipeline","check":false,"entityType":"Deal"},{"key":"pipelineStage","check":false,"entityType":"Deal"},{"key":"label","check":false,"entityType":"Deal"},{"key":"expectedCloseDate","check":false,"entityType":"Deal"},{"key":"sourceChannel","check":false,"entityType":"Deal"},{"key":"sourceRequired","check":false,"entityType":"Deal"},{"key":"sectorialSector","check":false,"entityType":"Deal"},{"key":"phone","check":false,"entityType":"Deal"},{"key":"email","check":true,"entityType":"Deal"},{"key":"sourceOrgin","check":false,"entityType":"Deal"},{"key":"isArchived","check":false,"entityType":"Deal"},{"key":"status","check":false,"entityType":"Deal"},{"key":"createdAt","check":false,"entityType":"Deal"},{"key":"updatedAt","check":false,"entityType":"Deal"},{"key":"statusSummary","check":false,"entityType":"Deal"},{"key":"responsiblePerson","check":false,"entityType":"Deal"},{"key":"rfpReceivedDate","check":false,"entityType":"Deal"},{"key":"ownerName","check":false,"entityType":"Deal"},{"key":"wonTime","check":false,"entityType":"Deal"},{"key":"lostTime","check":false,"entityType":"Deal"},{"key":"countryOfOrganizationCountry","check":false,"entityType":"Deal"},{"key":"lostReason","check":false,"entityType":"Deal"},{"key":"dealClosedOn","check":false,"entityType":"Deal"},{"key":"nextActivityDate","check":true,"entityType":"Deal"},{"key":"stateAndCountryProjectLocation","check":false,"entityType":"Deal"}
    ];
    
    const activityColumnsData = await ActivityColumn.create({
    masterUserID: null,
    columns: defaultColumns  // Don't stringify - Sequelize handles JSON columns automatically
    });
    
    console.log(`✅ Default ActivityColumns created with ID: ${activityColumnsData.id}`);
    return activityColumnsData;
    
  } catch (error) {
    console.error("Error ensuring default ActivityColumns:", error);
    throw error;
  }
  }

  /**
    * Ensure default ProductColumns exist in the database
    */
  static async ensureDefaultProductColumnPreferences(models) {
  try {
    const { ProductColumn } = models;
    
    // Check if default preferences already exist
    const existingPreferences = await ProductColumn.findOne({
    where: { masterUserID: null }
    });
    
    if (existingPreferences) {
    console.log("✅ Default ProductColumns already exist, skipping creation");
    return existingPreferences;
    }
    
    // Create default product column preferences with masterUserID = null (global defaults)
    const defaultColumns = [
    {"key":"name","check":true},{"key":"code","check":true},{"key":"unit","check":true},{"key":"quantity","check":false},{"key":"tax","check":true},{"key":"cost","check":true},{"key":"costCurrency","check":true},{"key":"pricePerUnit","check":false},{"key":"priceCurrency","check":false},{"key":"category","check":true},{"key":"description","check":false},{"key":"activeFlag","check":false},{"key":"customCategory","check":false},{"key":"customUnit","check":false},{"key":"ownerId","check":true},{"key":"ownerName","check":true},{"key":"createdAt","check":false},{"key":"updatedAt","check":false},{"key":"createdById","check":false},{"key":"createdBy","check":false},{"key":"dealCount","check":true},{"key":"totalRevenue","check":true},{"key":"wonDealsCount","check":false},{"key":"lostDealsCount","check":false}
    ];
    
    const productColumnsData = await ProductColumn.create({
    masterUserID: null,
    columns: defaultColumns  // Don't stringify - Sequelize handles JSON columns automatically
    });
    
    console.log(`✅ Default ProductColumns created with ID: ${productColumnsData.id}`);
    return productColumnsData;
    
  } catch (error) {
    console.error("Error ensuring default ProductColumns:", error);
    throw error;
  }
  }

  /**
    * Ensure default PersonColumnPreferences exist in the database
    */
  static async ensureDefaultPersonColumnPreferences(models) {
  try {
    const { PersonColumnPreference } = models;
    
    // Check if default preferences already exist
    const existingPreferences = await PersonColumnPreference.findOne({
    where: { masterUserID: null }
    });
    
    if (existingPreferences) {
    console.log("✅ Default PersonColumnPreferences already exist, skipping creation");
    return existingPreferences;
    }
    
    // Create default person column preferences with masterUserID = null (global defaults)
    const defaultColumns = [
    {"key":"contactPerson","check":false},{"key":"email","check":false},{"key":"phone","check":false},{"key":"notes","check":false},{"key":"postalAddress","check":false},{"key":"birthday","check":false},{"key":"jobTitle","check":false},{"key":"personLabels","check":false},{"key":"organization","check":false},{"key":"emails","check":false},{"key":"phones","check":false},{"key":"ownerName","check":false},{"key":"wonDeals","check":false},{"key":"lostDeals","check":false},{"key":"openDeals","check":false},{"key":"peopleCount","check":false},{"key":"lastActivityDate","check":false},{"key":"nextActivityDate","check":false},{"key":"doneActivitiesCount","check":false},{"key":"totalActivitiesCount","check":false},{"key":"activitiesTodoCount","check":false},{"key":"createdAt","check":true},{"key":"updatedAt","check":false}
    ];
    
    const personColumnsData = await PersonColumnPreference.create({
    masterUserID: null,
    columns: defaultColumns  // Don't stringify - Sequelize handles JSON columns automatically
    });
    
    console.log(`✅ Default PersonColumnPreferences created with ID: ${personColumnsData.id}`);
    return personColumnsData;
    
  } catch (error) {
    console.error("Error ensuring default PersonColumnPreferences:", error);
    throw error;
  }
  }

  /**
    * Ensure default Currencies exist in the database
    */
  static async ensureDefaultCurrencies(models) {
  try {
    const { Currency } = models;
    
    // Check if default currencies already exist
    const existingCurrencies = await Currency.findAll();
    
    if (existingCurrencies && existingCurrencies.length > 0) {
    console.log(`✅ Default Currencies already exist (${existingCurrencies.length} records), skipping creation`);
    return existingCurrencies;
    }
    
    // Create default currencies with all required fields
    const defaultCurrencies = [
    {
      currency_desc: 'US Dollar',
      symbol: '$',
      code: 'USD',
      decimalPoints: 2,
      isActive: true,
      isCustom: false,
      creationDate: new Date(),
      createdBy: 'system',
      createdById: 0,
      mode: 'added'
    },
    {
      currency_desc: 'Indian Rupee',
      symbol: '₹',
      code: 'INR',
      decimalPoints: 2,
      isActive: true,
      isCustom: false,
      creationDate: new Date(),
      createdBy: 'system',
      createdById: 0,
      mode: 'added'
    },
    {
      currency_desc: 'Euro',
      symbol: '€',
      code: 'EUR',
      decimalPoints: 2,
      isActive: true,
      isCustom: false,
      creationDate: new Date(),
      createdBy: 'system',
      createdById: 0,
      mode: 'added'
    },
    {
      currency_desc: 'British Pound',
      symbol: '£',
      code: 'GBP',
      decimalPoints: 2,
      isActive: true,
      isCustom: false,
      creationDate: new Date(),
      createdBy: 'system',
      createdById: 0,
      mode: 'added'
    }
    ];
    
    const currenciesData = await Currency.bulkCreate(defaultCurrencies);
    
    console.log(`✅ Default Currencies created (${currenciesData.length} records)`);
    return currenciesData;
    
  } catch (error) {
    console.error("Error ensuring default Currencies:", error);
    throw error;
  }
  }

  /**
    * Ensure default CustomFields exist in the database
    * @param {Object} models - The models object
    * @param {number} masterUserID - The masterUserID to assign to the custom fields
    */
  static async ensureDefaultCustomFields(models, masterUserID) {
  try {
    const { CustomField } = models;
    
    // Check if default custom fields already exist (check for system-created fields)
    const existingFields = await CustomField.findAll({
      where: { fieldSource: 'system', masterUserID: masterUserID }
    });
    
    if (existingFields && existingFields.length > 0) {
      console.log(`✅ Default CustomFields already exist (${existingFields.length} records), skipping creation`);
      return existingFields;
    }
    
    // Create default custom fields - these are common fields that can be used across tenants
    const defaultCustomFields = [
      {
        fieldName: 'service_type',
        fieldLabel: 'Service Type',
        fieldType: 'text',
        fieldSource: 'system',
        entityType: 'lead',
        isRequired: false,
        isActive: true,
        displayOrder: 2,
        isImportant: true,
        category: 'Details',
        fieldGroup: 'Digital',
        masterUserID: masterUserID,
        showInAddView: true,
        showInDetailView: true,
        showInListView: false,
        leadView: true,
        dealView: true,
        check: false,
        dealCheck: false,
        sortOrder: 2
      },
      {
        fieldName: 'proposal_value',
        fieldLabel: 'Proposal Value',
        fieldType: 'text',
        fieldSource: 'system',
        entityType: 'lead',
        isRequired: true,
        isActive: true,
        displayOrder: 1,
        isImportant: true,
        category: 'Details',
        fieldGroup: 'Digital',
        description: 'Proposal Value',
        masterUserID: masterUserID,
        showInAddView: true,
        showInDetailView: true,
        showInListView: false,
        leadView: true,
        dealView: true,
        check: true,
        dealCheck: false,
        sortOrder: 1
      },
      {
        fieldName: 'espl_proposal_no',
        fieldLabel: 'ESPL Proposal No',
        fieldType: 'text',
        fieldSource: 'system',
        entityType: 'lead',
        isRequired: true,
        isActive: true,
        displayOrder: 3,
        isImportant: true,
        category: 'Details',
        fieldGroup: 'Digital',
        description: 'ESPL Proposal No.',
        masterUserID: masterUserID,
        showInAddView: true,
        showInDetailView: true,
        showInListView: false,
        leadView: true,
        dealView: true,
        check: true,
        dealCheck: false,
        sortOrder: 3
      },
      {
        fieldName: 'project_location',
        fieldLabel: 'Project Location',
        fieldType: 'text',
        fieldSource: 'system',
        entityType: 'lead',
        isRequired: true,
        isActive: true,
        displayOrder: 4,
        isImportant: true,
        category: 'Details',
        fieldGroup: 'Digital',
        description: 'Project Location',
        masterUserID: masterUserID,
        showInAddView: true,
        showInDetailView: true,
        showInListView: false,
        leadView: true,
        dealView: true,
        check: false,
        dealCheck: false,
        sortOrder: 4
      },
      {
        fieldName: 'organization_country',
        fieldLabel: 'Organization Country',
        fieldType: 'text',
        fieldSource: 'system',
        entityType: 'lead',
        isRequired: true,
        isActive: true,
        displayOrder: 5,
        isImportant: true,
        category: 'Details',
        fieldGroup: 'Digital',
        description: 'Organization Country',
        masterUserID: masterUserID,
        showInAddView: true,
        showInDetailView: true,
        showInListView: false,
        leadView: true,
        dealView: true,
        check: false,
        dealCheck: false,
        sortOrder: 5
      },
      {
        fieldName: 'proposal_sent_date',
        fieldLabel: 'Proposal Sent Date',
        fieldType: 'date',
        fieldSource: 'system',
        entityType: 'lead',
        isRequired: true,
        isActive: true,
        displayOrder: 6,
        isImportant: true,
        category: 'Details',
        fieldGroup: 'Digital',
        description: 'Proposal Sent Date',
        masterUserID: masterUserID,
        showInAddView: true,
        showInDetailView: true,
        showInListView: false,
        leadView: true,
        dealView: true,
        check: false,
        dealCheck: false,
        sortOrder: 6
      },
      {
        fieldName: 'source',
        fieldLabel: 'Source',
        fieldType: 'singleselect',
        fieldSource: 'system',
        entityType: 'lead',
        options: ['InBound', 'Outbound', 'None'],
        isRequired: true,
        isActive: true,
        displayOrder: 7,
        isImportant: true,
        category: 'Details',
        fieldGroup: 'Digital',
        description: 'Source',
        masterUserID: masterUserID,
        showInAddView: true,
        showInDetailView: true,
        showInListView: false,
        leadView: true,
        dealView: true,
        check: false,
        dealCheck: false,
        sortOrder: 7
      }
    ];
    
    const customFieldsData = await CustomField.bulkCreate(defaultCustomFields);
    
    console.log(`✅ Default CustomFields created (${customFieldsData.length} records)`);
    return customFieldsData;
    
  } catch (error) {
    console.error("Error ensuring default CustomFields:", error);
    throw error;
  }
  }

  /**
    * Ensure default Programs exist in the database
    */
  static async ensureDefaultPrograms(models) {
  try {
    const { Program } = models;
    
    // Check if default programs already exist
    const existingPrograms = await Program.findAll();
    
    if (existingPrograms && existingPrograms.length > 0) {
      console.log(`✅ Default Programs already exist (${existingPrograms.length} records), skipping creation`);
      return existingPrograms;
    }
    
    // Create default programs - these are system modules/features
    const defaultPrograms = [
      { program_desc: 'DASHBOARD', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'LEADS', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'DEALS', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'SALES INBOX', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'CONTACTS', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'CALENDAR', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'DESIGNATION', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'DEPARTMENT', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'STATUS', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'ORGANIZATION', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'CURRENCY', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'SCOPE', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'SECTORALSCOPE', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'COUNTRY', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'REGION', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'LOGIN HISTORY', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'AUDIT HISTORY', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'HISTORY', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'USER MASTER', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'USER PRIVILEGES', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' },
      { program_desc: 'SETTINGS', creationDate: new Date(), createdBy: 'system', createdById: 0, mode: 'added' }
    ];
    
    const programsData = await Program.bulkCreate(defaultPrograms);
    
    console.log(`✅ Default Programs created (${programsData.length} records)`);
    return programsData;
    
  } catch (error) {
    console.error("Error ensuring default Programs:", error);
    throw error;
  }
  }

  /**
    * Connect to client database and ensure user exists
    */
  static async connectAndEnsureUser(email, password) {
  try {
    // Step 1: Get client configuration
    const client = await getClientConfig(email, password);
    
    // Step 2: Connect to client's database
    const clientConnection = await getClientDbConnection(client);
    
    // Step 3: Get all models with associations
    const models = this.getAllModels(clientConnection);
    
    // Step 4: Sync all models in correct order
    await this.syncModels(clientConnection, models);
    
    // Step 5: Create default permission set if it doesn't exist
    await this.ensureDefaultPermissionSet(models);

    // Step 6: Create default group visibility if it doesn't exist
    await this.ensureDefaultGroupVisibility(models);
    
    // Step 7: Create default lead column preferences if it doesn't exist
    await this.ensureDefaultLeadColumnPreferences(models);
    
    // Step 8: Create default organization column preferences if it doesn't exist
    await this.ensureDefaultOrganizationColumnPreferences(models);
    
    // Step 9: Create default deal column preferences if it doesn't exist
    await this.ensureDefaultDealColumnPreferences(models);
    
    // Step 10: Create default activity column preferences if it doesn't exist
    await this.ensureDefaultActivityColumnPreferences(models);
    
    // Step 11: Create default product column preferences if it doesn't exist
    await this.ensureDefaultProductColumnPreferences(models);
    
    // Step 12: Create default person column preferences if it doesn't exist
    await this.ensureDefaultPersonColumnPreferences(models);
    
    // Step 13: Create default currencies if they don't exist
    await this.ensureDefaultCurrencies(models);
    
    // Step 14: Create default programs if they don't exist
    await this.ensureDefaultPrograms(models);
    
    // Step 15: Check if user exists, create if not (with permission set assignment)
    const userInfo = await this.ensureUserExists(
      models.MasterUser, 
      models.PermissionSet,
      models.GroupVisibility,
      email, 
      password, 
      client
    );
    
    // Note: CustomFields are NOT seeded - users create them as needed via the UI
    
    return {
      clientConnection,
      clientConfig: client,
      user: userInfo.user,
      isNewUser: userInfo.isNew,
      models
    };
    
  } catch (error) {
    console.error("Error in connectAndEnsureUser:", error);
    throw error;
  }
  }
   
   /**
    * Ensure user exists in MasterUsers table
    */
  static async ensureUserExists(MasterUserModel, PermissionSetModel, GroupVisibilityModel, email, password, clientConfig) {
  try {
    const user = await MasterUserModel.findOne({ 
      where: { email } 
    });
    
    if (user) {
      return {
        user: user.toJSON(),
        isNew: false
      };
    }
    
    // Get default permission set
    const defaultPermissionSet = await PermissionSetModel.findOne({
      where: { name: 'Default' }
    });
    
    if (!defaultPermissionSet) {
      throw new Error("Default permission set not found");
    }

    // Get default group visibility
    const defaultGroupVisibility = await GroupVisibilityModel.findOne({
      where: { isDefault: 1 }
    });
    
    if (!defaultGroupVisibility) {
      throw new Error("Default group visibility not found");
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await MasterUserModel.create({
      name: clientConfig.name || 'Admin',
      email: email,
      password: hashedPassword,
      creatorId: 1,
      createdBy: 'System',
      loginType: 'admin',
      userType: 'admin',
      mobileNumber: '0000000000',
      isActive: true,
      permissionSetId: defaultPermissionSet.permissionSetId,
      globalPermissionSetId: defaultPermissionSet.permissionSetId,
      groupId : defaultGroupVisibility.groupId
    });
    
    console.log(`✅ New user created with permissionSetId: ${defaultPermissionSet.permissionSetId}`);
    
    return {
      user: newUser.toJSON(),
      isNew: true
    };
    
  } catch (error) {
    console.error("Error ensuring user exists:", error);
    throw error;
  }
  }
   
   /**
    * Verify user in client database (for signin)
    */
  static async verifyUserInDatabase(email, password) {
  try {
    const { centralSequelize } = require("./db");
    
    // Get client with plan details
    const [client] = await centralSequelize.query(
      `SELECT * FROM client WHERE email = ? LIMIT 1`,
      {
        replacements: [email],
        type: centralSequelize.QueryTypes.SELECT
      }
    );
    
    if (!client) {
      throw new Error("Client not found");
    }
    
    // Get plan details with features
    let planDetails = null;
    if (client.planId) {
      planDetails = await this.getPlanWithFeatures(client.planId, centralSequelize);
    }
    
    const clientConnection = await getClientDbConnection(client);
    const models = this.getAllModels(clientConnection);
    
    await this.syncModels(clientConnection, models);
    
    // Ensure default permission set exists
    await this.ensureDefaultPermissionSet(models);

    // Ensure default group visibility exists
    await this.ensureDefaultGroupVisibility(models);
    
    // Ensure default lead column preferences exist
    await this.ensureDefaultLeadColumnPreferences(models);
    
    // Ensure default organization column preferences exist
    await this.ensureDefaultOrganizationColumnPreferences(models);
    
    // Ensure default deal column preferences exist
    await this.ensureDefaultDealColumnPreferences(models);
    
    // Ensure default activity column preferences exist
    await this.ensureDefaultActivityColumnPreferences(models);
    
    // Ensure default product column preferences exist
    await this.ensureDefaultProductColumnPreferences(models);
    
    // Ensure default person column preferences exist
    await this.ensureDefaultPersonColumnPreferences(models);
    
    // Ensure default currencies exist
    await this.ensureDefaultCurrencies(models);
    
    // Ensure default programs exist
    await this.ensureDefaultPrograms(models);
    
    // Note: CustomFields are NOT seeded - users create them as needed
    
    const user = await models.MasterUser.findOne({ 
      where: { email } 
    });
    
    if (!user) {
      // User doesn't exist - create new user with default permission set
      const defaultPermissionSet = await models.PermissionSet.findOne({
        where: { name: 'Default' }
      });
      
      if (!defaultPermissionSet) {
        throw new Error("Default permission set not found");
      }

      // User doesn't exist - create new user with default group visibility
      const defaultGroupVisibility = await models.GroupVisibility.findOne({
        where: { isDefault: 1 }
      });
      
      if (!defaultGroupVisibility) {
        throw new Error("Default group visibility not found");
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await models.MasterUser.create({
        name: client.name || 'Admin',
        email: email,
        password: hashedPassword,
        creatorId: 1,
        createdBy: 'System',
        loginType: 'admin',
        userType: 'admin',
        mobileNumber: '0000000000',
        isActive: true,
        permissionSetId: defaultPermissionSet.permissionSetId,  
        globalPermissionSetId: defaultPermissionSet.permissionSetId,
        groupId : defaultGroupVisibility.groupId
      });
      
      console.log(`✅ New user created during signin with permissionSetId: ${defaultPermissionSet.permissionSetId}`);
      
      // Note: CustomFields are NOT seeded - users create them as needed via the UI
      
      return {
        user: newUser.toJSON(),
        creator: null, // First user doesn't have a creator
        clientConfig: client,
        planDetails,
        clientConnection,
        models
      };
    }
    
    const creator = await models.MasterUser.findOne({ 
      where: { masterUserID: user.creatorId } 
    });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }
    
    // Note: CustomFields are NOT seeded - users create them as needed
    
    return {
      user: user.toJSON(),
      creator: creator ? creator.toJSON() : null,
      clientConfig: client,
      planDetails,
      clientConnection,
      models
    };
    
  } catch (error) {
    console.error("Error verifying user:", error);
    throw error;
  }
  }
 
 // New method to get plan with features
 static async getPlanWithFeatures(planId, centralSequelize) {
   try {
     // Get plan basic details
     const [plan] = await centralSequelize.query(
       `SELECT * FROM Plan WHERE id = ? LIMIT 1`,
       {
         replacements: [planId],
         type: centralSequelize.QueryTypes.SELECT
       }
     );
     
     if (!plan) {
       return null;
     }
     
     // Get plan features with feature details
     const features = await centralSequelize.query(
       `SELECT 
         pf.id,
         pf.planId,
         pf.featureId,
         pf.value,
         pf.type,
         f.key,
         f.label
        FROM PlanFeature pf
        JOIN Feature f ON pf.featureId = f.id
        WHERE pf.planId = ?`,
       {
         replacements: [planId],
         type: centralSequelize.QueryTypes.SELECT
       }
     );
     
     // Format features
     const formattedFeatures = features.map(feature => ({
       id: feature.id,
       featureId: feature.featureId,
       key: feature.key,
       label: feature.label,
       value: feature.value,
       type: feature.type
     }));
     
     return {
       id: plan.id,
       name: plan.name,
       code: plan.code,
       description: plan.description,
       currency: plan.currency,
       unitAmount: plan.unitAmount,
       billingInterval: plan.billingInterval,
       trialPeriodDays: plan.trialPeriodDays,
       isActive: plan.isActive,
       features: formattedFeatures
     };
     
   } catch (error) {
     console.error("Error fetching plan with features:", error);
     return null;
   }
 }
   
   /**
    * Get user by ID from client database
    */
   static async getUserById(clientConfig, userId) {
     try {
       const clientConnection = await getClientDbConnection(clientConfig);
       const models = this.getAllModels(clientConnection);
       
       const user = await models.MasterUser.findByPk(userId, {
         include: [{
           model: models.LeadOrganization,
           as: 'organizations'
         }]
       });
       
       if (!user) {
         throw new Error("User not found");
       }
       
       return user.toJSON();
       
     } catch (error) {
       console.error("Error getting user by ID:", error);
       throw error;
     }
   }
}

module.exports = DatabaseConnectionManager;