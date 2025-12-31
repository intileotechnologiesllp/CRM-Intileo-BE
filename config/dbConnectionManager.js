const { getClientDbConnection, getClientConfig } = require("./db");
const bcrypt = require("bcrypt");
const {createActivityColumnModel,
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
  createUserInterfacePreferencesModel } = require("../models");
const { setupAssociations } = require("./associations");

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



      console.log("✅ All models synced successfully");
      
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
       
       // Step 5: Check if user exists, create if not
       const userInfo = await this.ensureUserExists(models.MasterUser, email, password, client);
       
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
   static async ensureUserExists(MasterUserModel, email, password, clientConfig) {
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
         isActive: true
       });
       
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
     
     const user = await models.MasterUser.findOne({ 
       where: { email } 
     });
     
     if (!user) {
       throw new Error("User not found in client database");
     }
     
     const creator = await models.MasterUser.findOne({ 
       where: { masterUserID: user.creatorId } 
     });
 
     const isPasswordValid = await bcrypt.compare(password, user.password);
     if (!isPasswordValid) {
       throw new Error("Invalid password");
     }
     
     return {
       user: user.toJSON(),
       creator: creator ? creator.toJSON() : null,
       clientConfig: client,
       planDetails, // Add plan details here
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