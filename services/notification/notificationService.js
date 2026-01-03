const {
  Notification,
  NotificationPreference,
  PushSubscription,
} = require("../../models/notification");
const { emitToUser, emitToUsers } = require("../../config/socket");
const MasterUser = require("../../models/master/masterUserModel");
const { Op } = require("sequelize");

class NotificationService {
  /**
   * Create and send a notification
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Created notification
   */
  static async createNotification(data) {
    console.log('🔔 [NotificationService.createNotification] Called with data:', data);
    
    try {
      const {
        userId,
        type,
        title,
        message,
        priority = "medium",
        entityType,
        entityId,
        actionUrl,
        actionBy,
        metadata = {},
        expiresAt,
      } = data;

      console.log('🔔 [NotificationService] Step 1: Checking user preferences for userId:', userId, 'type:', type);

      // Check user's notification preferences
      const shouldSend = await this.checkUserPreferences(userId, type);
      
      console.log('🔔 [NotificationService] Step 2: User preferences check result:', shouldSend);
      
      if (!shouldSend) {
        console.log(`🔕 Notification blocked by user ${userId} preferences for type: ${type}`);
        return null;
      }

      console.log('🔔 [NotificationService] Step 3: Creating notification in database...');

      // Create notification in database
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        priority,
        entityType,
        entityId,
        actionUrl,
        actionBy,
        metadata,
        expiresAt,
      });

      console.log('🔔 [NotificationService] Step 4: Notification created:', {
        notificationId: notification.notificationId,
        userId: notification.userId,
        type: notification.type
      });

      console.log('🔔 [NotificationService] Step 5: Fetching full notification with user data...');

      // Fetch full notification with user data
      const fullNotification = await Notification.findByPk(
        notification.notificationId,
        {
          include: [
            {
              model: MasterUser,
              as: "actor",
              attributes: ["masterUserID", "name", "email"],  // Fixed: Use masterUserID instead of userId
            },
          ],
        }
      );

      console.log('🔔 [NotificationService] Step 6: Full notification fetched:', {
        notificationId: fullNotification.notificationId,
        hasActor: !!fullNotification.actor
      });

      console.log('🔔 [NotificationService] Step 7: Emitting to Socket.IO for userId:', userId);

      // Send real-time notification via Socket.IO
      emitToUser(userId, "new_notification", {
        notification: fullNotification,
        unreadCount: await this.getUnreadCount(userId),
      });

      console.log(`✅ [NotificationService] Notification sent to user ${userId}: ${type}`);

      // Send push notification if enabled
      await this.sendPushNotification(userId, fullNotification);

      console.log('🔔 [NotificationService] Step 8: Push notification sent (if applicable)');

      return fullNotification;
    } catch (error) {
      console.error("❌ Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Create and send notifications to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} data - Notification data
   */
  static async createBulkNotifications(userIds, data) {
    try {
      const notifications = await Promise.all(
        userIds.map((userId) =>
          this.createNotification({ ...data, userId })
        )
      );

      console.log(`✅ Sent ${notifications.length} bulk notifications`);
      return notifications.filter(n => n !== null);
    } catch (error) {
      console.error("❌ Error creating bulk notifications:", error);
      throw error;
    }
  }

  /**
   * Get user's notifications with pagination
   * @param {Number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications and metadata
   */
  static async getUserNotifications(userId, options = {},PushSubscription,  MasterUser) {
    try {
      const {
        page = 1,
        limit = 20,
        isRead,
        type,
        priority,
        startDate,
        endDate,
      } = options;

      const offset = (page - 1) * limit;
      const where = {
        userId,
        isDeleted: false,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      };

      if (isRead !== undefined) where.isRead = isRead;
      if (type) where.type = type;
      if (priority) where.priority = priority;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const { rows: notifications, count: total } =
        await Notification.findAndCountAll({
          where,
          include: [
            {
              model: MasterUser,
              as: "actor",
              attributes: ["masterUserID", "name", "email"],  // Fixed: Use masterUserID instead of userId
            },
          ],
          order: [["createdAt", "DESC"]],
          limit: parseInt(limit),
          offset,
        });

      const unreadCount = await this.getUnreadCount(userId);

      return {
        notifications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
        unreadCount,
      };
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {Number} notificationId - Notification ID
   * @param {Number} userId - User ID (for security)
   * @returns {Promise<Object>} Updated notification
   */
  static async markAsRead(notificationId, userId,PushSubscription,  MasterUser ) {
    try {
      const notification = await Notification.findOne({
        where: { notificationId, userId },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      if (!notification.isRead) {
        await notification.update({
          isRead: true,
          readAt: new Date(),
        });

        // Emit update to user
        emitToUser(userId, "notification_read", {
          notificationId,
          unreadCount: await this.getUnreadCount(userId),
        });
      }

      return notification;
    } catch (error) {
      console.error("❌ Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {Number} userId - User ID
   * @returns {Promise<Number>} Number of notifications marked as read
   */
  static async markAllAsRead(userId, PushSubscription,  MasterUser) {
    try {
      const [updated] = await Notification.update(
        { isRead: true, readAt: new Date() },
        {
          where: {
            userId,
            isRead: false,
            isDeleted: false,
          },
        }
      );

      // Emit update to user
      emitToUser(userId, "all_notifications_read", {
        unreadCount: 0,
      });

      console.log(`✅ Marked ${updated} notifications as read for user ${userId}`);
      return updated;
    } catch (error) {
      console.error("❌ Error marking all as read:", error);
      throw error;
    }
  }

  /**
   * Soft delete notification
   * @param {Number} notificationId - Notification ID
   * @param {Number} userId - User ID (for security)
   */
  static async deleteNotification(notificationId, userId,PushSubscription,  MasterUser) {
    try {
      const notification = await Notification.findOne({
        where: { notificationId, userId },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      await notification.update({
        isDeleted: true,
        deletedAt: new Date(),
      });

      console.log(`✅ Deleted notification ${notificationId} for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error("❌ Error deleting notification:", error);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   * @param {Number} userId - User ID
   */
  static async deleteAllNotifications(userId,PushSubscription,  MasterUser ) {
    try {
      const [updated] = await Notification.update(
        { isDeleted: true, deletedAt: new Date() },
        {
          where: {
            userId,
            isDeleted: false,
          },
        }
      );

      console.log(`✅ Deleted ${updated} notifications for user ${userId}`);
      return { success: true, deleted: updated };
    } catch (error) {
      console.error("❌ Error deleting all notifications:", error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   * @param {Number} userId - User ID
   * @returns {Promise<Number>} Unread count
   */
  static async getUnreadCount(userId) {
    try {
      return await Notification.count({
        where: {
          userId,
          isRead: false,
          isDeleted: false,
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gt]: new Date() } },
          ],
        },
      });
    } catch (error) {
      console.error("❌ Error getting unread count:", error);
      return 0;
    }
  }

  /**
   * Get or create user notification preferences
   * @param {Number} userId - User ID
   * @returns {Promise<Object>} Notification preferences
   */
  static async getPreferences(userId) {
    try {
      let preferences = await NotificationPreference.findOne({
        where: { userId },
      });

      if (!preferences) {
        // Create default preferences
        preferences = await NotificationPreference.create({ userId });
      }

      return preferences;
    } catch (error) {
      console.error("❌ Error getting preferences:", error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   * @param {Number} userId - User ID
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  static async updatePreferences(userId, updates,PushSubscription,  MasterUser ) {
    try {
      let preferences = await NotificationPreference.findOne({
        where: { userId },
      });

      if (!preferences) {
        preferences = await NotificationPreference.create({
          userId,
          ...updates,
        });
      } else {
        await preferences.update(updates);
      }

      console.log(`✅ Updated notification preferences for user ${userId}`);
      return preferences;
    } catch (error) {
      console.error("❌ Error updating preferences:", error);
      throw error;
    }
  }

  /**
   * Check if user wants to receive this type of notification
   * @param {Number} userId - User ID
   * @param {String} type - Notification type
   * @returns {Promise<Boolean>} Whether to send notification
   */
  static async checkUserPreferences(userId, type) {
    try {
      const preferences = await this.getPreferences(userId);

      // Check if in-app notifications are enabled
      if (!preferences.inAppEnabled) return false;

      // Check if currently in quiet hours
      if (preferences.quietHoursStart && preferences.quietHoursEnd) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        if (
          currentTime >= preferences.quietHoursStart &&
          currentTime <= preferences.quietHoursEnd
        ) {
          return false;
        }
      }

      // Check if muted
      if (preferences.muteUntil && new Date() < new Date(preferences.muteUntil)) {
        return false;
      }

      // Check specific notification type preference
      const typeMap = {
        deal_created: "inAppDealCreated",
        deal_updated: "inAppDealUpdated",
        deal_assigned: "inAppDealAssigned",
        deal_won: "inAppDealWon",
        deal_lost: "inAppDealLost",
        lead_created: "inAppLeadCreated",
        lead_assigned: "inAppLeadAssigned",
        activity_created: "inAppActivityCreated",
        activity_assigned: "inAppActivityAssigned",
        activity_due: "inAppActivityDue",
        email_received: "inAppEmailReceived",
        mention: "inAppMention",
        comment: "inAppComment",
      };

      const preferenceKey = typeMap[type];
      if (preferenceKey && preferences[preferenceKey] === false) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("❌ Error checking preferences:", error);
      return true; // Default to sending if error
    }
  }

  /**
   * Send push notification (placeholder for Firebase FCM)
   * @param {Number} userId - User ID
   * @param {Object} notification - Notification data
   */
  static async sendPushNotification(userId, notification) {
    try {
      // Check if user has push enabled
      const preferences = await this.getPreferences(userId);
      if (!preferences.pushEnabled) return;

      // Get user's push subscriptions
      const subscriptions = await PushSubscription.findAll({
        where: { userId, isActive: true },
      });

      if (subscriptions.length === 0) return;

      // TODO: Implement Firebase FCM or Web Push API
      // This is a placeholder for the actual push notification logic
      console.log(`📱 Would send push notification to ${subscriptions.length} device(s) for user ${userId}`);
      
      // Example: Using web-push (uncomment when configured)
      // const webpush = require('web-push');
      // for (const sub of subscriptions) {
      //   try {
      //     await webpush.sendNotification(
      //       {
      //         endpoint: sub.endpoint,
      //         keys: sub.keys,
      //       },
      //       JSON.stringify({
      //         title: notification.title,
      //         body: notification.message,
      //         icon: '/icon.png',
      //         badge: '/badge.png',
      //         data: {
      //           url: notification.actionUrl,
      //         },
      //       })
      //     );
      //     await sub.update({ lastUsed: new Date() });
      //   } catch (error) {
      //     if (error.statusCode === 410) {
      //       // Subscription expired
      //       await sub.update({ isActive: false });
      //     }
      //   }
      // }
    } catch (error) {
      console.error("❌ Error sending push notification:", error);
    }
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications() {
    try {
      const [deleted] = await Notification.update(
        { isDeleted: true, deletedAt: new Date() },
        {
          where: {
            expiresAt: { [Op.lt]: new Date() },
            isDeleted: false,
          },
        }
      );

      if (deleted > 0) {
        console.log(`🗑️ Cleaned up ${deleted} expired notifications`);
      }

      return deleted;
    } catch (error) {
      console.error("❌ Error cleaning up notifications:", error);
      return 0;
    }
  }
}

module.exports = NotificationService;
