const NotificationService = require("./notificationService");
const Follower = require("../../models/follower/followerModel");
const { Op } = require("sequelize");

/**
 * Service to send notifications to followers when entities are updated
 * This integrates the follower system with the notification system
 */
class FollowerNotificationService {
  /**
   * Get all followers of an entity (excluding specific users)
   * @param {String} entityType - Type of entity (deal, lead, person, organization)
   * @param {Number} entityId - ID of the entity
   * @param {Array} excludeUserIds - User IDs to exclude (e.g., the person who made the change)
   * @returns {Promise<Array>} Array of follower user IDs
   */
  static async getFollowerUserIds(entityType, entityId, excludeUserIds = []) {
    try {
      const followers = await Follower.findAll({
        where: {
          entityType,
          entityId,
          userId: {
            [Op.notIn]: excludeUserIds, // Don't notify the person who made the change
          },
        },
        attributes: ["userId"],
      });

      return followers.map((f) => f.userId);
    } catch (error) {
      console.error("Error fetching follower user IDs:", error);
      return [];
    }
  }

  /**
   * Notify all followers when a deal is created
   */
  static async notifyFollowersDealCreated(deal, createdBy) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "deal",
        deal.dealId,
        [createdBy.userId]
      );

      if (followerIds.length === 0) return;

      await NotificationService.createBulkNotifications(followerIds, {
        type: "deal_created",
        title: "New Deal Created",
        message: `${createdBy.name} created a new deal "${deal.dealTitle}" that you're following`,
        priority: "medium",
        entityType: "deal",
        entityId: deal.dealId,
        actionUrl: `/deals/${deal.dealId}`,
        actionBy: createdBy.userId,
        metadata: {
          dealTitle: deal.dealTitle,
          dealValue: deal.dealValue,
          createdBy: createdBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about deal creation`);
    } catch (error) {
      console.error("Error notifying followers about deal creation:", error);
    }
  }

  /**
   * Notify all followers when a deal is updated
   */
  static async notifyFollowersDealUpdated(deal, updatedBy, changes = {}) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "deal",
        deal.dealId,
        [updatedBy.userId, deal.ownerId] // Exclude updater and owner (they get their own notification)
      );

      if (followerIds.length === 0) return;

      const changesSummary = Object.keys(changes)
        .slice(0, 3) // Show max 3 changes
        .map((key) => `${key}: ${changes[key].old} → ${changes[key].new}`)
        .join(", ");

      await NotificationService.createBulkNotifications(followerIds, {
        type: "deal_updated",
        title: "Deal Updated",
        message: `${updatedBy.name} updated deal "${deal.dealTitle}" that you're following${changesSummary ? `: ${changesSummary}` : ""}`,
        priority: "low",
        entityType: "deal",
        entityId: deal.dealId,
        actionUrl: `/deals/${deal.dealId}`,
        actionBy: updatedBy.userId,
        metadata: {
          dealTitle: deal.dealTitle,
          changes,
          updatedBy: updatedBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about deal update`);
    } catch (error) {
      console.error("Error notifying followers about deal update:", error);
    }
  }

  /**
   * Notify all followers when a deal stage changes
   */
  static async notifyFollowersDealStageChanged(deal, newStage, changedBy) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "deal",
        deal.dealId,
        [changedBy.userId, deal.ownerId]
      );

      if (followerIds.length === 0) return;

      await NotificationService.createBulkNotifications(followerIds, {
        type: "deal_stage_changed",
        title: "Deal Stage Changed",
        message: `${changedBy.name} moved deal "${deal.dealTitle}" to "${newStage}" stage`,
        priority: "medium",
        entityType: "deal",
        entityId: deal.dealId,
        actionUrl: `/deals/${deal.dealId}`,
        actionBy: changedBy.userId,
        metadata: {
          dealTitle: deal.dealTitle,
          newStage,
          changedBy: changedBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about deal stage change`);
    } catch (error) {
      console.error("Error notifying followers about deal stage change:", error);
    }
  }

  /**
   * Notify all followers when a deal is won
   */
  static async notifyFollowersDealWon(deal, wonBy) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "deal",
        deal.dealId,
        [wonBy.userId]
      );

      if (followerIds.length === 0) return;

      await NotificationService.createBulkNotifications(followerIds, {
        type: "deal_won",
        title: "🎉 Deal Won!",
        message: `${wonBy.name} won deal "${deal.dealTitle}" (${deal.dealValue || "N/A"}) that you're following`,
        priority: "high",
        entityType: "deal",
        entityId: deal.dealId,
        actionUrl: `/deals/${deal.dealId}`,
        actionBy: wonBy.userId,
        metadata: {
          dealTitle: deal.dealTitle,
          dealValue: deal.dealValue,
          wonBy: wonBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about deal won`);
    } catch (error) {
      console.error("Error notifying followers about deal won:", error);
    }
  }

  /**
   * Notify all followers when a deal is lost
   */
  static async notifyFollowersDealLost(deal, lostBy, lostReason) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "deal",
        deal.dealId,
        [lostBy.userId]
      );

      if (followerIds.length === 0) return;

      await NotificationService.createBulkNotifications(followerIds, {
        type: "deal_lost",
        title: "Deal Lost",
        message: `Deal "${deal.dealTitle}" that you're following was lost${lostReason ? `: ${lostReason}` : ""}`,
        priority: "medium",
        entityType: "deal",
        entityId: deal.dealId,
        actionUrl: `/deals/${deal.dealId}`,
        actionBy: lostBy.userId,
        metadata: {
          dealTitle: deal.dealTitle,
          lostReason,
          lostBy: lostBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about deal lost`);
    } catch (error) {
      console.error("Error notifying followers about deal lost:", error);
    }
  }

  /**
   * Notify all followers when a lead is updated
   */
  static async notifyFollowersLeadUpdated(lead, updatedBy, changes = {}) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "lead",
        lead.leadId,
        [updatedBy.userId, lead.ownerId]
      );

      if (followerIds.length === 0) return;

      const changesSummary = Object.keys(changes)
        .slice(0, 3)
        .map((key) => `${key}: ${changes[key].old} → ${changes[key].new}`)
        .join(", ");

      await NotificationService.createBulkNotifications(followerIds, {
        type: "lead_updated",
        title: "Lead Updated",
        message: `${updatedBy.name} updated lead "${lead.leadTitle || lead.companyName}" that you're following${changesSummary ? `: ${changesSummary}` : ""}`,
        priority: "low",
        entityType: "lead",
        entityId: lead.leadId,
        actionUrl: `/leads/${lead.leadId}`,
        actionBy: updatedBy.userId,
        metadata: {
          leadTitle: lead.leadTitle || lead.companyName,
          changes,
          updatedBy: updatedBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about lead update`);
    } catch (error) {
      console.error("Error notifying followers about lead update:", error);
    }
  }

  /**
   * Notify all followers when a lead is converted to deal
   */
  static async notifyFollowersLeadConverted(lead, deal, convertedBy) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "lead",
        lead.leadId,
        [convertedBy.userId]
      );

      if (followerIds.length === 0) return;

      await NotificationService.createBulkNotifications(followerIds, {
        type: "lead_converted",
        title: "Lead Converted to Deal",
        message: `${convertedBy.name} converted lead "${lead.leadTitle || lead.companyName}" to deal "${deal.dealTitle}"`,
        priority: "medium",
        entityType: "deal",
        entityId: deal.dealId,
        actionUrl: `/deals/${deal.dealId}`,
        actionBy: convertedBy.userId,
        metadata: {
          leadTitle: lead.leadTitle || lead.companyName,
          dealTitle: deal.dealTitle,
          convertedBy: convertedBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about lead conversion`);
    } catch (error) {
      console.error("Error notifying followers about lead conversion:", error);
    }
  }

  /**
   * Notify all followers when a contact (person) is updated
   */
  static async notifyFollowersContactUpdated(person, updatedBy, changes = {}) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "person",
        person.personId,
        [updatedBy.userId]
      );

      if (followerIds.length === 0) return;

      await NotificationService.createBulkNotifications(followerIds, {
        type: "contact_updated",
        title: "Contact Updated",
        message: `${updatedBy.name} updated contact "${person.name}" that you're following`,
        priority: "low",
        entityType: "contact",
        entityId: person.personId,
        actionUrl: `/contacts/person/${person.personId}`,
        actionBy: updatedBy.userId,
        metadata: {
          personName: person.name,
          changes,
          updatedBy: updatedBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about contact update`);
    } catch (error) {
      console.error("Error notifying followers about contact update:", error);
    }
  }

  /**
   * Notify all followers when an organization is updated
   */
  static async notifyFollowersOrganizationUpdated(organization, updatedBy, changes = {}) {
    try {
      const followerIds = await this.getFollowerUserIds(
        "organization",
        organization.leadOrganizationId,
        [updatedBy.userId]
      );

      if (followerIds.length === 0) return;

      await NotificationService.createBulkNotifications(followerIds, {
        type: "organization_updated",
        title: "Organization Updated",
        message: `${updatedBy.name} updated organization "${organization.organizationName}" that you're following`,
        priority: "low",
        entityType: "organization",
        entityId: organization.leadOrganizationId,
        actionUrl: `/contacts/organization/${organization.leadOrganizationId}`,
        actionBy: updatedBy.userId,
        metadata: {
          organizationName: organization.organizationName,
          changes,
          updatedBy: updatedBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about organization update`);
    } catch (error) {
      console.error("Error notifying followers about organization update:", error);
    }
  }

  /**
   * Notify all followers when a new activity is added to an entity
   */
  static async notifyFollowersActivityAdded(activity, entity, entityType, addedBy) {
    try {
      const entityIdMap = {
        deal: activity.dealId,
        lead: activity.leadId,
        person: activity.personId,
        organization: activity.organizationId,
      };

      const entityId = entityIdMap[entityType];
      if (!entityId) return;

      const followerIds = await this.getFollowerUserIds(
        entityType,
        entityId,
        [addedBy.userId]
      );

      if (followerIds.length === 0) return;

      const entityName = entity.dealTitle || entity.leadTitle || entity.name || entity.organizationName || "entity";

      await NotificationService.createBulkNotifications(followerIds, {
        type: "activity_created",
        title: "New Activity Added",
        message: `${addedBy.name} added "${activity.activityType}" activity to ${entityName} that you're following`,
        priority: "low",
        entityType: "activity",
        entityId: activity.activityId,
        actionUrl: `/${entityType}s/${entityId}`,
        actionBy: addedBy.userId,
        metadata: {
          activityType: activity.activityType,
          entityName,
          entityType,
          addedBy: addedBy.name,
        },
      });

      console.log(`✅ Notified ${followerIds.length} followers about new activity`);
    } catch (error) {
      console.error("Error notifying followers about activity:", error);
    }
  }

  /**
   * Auto-follow: When a user is assigned as owner, automatically make them a follower
   */
  static async autoFollowOnOwnerAssignment(entityType, entityId, userId, masterUserID) {
    try {
      // Check if already following
      const existingFollower = await Follower.findOne({
        where: { entityType, entityId, userId },
      });

      if (existingFollower) {
        console.log(`User ${userId} already following ${entityType} ${entityId}`);
        return existingFollower;
      }

      // Auto-add as follower
      const follower = await Follower.create({
        entityType,
        entityId,
        userId,
        masterUserID,
        addedBy: userId, // Self-added through ownership
      });

      console.log(`✅ Auto-followed: User ${userId} now follows ${entityType} ${entityId}`);
      return follower;
    } catch (error) {
      console.error("Error auto-following on owner assignment:", error);
      return null;
    }
  }
}

module.exports = FollowerNotificationService;
