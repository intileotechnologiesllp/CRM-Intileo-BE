const NotificationService = require("./notificationService");
const FollowerNotificationService = require("./followerNotificationService");

/**
 * Notification trigger helpers for different entities
 * Use these functions in your controllers to send notifications
 */

class NotificationTriggers {
  // ============ DEAL NOTIFICATIONS ============

  /**
   * Trigger notification when a deal is created
   */
  static async dealCreated(deal, createdBy) {
    try {
      // Notify owner if different from creator
      if (deal.ownerId && deal.ownerId !== createdBy.userId) {
        await NotificationService.createNotification({
          userId: deal.ownerId,
          type: "deal_created",
          title: "New Deal Assigned",
          message: `${createdBy.name} created a new deal "${deal.dealTitle}" and assigned it to you`,
          priority: "medium",
          entityType: "deal",
          entityId: deal.dealId,
          actionUrl: `/deals/${deal.dealId}`,
          actionBy: createdBy.userId,
          metadata: {
            dealTitle: deal.dealTitle,
            dealValue: deal.dealValue,
            stage: deal.stage,
          },
        });
      }

      // Notify followers
      await FollowerNotificationService.notifyFollowersDealCreated(deal, createdBy);

      // Notify team members if visibility group is set
      // TODO: Add team notification logic based on visibility groups

      return true;
    } catch (error) {
      console.error("Error sending deal created notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when a deal is updated
   */
  static async dealUpdated(deal, updatedBy, changes = {}) {
    try {
      // Notify owner if different from updater
      if (deal.ownerId && deal.ownerId !== updatedBy.userId) {
        const changesSummary = Object.keys(changes)
          .map((key) => `${key}: ${changes[key].old} → ${changes[key].new}`)
          .join(", ");

        await NotificationService.createNotification({
          userId: deal.ownerId,
          type: "deal_updated",
          title: "Deal Updated",
          message: `${updatedBy.name} updated deal "${deal.dealTitle}". Changes: ${changesSummary}`,
          priority: "low",
          entityType: "deal",
          entityId: deal.dealId,
          actionUrl: `/deals/${deal.dealId}`,
          actionBy: updatedBy.userId,
          metadata: { changes },
        });
      }

      // Notify followers
      await FollowerNotificationService.notifyFollowersDealUpdated(deal, updatedBy, changes);

      return true;
    } catch (error) {
      console.error("Error sending deal updated notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when a deal is assigned
   */
  static async dealAssigned(deal, assignedTo, assignedBy) {
    try {
      if (assignedTo !== assignedBy.userId) {
        await NotificationService.createNotification({
          userId: assignedTo,
          type: "deal_assigned",
          title: "Deal Assigned to You",
          message: `${assignedBy.name} assigned deal "${deal.dealTitle}" (${deal.dealValue || "N/A"}) to you`,
          priority: "high",
          entityType: "deal",
          entityId: deal.dealId,
          actionUrl: `/deals/${deal.dealId}`,
          actionBy: assignedBy.userId,
          metadata: {
            dealTitle: deal.dealTitle,
            dealValue: deal.dealValue,
          },
        });
        
        // Auto-follow when assigned as owner
        await FollowerNotificationService.autoFollowOnOwnerAssignment(
          "deal",
          deal.dealId,
          assignedTo,
          deal.masterUserID
        );
      }

      return true;
    } catch (error) {
      console.error("Error sending deal assigned notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when a deal is won
   */
  static async dealWon(deal, wonBy) {
    try {
      // Notify owner
      if (deal.ownerId && deal.ownerId !== wonBy.userId) {
        await NotificationService.createNotification({
          userId: deal.ownerId,
          type: "deal_won",
          title: "🎉 Deal Won!",
          message: `Congratulations! Deal "${deal.dealTitle}" worth ${deal.dealValue || "N/A"} has been won!`,
          priority: "high",
          entityType: "deal",
          entityId: deal.dealId,
          actionUrl: `/deals/${deal.dealId}`,
          actionBy: wonBy.userId,
          metadata: {
            dealTitle: deal.dealTitle,
            dealValue: deal.dealValue,
          },
        });
      }

      // Notify followers
      await FollowerNotificationService.notifyFollowersDealWon(deal, wonBy);

      // TODO: Notify team members
      return true;
    } catch (error) {
      console.error("Error sending deal won notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when a deal is lost
   */
  static async dealLost(deal, lostBy, reason = null) {
    try {
      if (deal.ownerId && deal.ownerId !== lostBy.userId) {
        await NotificationService.createNotification({
          userId: deal.ownerId,
          type: "deal_lost",
          title: "Deal Lost",
          message: `Deal "${deal.dealTitle}" has been marked as lost${reason ? `: ${reason}` : ""}`,
          priority: "medium",
          entityType: "deal",
          entityId: deal.dealId,
          actionUrl: `/deals/${deal.dealId}`,
          actionBy: lostBy.userId,
          metadata: {
            dealTitle: deal.dealTitle,
            lostReason: reason,
          },
        });
      }

      // Notify followers
      await FollowerNotificationService.notifyFollowersDealLost(deal, lostBy, reason);

      return true;
    } catch (error) {
      console.error("Error sending deal lost notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when deal stage changes
   */
  static async dealStageChanged(deal, newStage, oldStage, changedBy) {
    try {
      if (deal.ownerId && deal.ownerId !== changedBy.userId) {
        await NotificationService.createNotification({
          userId: deal.ownerId,
          type: "deal_stage_changed",
          title: "Deal Stage Changed",
          message: `${changedBy.name} moved deal "${deal.dealTitle}" from "${oldStage}" to "${newStage}"`,
          priority: "medium",
          entityType: "deal",
          entityId: deal.dealId,
          actionUrl: `/deals/${deal.dealId}`,
          actionBy: changedBy.userId,
          metadata: {
            oldStage,
            newStage,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending deal stage changed notification:", error);
      return false;
    }
  }

  // ============ LEAD NOTIFICATIONS ============

  /**
   * Trigger notification when a lead is created
   */
  static async leadCreated(lead, createdBy) {
    console.log('🔔 [NotificationTriggers.leadCreated] Called with:', {
      lead,
      createdBy
    });
    
    try {
      console.log('🔔 [NotificationTriggers.leadCreated] Checking condition:', {
        'lead.ownerId': lead.ownerId,
        'createdBy.userId': createdBy.userId,
        'ownerId === userId': lead.ownerId === createdBy.userId,
        'shouldSendNotification': lead.ownerId && lead.ownerId !== createdBy.userId
      });
      
      if (lead.ownerId && lead.ownerId !== createdBy.userId) {
        console.log('🔔 [NotificationTriggers.leadCreated] Condition met! Creating notification...');
        
        const notificationData = {
          userId: lead.ownerId,
          type: "lead_created",
          title: "New Lead Assigned",
          message: `${createdBy.name} created a new lead "${lead.leadTitle}" and assigned it to you`,
          priority: "medium",
          entityType: "lead",
          entityId: lead.leadId,
          actionUrl: `/leads/${lead.leadId}`,
          leadId: lead.leadId,
          actionBy: createdBy.userId,
          metadata: {
            leadTitle: lead.leadTitle,
          },
        };
        
        console.log('🔔 [NotificationTriggers.leadCreated] Notification data:', notificationData);
        
        await NotificationService.createNotification(notificationData);
        
        console.log('🔔 [NotificationTriggers.leadCreated] Notification created successfully! ✅');
      } else {
        console.log('🔔 [NotificationTriggers.leadCreated] ⚠️ Condition NOT met - no notification sent');
        console.log('🔔 Reason: Owner is same as creator, or ownerId is null');
      }

      return true;
    } catch (error) {
      console.error("🔔 [NotificationTriggers.leadCreated] ❌ ERROR:", error);
      console.error("🔔 Error name:", error.name);
      console.error("🔔 Error message:", error.message);
      console.error("🔔 Error stack:", error.stack);
      return false;
    }
  }

  /**
   * Trigger notification when a lead is assigned
   */
  static async leadAssigned(lead, assignedTo, assignedBy) {
    try {
      if (assignedTo !== assignedBy.userId) {
        await NotificationService.createNotification({
          userId: assignedTo,
          type: "lead_assigned",
          title: "Lead Assigned to You",
          message: `${assignedBy.name} assigned lead "${lead.leadTitle}" to you`,
          priority: "high",
          entityType: "lead",
          entityId: lead.leadId,
          actionUrl: `/leads/${lead.leadId}`,
          actionBy: assignedBy.userId,
          metadata: {
            leadTitle: lead.leadTitle,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending lead assigned notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when a lead is converted to deal
   */
  static async leadConverted(lead, deal, convertedBy) {
    try {
      if (lead.ownerId && lead.ownerId !== convertedBy.userId) {
        await NotificationService.createNotification({
          userId: lead.ownerId,
          type: "lead_converted",
          title: "Lead Converted to Deal",
          message: `${convertedBy.name} converted lead "${lead.leadTitle}" to a deal`,
          priority: "medium",
          entityType: "deal",
          entityId: deal.dealId,
          actionUrl: `/deals/${deal.dealId}`,
          actionBy: convertedBy.userId,
          metadata: {
            leadTitle: lead.leadTitle,
            dealId: deal.dealId,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending lead converted notification:", error);
      return false;
    }
  }

  // ============ ACTIVITY NOTIFICATIONS ============

  /**
   * Trigger notification when an activity is created
   */
  static async activityCreated(activity, createdBy) {
    try {
      if (activity.assignedTo && activity.assignedTo !== createdBy.userId) {
        await NotificationService.createNotification({
          userId: activity.assignedTo,
          type: "activity_created",
          title: "New Activity Assigned",
          message: `${createdBy.name} created a new activity "${activity.activityTitle}" for you`,
          priority: "medium",
          entityType: "activity",
          entityId: activity.activityId,
          actionUrl: `/activities/${activity.activityId}`,
          actionBy: createdBy.userId,
          metadata: {
            activityTitle: activity.activityTitle,
            dueDate: activity.dueDate,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending activity created notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when an activity is assigned
   */
  static async activityAssigned(activity, assignedTo, assignedBy) {
    try {
      if (assignedTo !== assignedBy.userId) {
        await NotificationService.createNotification({
          userId: assignedTo,
          type: "activity_assigned",
          title: "Activity Assigned to You",
          message: `${assignedBy.name} assigned activity "${activity.activityTitle}" to you${activity.dueDate ? ` (Due: ${activity.dueDate})` : ""}`,
          priority: "high",
          entityType: "activity",
          entityId: activity.activityId,
          actionUrl: `/activities/${activity.activityId}`,
          actionBy: assignedBy.userId,
          metadata: {
            activityTitle: activity.activityTitle,
            dueDate: activity.dueDate,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending activity assigned notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when an activity is due soon
   */
  static async activityDueSoon(activity, hoursUntilDue) {
    try {
      if (activity.assignedTo) {
        await NotificationService.createNotification({
          userId: activity.assignedTo,
          type: "activity_due",
          title: "⏰ Activity Due Soon",
          message: `Activity "${activity.activityTitle}" is due in ${hoursUntilDue} hours`,
          priority: "high",
          entityType: "activity",
          entityId: activity.activityId,
          actionUrl: `/activities/${activity.activityId}`,
          metadata: {
            activityTitle: activity.activityTitle,
            dueDate: activity.dueDate,
            hoursUntilDue,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending activity due soon notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when an activity is overdue
   */
  static async activityOverdue(activity) {
    try {
      if (activity.assignedTo) {
        await NotificationService.createNotification({
          userId: activity.assignedTo,
          type: "activity_overdue",
          title: "🚨 Activity Overdue",
          message: `Activity "${activity.activityTitle}" is overdue!`,
          priority: "urgent",
          entityType: "activity",
          entityId: activity.activityId,
          actionUrl: `/activities/${activity.activityId}`,
          metadata: {
            activityTitle: activity.activityTitle,
            dueDate: activity.dueDate,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending activity overdue notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when an activity is completed
   */
  static async activityCompleted(activity, completedBy) {
    try {
      // Notify creator if different from completer
      if (activity.createdBy && activity.createdBy !== completedBy.userId) {
        await NotificationService.createNotification({
          userId: activity.createdBy,
          type: "activity_completed",
          title: "✓ Activity Completed",
          message: `${completedBy.name} completed activity "${activity.activityTitle}"`,
          priority: "low",
          entityType: "activity",
          entityId: activity.activityId,
          actionUrl: `/activities/${activity.activityId}`,
          actionBy: completedBy.userId,
          metadata: {
            activityTitle: activity.activityTitle,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending activity completed notification:", error);
      return false;
    }
  }

  // ============ EMAIL NOTIFICATIONS ============

  /**
   * Trigger notification when an email is received
   */
  static async emailReceived(email, userId) {
    try {
      await NotificationService.createNotification({
        userId,
        type: "email_received",
        title: "📧 New Email Received",
        message: `From: ${email.from} - ${email.subject}`,
        priority: "medium",
        entityType: "email",
        entityId: email.emailId,
        actionUrl: `/emails/${email.emailId}`,
        metadata: {
          from: email.from,
          subject: email.subject,
        },
      });

      return true;
    } catch (error) {
      console.error("Error sending email received notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification when an email is replied to
   */
  static async emailReplied(email, repliedBy, recipientUserId) {
    try {
      await NotificationService.createNotification({
        userId: recipientUserId,
        type: "email_replied",
        title: "Email Reply Received",
        message: `${repliedBy.name} replied to: ${email.subject}`,
        priority: "medium",
        entityType: "email",
        entityId: email.emailId,
        actionUrl: `/emails/${email.emailId}`,
        actionBy: repliedBy.userId,
        metadata: {
          subject: email.subject,
        },
      });

      return true;
    } catch (error) {
      console.error("Error sending email replied notification:", error);
      return false;
    }
  }

  // ============ MENTION & COMMENT NOTIFICATIONS ============

  /**
   * Trigger notification when user is mentioned
   */
  static async userMentioned(mentionedUserId, entityType, entityId, mentionedBy, context) {
    try {
      if (mentionedUserId !== mentionedBy.userId) {
        await NotificationService.createNotification({
          userId: mentionedUserId,
          type: "mention",
          title: `@ ${mentionedBy.name} mentioned you`,
          message: context,
          priority: "high",
          entityType,
          entityId,
          actionUrl: `/${entityType}s/${entityId}`,
          actionBy: mentionedBy.userId,
          metadata: {
            context,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending mention notification:", error);
      return false;
    }
  }

  /**
   * Trigger notification for new comment
   */
  static async commentAdded(userId, entityType, entityId, commentBy, commentText) {
    try {
      if (userId !== commentBy.userId) {
        await NotificationService.createNotification({
          userId,
          type: "comment",
          title: "New Comment",
          message: `${commentBy.name} commented: ${commentText.substring(0, 100)}${commentText.length > 100 ? "..." : ""}`,
          priority: "low",
          entityType,
          entityId,
          actionUrl: `/${entityType}s/${entityId}`,
          actionBy: commentBy.userId,
          metadata: {
            commentText,
          },
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending comment notification:", error);
      return false;
    }
  }

  // ============ GOAL NOTIFICATIONS ============

  /**
   * Trigger notification when a goal is achieved
   */
  static async goalAchieved(goal, userId) {
    try {
      await NotificationService.createNotification({
        userId,
        type: "goal_achieved",
        title: "🎯 Goal Achieved!",
        message: `Congratulations! You've achieved your goal: ${goal.goalTitle}`,
        priority: "high",
        entityType: "goal",
        entityId: goal.goalId,
        actionUrl: `/goals/${goal.goalId}`,
        metadata: {
          goalTitle: goal.goalTitle,
          targetValue: goal.targetValue,
          achievedValue: goal.achievedValue,
        },
      });

      return true;
    } catch (error) {
      console.error("Error sending goal achieved notification:", error);
      return false;
    }
  }
}

module.exports = NotificationTriggers;
