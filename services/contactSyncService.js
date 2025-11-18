const ContactSyncConfig = require("../models/contact/contactSyncConfigModel");
const ContactSyncHistory = require("../models/contact/contactSyncHistoryModel");
const ContactChangeLog = require("../models/contact/contactChangeLogModel");
const ContactSyncMapping = require("../models/contact/contactSyncMappingModel");
const Person = require("../models/leads/leadPersonModel");
const googleContactsService = require("./googleContactsService");
const { Op } = require("sequelize");

/**
 * Contact Sync Service
 * Handles full two-way synchronization between Google Contacts and CRM
 */
class ContactSyncService {
  /**
   * Main sync function - orchestrates the full sync process
   */
  async performSync(masterUserID, syncConfigId) {
    console.log(
      `🔄 [CONTACT SYNC] Starting sync for user ${masterUserID}, config ${syncConfigId}`
    );

    let syncHistory = null;
    const startTime = Date.now();

    try {
      // 1. Get sync configuration
      const syncConfig = await ContactSyncConfig.findOne({
        where: { syncConfigId, masterUserID, isActive: true },
      });

      if (!syncConfig) {
        throw new Error("Sync configuration not found or inactive");
      }

      // 2. Initialize sync history record
      syncHistory = await ContactSyncHistory.create({
        syncConfigId,
        masterUserID,
        syncType: "manual",
        syncDirection: syncConfig.syncMode,
        status: "in_progress",
        startedAt: new Date(),
      });

      console.log(
        `📊 [CONTACT SYNC] Sync history created: ${syncHistory.syncHistoryId}`
      );

      // 3. Initialize Google OAuth
      googleContactsService.initializeOAuth2Client({
        googleAccessToken: syncConfig.googleAccessToken,
        googleRefreshToken: syncConfig.googleRefreshToken,
      });

      // 4. Fetch contacts from both systems
      console.log(`📱 [CONTACT SYNC] Fetching contacts from both systems...`);
      const [googleContacts, crmContacts] = await Promise.all([
        googleContactsService.fetchAllContacts(),
        this.fetchCRMContacts(masterUserID),
      ]);

      console.log(
        `📊 [CONTACT SYNC] Fetched ${googleContacts.length} Google contacts, ${crmContacts.length} CRM contacts`
      );

      // 5. Normalize contacts
      const normalizedGoogle = googleContacts.map((gc) =>
        googleContactsService.normalizeGoogleContact(gc)
      );

      // 6. Get existing mappings
      const existingMappings = await this.getExistingMappings(masterUserID);

      // 7. Perform sync based on mode
      const syncResult = await this.performTwoWaySync(
        masterUserID,
        syncHistory.syncHistoryId,
        normalizedGoogle,
        crmContacts,
        existingMappings,
        syncConfig
      );

      // 8. Calculate duration
      const duration = Math.floor((Date.now() - startTime) / 1000);

      // 9. Update sync history with results
      await syncHistory.update({
        status: syncResult.hasErrors ? "partial" : "completed",
        completedAt: new Date(),
        duration,
        totalContacts:
          syncResult.createdInCRM +
          syncResult.updatedInCRM +
          syncResult.createdInGoogle +
          syncResult.updatedInGoogle +
          syncResult.skipped,
        createdInCRM: syncResult.createdInCRM,
        updatedInCRM: syncResult.updatedInCRM,
        deletedInCRM: syncResult.deletedInCRM,
        createdInGoogle: syncResult.createdInGoogle,
        updatedInGoogle: syncResult.updatedInGoogle,
        deletedInGoogle: syncResult.deletedInGoogle,
        skipped: syncResult.skipped,
        conflicts: syncResult.conflicts,
        errors: syncResult.errors,
        errorDetails: syncResult.errorDetails,
        summary: this.generateSyncSummary(syncResult),
      });

      // 10. Update sync config
      await syncConfig.update({
        lastSyncAt: new Date(),
        nextSyncAt: syncConfig.autoSyncEnabled
          ? new Date(Date.now() + syncConfig.syncFrequency * 60 * 1000)
          : null,
        syncStats: {
          totalSyncs: (syncConfig.syncStats?.totalSyncs || 0) + 1,
          successfulSyncs:
            (syncConfig.syncStats?.successfulSyncs || 0) +
            (syncResult.hasErrors ? 0 : 1),
          failedSyncs:
            (syncConfig.syncStats?.failedSyncs || 0) +
            (syncResult.hasErrors ? 1 : 0),
          lastSyncDuration: duration,
          totalContactsSynced:
            (syncConfig.syncStats?.totalContactsSynced || 0) +
            syncResult.createdInCRM +
            syncResult.updatedInCRM +
            syncResult.createdInGoogle +
            syncResult.updatedInGoogle,
        },
      });

      console.log(
        `✅ [CONTACT SYNC] Sync completed successfully in ${duration}s`
      );
      console.log(`📊 [CONTACT SYNC] Summary:`, syncResult);

      return {
        success: true,
        syncHistoryId: syncHistory.syncHistoryId,
        duration,
        ...syncResult,
      };
    } catch (error) {
      console.error(`❌ [CONTACT SYNC] Sync failed:`, error);

      if (syncHistory) {
        await syncHistory.update({
          status: "failed",
          completedAt: new Date(),
          duration: Math.floor((Date.now() - startTime) / 1000),
          errors: 1,
          errorDetails: [
            {
              error: error.message,
              stack: error.stack,
              timestamp: new Date(),
            },
          ],
          summary: `Sync failed: ${error.message}`,
        });
      }

      throw error;
    }
  }

  /**
   * Perform full two-way sync with conflict resolution
   */
  async performTwoWaySync(
    masterUserID,
    syncHistoryId,
    googleContacts,
    crmContacts,
    existingMappings,
    syncConfig
  ) {
    console.log(`🔄 [TWO-WAY SYNC] Starting bidirectional sync...`);

    const result = {
      createdInCRM: 0,
      updatedInCRM: 0,
      deletedInCRM: 0,
      createdInGoogle: 0,
      updatedInGoogle: 0,
      deletedInGoogle: 0,
      skipped: 0,
      conflicts: 0,
      errors: 0,
      errorDetails: [],
      hasErrors: false,
    };

    // Create lookup maps
    const googleMap = new Map(
      googleContacts.map((gc) => [gc.googleContactId, gc])
    );
    const crmMap = new Map(crmContacts.map((cc) => [cc.personId, cc]));
    const mappingByGoogle = new Map(
      existingMappings.map((m) => [m.googleContactId, m])
    );
    const mappingByCRM = new Map(
      existingMappings.map((m) => [m.personId, m])
    );

    // Step 1: Process Google contacts (Google → CRM)
    console.log(`📱 [TWO-WAY SYNC] Processing Google contacts...`);
    for (const googleContact of googleContacts) {
      try {
        const mapping = mappingByGoogle.get(googleContact.googleContactId);

        if (!mapping) {
          // Contact only exists in Google → CREATE in CRM
          await this.createContactInCRM(
            masterUserID,
            syncHistoryId,
            googleContact,
            syncConfig
          );
          result.createdInCRM++;
        } else {
          // Contact exists in both → CHECK FOR UPDATES or CONFLICTS
          const crmContact = crmMap.get(mapping.personId);

          if (!crmContact) {
            // Mapping exists but CRM contact deleted → DELETE from Google or skip
            if (syncConfig.deletionHandling !== "skip") {
              await this.deleteContactInGoogle(
                masterUserID,
                syncHistoryId,
                googleContact,
                mapping,
                syncConfig
              );
              result.deletedInGoogle++;
            } else {
              result.skipped++;
            }
            continue;
          }

          // Check if update needed
          const needsUpdate = this.detectChanges(googleContact, crmContact);

          if (needsUpdate.hasChanges) {
            // Conflict resolution
            const resolution = this.resolveConflict(
              googleContact,
              crmContact,
              syncConfig.conflictResolution
            );

            if (resolution.winner === "google") {
              // Google wins → Update CRM
              await this.updateContactInCRM(
                masterUserID,
                syncHistoryId,
                googleContact,
                crmContact,
                mapping,
                needsUpdate.changedFields,
                resolution
              );
              result.updatedInCRM++;
              result.conflicts++;
            } else if (resolution.winner === "crm") {
              // CRM wins → Update Google (handled in next step)
              result.conflicts++;
            } else {
              result.skipped++;
            }
          } else {
            result.skipped++;
          }
        }
      } catch (error) {
        console.error(
          `❌ [TWO-WAY SYNC] Error processing Google contact:`,
          error
        );
        result.errors++;
        result.errorDetails.push({
          contact: googleContact.contactPerson,
          error: error.message,
        });
        result.hasErrors = true;
      }
    }

    // Step 2: Process CRM contacts (CRM → Google)
    console.log(`💼 [TWO-WAY SYNC] Processing CRM contacts...`);
    for (const crmContact of crmContacts) {
      try {
        const mapping = mappingByCRM.get(crmContact.personId);

        if (!mapping) {
          // Contact only exists in CRM → CREATE in Google
          await this.createContactInGoogle(
            masterUserID,
            syncHistoryId,
            crmContact,
            syncConfig
          );
          result.createdInGoogle++;
        } else {
          // Already processed in previous step, check if CRM wins conflict
          const googleContact = googleMap.get(mapping.googleContactId);

          if (!googleContact) {
            // Mapping exists but Google contact deleted → DELETE from CRM or skip
            if (syncConfig.deletionHandling !== "skip") {
              await this.deleteContactInCRM(
                masterUserID,
                syncHistoryId,
                crmContact,
                mapping,
                syncConfig
              );
              result.deletedInCRM++;
            }
            continue;
          }

          // Check if CRM needs to update Google
          const needsUpdate = this.detectChanges(googleContact, crmContact);

          if (needsUpdate.hasChanges) {
            const resolution = this.resolveConflict(
              googleContact,
              crmContact,
              syncConfig.conflictResolution
            );

            if (resolution.winner === "crm") {
              // CRM wins → Update Google
              await this.updateContactInGoogle(
                masterUserID,
                syncHistoryId,
                crmContact,
                googleContact,
                mapping,
                needsUpdate.changedFields,
                resolution
              );
              result.updatedInGoogle++;
            }
          }
        }
      } catch (error) {
        console.error(`❌ [TWO-WAY SYNC] Error processing CRM contact:`, error);
        result.errors++;
        result.errorDetails.push({
          contact: crmContact.contactPerson,
          error: error.message,
        });
        result.hasErrors = true;
      }
    }

    console.log(`✅ [TWO-WAY SYNC] Sync completed`, result);
    return result;
  }

  /**
   * Detect changes between Google and CRM contacts
   */
  detectChanges(googleContact, crmContact) {
    const changedFields = [];

    // Compare key fields
    const fieldsToCompare = [
      { google: "contactPerson", crm: "contactPerson" },
      { google: "email", crm: "email" },
      { google: "phone", crm: "phone" },
      { google: "postalAddress", crm: "postalAddress" },
      { google: "organization", crm: "organization" },
      { google: "jobTitle", crm: "jobTitle" },
      { google: "notes", crm: "notes" },
    ];

    for (const field of fieldsToCompare) {
      const googleValue = (googleContact[field.google] || "").trim();
      const crmValue = (crmContact[field.crm] || "").trim();

      if (googleValue !== crmValue) {
        changedFields.push({
          field: field.crm,
          googleValue,
          crmValue,
        });
      }
    }

    return {
      hasChanges: changedFields.length > 0,
      changedFields,
    };
  }

  /**
   * Resolve conflict between Google and CRM contacts
   */
  resolveConflict(googleContact, crmContact, conflictResolution) {
    console.log(
      `⚔️ [CONFLICT] Resolving conflict for: ${crmContact.contactPerson}`
    );

    let winner = null;
    let reason = "";

    switch (conflictResolution) {
      case "newest_wins":
        const googleTime = new Date(
          googleContact.googleUpdatedAt || 0
        ).getTime();
        const crmTime = new Date(crmContact.updatedAt || 0).getTime();

        if (googleTime > crmTime) {
          winner = "google";
          reason = `Google updated more recently (${googleContact.googleUpdatedAt} vs ${crmContact.updatedAt})`;
        } else {
          winner = "crm";
          reason = `CRM updated more recently (${crmContact.updatedAt} vs ${googleContact.googleUpdatedAt})`;
        }
        break;

      case "google_wins":
        winner = "google";
        reason = "Configured to always prefer Google";
        break;

      case "crm_wins":
        winner = "crm";
        reason = "Configured to always prefer CRM";
        break;

      default:
        winner = "crm";
        reason = "Default fallback to CRM";
    }

    console.log(`✅ [CONFLICT] Winner: ${winner.toUpperCase()} - ${reason}`);

    return {
      winner,
      reason,
      conflictResolution,
    };
  }

  /**
   * Create contact in CRM from Google
   */
  async createContactInCRM(
    masterUserID,
    syncHistoryId,
    googleContact,
    syncConfig
  ) {
    console.log(
      `➕ [CREATE CRM] Creating contact: ${googleContact.contactPerson}`
    );

    try {
      // Create person in CRM
      const newPerson = await Person.create({
        masterUserID,
        contactPerson: googleContact.contactPerson,
        email: googleContact.email,
        phone: googleContact.phone,
        postalAddress: googleContact.postalAddress,
        organization: googleContact.organization,
        jobTitle: googleContact.jobTitle,
        notes: googleContact.notes,
      });

      // Create mapping
      await ContactSyncMapping.create({
        masterUserID,
        personId: newPerson.personId,
        googleContactId: googleContact.googleContactId,
        googleResourceName: googleContact.googleResourceName,
        googleEtag: googleContact.googleEtag,
        lastSyncedAt: new Date(),
        crmUpdatedAt: newPerson.updatedAt,
        googleUpdatedAt: googleContact.googleUpdatedAt,
        syncStatus: "synced",
      });

      // Log the change
      await ContactChangeLog.create({
        syncHistoryId,
        masterUserID,
        personId: newPerson.personId,
        googleContactId: googleContact.googleContactId,
        operation: "created_in_crm",
        changeType: "create",
        direction: "google_to_crm",
        contactName: googleContact.contactPerson,
        contactEmail: googleContact.email,
        fieldsAfter: { ...googleContact },
        googleUpdatedAt: googleContact.googleUpdatedAt,
        crmUpdatedAt: newPerson.updatedAt,
      });

      console.log(
        `✅ [CREATE CRM] Contact created: ${newPerson.personId}`
      );
      return newPerson;
    } catch (error) {
      console.error(`❌ [CREATE CRM] Error:`, error);
      throw error;
    }
  }

  /**
   * Update contact in CRM from Google
   */
  async updateContactInCRM(
    masterUserID,
    syncHistoryId,
    googleContact,
    crmContact,
    mapping,
    changedFields,
    resolution
  ) {
    console.log(
      `🔄 [UPDATE CRM] Updating contact: ${crmContact.contactPerson} (${crmContact.personId})`
    );

    try {
      const updateData = {
        contactPerson: googleContact.contactPerson,
        email: googleContact.email,
        phone: googleContact.phone,
        postalAddress: googleContact.postalAddress,
        organization: googleContact.organization,
        jobTitle: googleContact.jobTitle,
        notes: googleContact.notes,
      };

      // Update person in CRM
      await Person.update(updateData, {
        where: { personId: crmContact.personId },
      });

      // Update mapping
      await mapping.update({
        lastSyncedAt: new Date(),
        googleUpdatedAt: googleContact.googleUpdatedAt,
        syncStatus: "synced",
      });

      // Log the change
      await ContactChangeLog.create({
        syncHistoryId,
        masterUserID,
        personId: crmContact.personId,
        googleContactId: googleContact.googleContactId,
        operation: "updated_in_crm",
        changeType: "update",
        direction: "google_to_crm",
        contactName: googleContact.contactPerson,
        contactEmail: googleContact.email,
        fieldsBefore: { ...crmContact.toJSON() },
        fieldsAfter: { ...googleContact },
        changedFields,
        conflictReason: resolution.reason,
        conflictResolution: resolution.conflictResolution,
        winningSource: "google",
        googleUpdatedAt: googleContact.googleUpdatedAt,
        crmUpdatedAt: new Date(),
      });

      console.log(`✅ [UPDATE CRM] Contact updated: ${crmContact.personId}`);
    } catch (error) {
      console.error(`❌ [UPDATE CRM] Error:`, error);
      throw error;
    }
  }

  /**
   * Create contact in Google from CRM
   */
  async createContactInGoogle(
    masterUserID,
    syncHistoryId,
    crmContact,
    syncConfig
  ) {
    console.log(
      `➕ [CREATE GOOGLE] Creating contact: ${crmContact.contactPerson}`
    );

    try {
      const googlePerson = await googleContactsService.createContact({
        name: crmContact.contactPerson,
        contactPerson: crmContact.contactPerson,
        firstName: crmContact.firstName,
        lastName: crmContact.lastName,
        email: crmContact.email,
        phone: crmContact.phone,
        postalAddress: crmContact.postalAddress,
        organization: crmContact.organization,
        jobTitle: crmContact.jobTitle,
        notes: crmContact.notes,
      });

      // Extract Google contact ID from resource name
      const googleContactId =
        googlePerson.metadata?.sources?.[0]?.id || googlePerson.resourceName;

      // Create mapping
      await ContactSyncMapping.create({
        masterUserID,
        personId: crmContact.personId,
        googleContactId: googleContactId,
        googleResourceName: googlePerson.resourceName,
        googleEtag: googlePerson.etag,
        lastSyncedAt: new Date(),
        crmUpdatedAt: crmContact.updatedAt,
        googleUpdatedAt: new Date(),
        syncStatus: "synced",
      });

      // Log the change
      await ContactChangeLog.create({
        syncHistoryId,
        masterUserID,
        personId: crmContact.personId,
        googleContactId: googleContactId,
        operation: "created_in_google",
        changeType: "create",
        direction: "crm_to_google",
        contactName: crmContact.contactPerson,
        contactEmail: crmContact.email,
        fieldsAfter: { ...crmContact.toJSON() },
        crmUpdatedAt: crmContact.updatedAt,
        googleUpdatedAt: new Date(),
      });

      console.log(`✅ [CREATE GOOGLE] Contact created: ${googleContactId}`);
    } catch (error) {
      console.error(`❌ [CREATE GOOGLE] Error:`, error);
      throw error;
    }
  }

  /**
   * Update contact in Google from CRM
   */
  async updateContactInGoogle(
    masterUserID,
    syncHistoryId,
    crmContact,
    googleContact,
    mapping,
    changedFields,
    resolution
  ) {
    console.log(
      `🔄 [UPDATE GOOGLE] Updating contact: ${googleContact.googleResourceName}`
    );

    try {
      const updatedGooglePerson = await googleContactsService.updateContact(
        googleContact.googleResourceName,
        {
          name: crmContact.contactPerson,
          contactPerson: crmContact.contactPerson,
          firstName: crmContact.firstName,
          lastName: crmContact.lastName,
          email: crmContact.email,
          phone: crmContact.phone,
          postalAddress: crmContact.postalAddress,
          organization: crmContact.organization,
          jobTitle: crmContact.jobTitle,
          notes: crmContact.notes,
        },
        googleContact.googleEtag
      );

      // Update mapping
      await mapping.update({
        googleEtag: updatedGooglePerson.etag,
        lastSyncedAt: new Date(),
        crmUpdatedAt: crmContact.updatedAt,
        syncStatus: "synced",
      });

      // Log the change
      await ContactChangeLog.create({
        syncHistoryId,
        masterUserID,
        personId: crmContact.personId,
        googleContactId: googleContact.googleContactId,
        operation: "updated_in_google",
        changeType: "update",
        direction: "crm_to_google",
        contactName: crmContact.contactPerson,
        contactEmail: crmContact.email,
        fieldsBefore: { ...googleContact },
        fieldsAfter: { ...crmContact.toJSON() },
        changedFields,
        conflictReason: resolution.reason,
        conflictResolution: resolution.conflictResolution,
        winningSource: "crm",
        crmUpdatedAt: crmContact.updatedAt,
        googleUpdatedAt: new Date(),
      });

      console.log(
        `✅ [UPDATE GOOGLE] Contact updated: ${googleContact.googleResourceName}`
      );
    } catch (error) {
      console.error(`❌ [UPDATE GOOGLE] Error:`, error);
      throw error;
    }
  }

  /**
   * Delete contact in CRM
   */
  async deleteContactInCRM(
    masterUserID,
    syncHistoryId,
    crmContact,
    mapping,
    syncConfig
  ) {
    console.log(
      `🗑️ [DELETE CRM] Deleting contact: ${crmContact.personId}`
    );

    try {
      if (syncConfig.deletionHandling === "soft_delete") {
        // Soft delete in CRM (mark as deleted)
        await Person.update(
          { isDeleted: true, deletedAt: new Date() },
          { where: { personId: crmContact.personId } }
        );
      } else {
        // Hard delete
        await Person.destroy({ where: { personId: crmContact.personId } });
      }

      // Update mapping
      await mapping.update({
        isDeleted: true,
        deletedAt: new Date(),
        syncStatus: "synced",
      });

      // Log the change
      await ContactChangeLog.create({
        syncHistoryId,
        masterUserID,
        personId: crmContact.personId,
        googleContactId: mapping.googleContactId,
        operation: "deleted_in_crm",
        changeType: "delete",
        direction: "google_to_crm",
        contactName: crmContact.contactPerson,
        contactEmail: crmContact.email,
        fieldsBefore: { ...crmContact.toJSON() },
        crmUpdatedAt: new Date(),
      });

      console.log(`✅ [DELETE CRM] Contact deleted: ${crmContact.personId}`);
    } catch (error) {
      console.error(`❌ [DELETE CRM] Error:`, error);
      throw error;
    }
  }

  /**
   * Delete contact in Google
   */
  async deleteContactInGoogle(
    masterUserID,
    syncHistoryId,
    googleContact,
    mapping,
    syncConfig
  ) {
    console.log(
      `🗑️ [DELETE GOOGLE] Deleting contact: ${googleContact.googleResourceName}`
    );

    try {
      if (syncConfig.deletionHandling === "soft_delete") {
        // Soft delete (unstar)
        await googleContactsService.softDeleteContact(
          googleContact.googleResourceName
        );
      } else {
        // Hard delete
        await googleContactsService.deleteContact(
          googleContact.googleResourceName
        );
      }

      // Update mapping
      await mapping.update({
        isDeleted: true,
        deletedAt: new Date(),
        syncStatus: "synced",
      });

      // Log the change
      await ContactChangeLog.create({
        syncHistoryId,
        masterUserID,
        personId: mapping.personId,
        googleContactId: googleContact.googleContactId,
        operation: "deleted_in_google",
        changeType: "delete",
        direction: "crm_to_google",
        contactName: googleContact.contactPerson,
        contactEmail: googleContact.email,
        fieldsBefore: { ...googleContact },
        googleUpdatedAt: new Date(),
      });

      console.log(
        `✅ [DELETE GOOGLE] Contact deleted: ${googleContact.googleResourceName}`
      );
    } catch (error) {
      console.error(`❌ [DELETE GOOGLE] Error:`, error);
      throw error;
    }
  }

  /**
   * Fetch all CRM contacts for a user
   */
  async fetchCRMContacts(masterUserID) {
    try {
      const contacts = await Person.findAll({
        where: {
          masterUserID,
          // Optionally filter out deleted contacts
          // isDeleted: false
        },
        raw: false,
      });

      return contacts;
    } catch (error) {
      console.error(`❌ [FETCH CRM] Error fetching CRM contacts:`, error);
      throw error;
    }
  }

  /**
   * Get existing sync mappings
   */
  async getExistingMappings(masterUserID) {
    try {
      const mappings = await ContactSyncMapping.findAll({
        where: { masterUserID, isDeleted: false },
      });

      return mappings;
    } catch (error) {
      console.error(`❌ [MAPPINGS] Error fetching mappings:`, error);
      throw error;
    }
  }

  /**
   * Generate sync summary message
   */
  generateSyncSummary(result) {
    const parts = [];

    if (result.createdInCRM > 0)
      parts.push(`${result.createdInCRM} created in CRM`);
    if (result.updatedInCRM > 0)
      parts.push(`${result.updatedInCRM} updated in CRM`);
    if (result.deletedInCRM > 0)
      parts.push(`${result.deletedInCRM} deleted in CRM`);
    if (result.createdInGoogle > 0)
      parts.push(`${result.createdInGoogle} created in Google`);
    if (result.updatedInGoogle > 0)
      parts.push(`${result.updatedInGoogle} updated in Google`);
    if (result.deletedInGoogle > 0)
      parts.push(`${result.deletedInGoogle} deleted in Google`);
    if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
    if (result.conflicts > 0)
      parts.push(`${result.conflicts} conflicts resolved`);
    if (result.errors > 0) parts.push(`${result.errors} errors`);

    return parts.join(", ");
  }
}

module.exports = new ContactSyncService();
