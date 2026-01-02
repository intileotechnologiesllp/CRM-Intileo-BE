const NotificationService = require("../../services/notification/notificationService");
const { PushSubscription } = require("../../models/notification");

/**
 * Get user's notifications with pagination and filters
 */
exports.getNotifications = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const { page, limit, isRead, type, priority, startDate, endDate } =
      req.query;

    const result = await NotificationService.getUserNotifications(userId, {
      page,
      limit,
      isRead: isRead !== undefined ? isRead === "true" : undefined,
      type,
      priority,
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

/**
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const count = await NotificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
      error: error.message,
    });
  }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const { notificationId } = req.params;

    const notification = await NotificationService.markAsRead(
      notificationId,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const updated = await NotificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: `Marked ${updated} notifications as read`,
      updated,
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const { notificationId } = req.params;

    await NotificationService.deleteNotification(notificationId, userId);

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete notification",
      error: error.message,
    });
  }
};

/**
 * Delete all notifications for a user
 */
exports.deleteAllNotifications = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const result = await NotificationService.deleteAllNotifications(userId);

    res.status(200).json({
      success: true,
      message: "All notifications deleted successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete all notifications",
      error: error.message,
    });
  }
};

/**
 * Get notification preferences
 */
exports.getPreferences = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const preferences = await NotificationService.getPreferences(userId);

    res.status(200).json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification preferences",
      error: error.message,
    });
  }
};

/**
 * Update notification preferences
 */
exports.updatePreferences = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const updates = req.body;

    const preferences = await NotificationService.updatePreferences(
      userId,
      updates
    );

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notification preferences",
      error: error.message,
    });
  }
};

/**
 * Subscribe to push notifications
 */
exports.subscribeToPush = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const { endpoint, keys, deviceInfo } = req.body;

    if (!endpoint || !keys) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: endpoint and keys",
      });
    }

    // Check if subscription already exists
    let subscription = await PushSubscription.findOne({
      where: { endpoint },
    });

    if (subscription) {
      // Update existing subscription
      await subscription.update({
        userId,
        keys,
        deviceInfo,
        isActive: true,
        lastUsed: new Date(),
      });
    } else {
      // Create new subscription
      subscription = await PushSubscription.create({
        userId,
        endpoint,
        keys,
        deviceInfo,
        isActive: true,
      });
    }

    res.status(200).json({
      success: true,
      message: "Successfully subscribed to push notifications",
      subscription,
    });
  } catch (error) {
    console.error("Error subscribing to push:", error);
    res.status(500).json({
      success: false,
      message: "Failed to subscribe to push notifications",
      error: error.message,
    });
  }
};

/**
 * Unsubscribe from push notifications
 */
exports.unsubscribeFromPush = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: endpoint",
      });
    }

    const subscription = await PushSubscription.findOne({
      where: { endpoint },
    });

    if (subscription) {
      await subscription.update({ isActive: false });
    }

    res.status(200).json({
      success: true,
      message: "Successfully unsubscribed from push notifications",
    });
  } catch (error) {
    console.error("Error unsubscribing from push:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsubscribe from push notifications",
      error: error.message,
    });
  }
};

/**
 * Test notification (for development)
 */
exports.sendTestNotification = async (req, res) => {
  const { PushSubscription,  MasterUser } = req.models;
  try {
    const userId = req.user?.userId || req.adminId; // Support both auth formats
    const {
      type = "system",
      title = "Test Notification",
      message = "This is a test notification",
      priority = "medium",
    } = req.body;

    const notification = await NotificationService.createNotification({
      userId,
      type,
      title,
      message,
      priority,
      actionBy: userId,
    });

    res.status(200).json({
      success: true,
      message: "Test notification sent successfully",
      notification,
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test notification",
      error: error.message,
    });
  }
};
