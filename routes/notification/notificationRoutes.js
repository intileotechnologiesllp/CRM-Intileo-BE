const express = require("express");
const router = express.Router();
const notificationController = require("../../controllers/notification/notificationController");
const notificationStatsController = require("../../controllers/notification/notificationStatsController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");

// All routes require authentication
router.use(verifyToken);
router.use(dbContextMiddleware);
// =============== NOTIFICATION ROUTES ===============

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications with pagination and filters
 * @access  Private
 * @query   page, limit, isRead, type, priority, startDate, endDate
 */
router.get("/", notificationController.getNotifications);

/**
 * @route   GET /api/notifications/progress
 * @desc    Get user's daily and monthly progress stats
 * @access  Private
 */
router.get("/progress", notificationStatsController.getUserProgress);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get("/unread-count", notificationController.getUnreadCount);

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put("/:notificationId/read", notificationController.markAsRead);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put("/read-all", notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Delete a notification
 * @access  Private
 */
router.delete("/:notificationId", notificationController.deleteNotification);

/**
 * @route   DELETE /api/notifications/delete-all
 * @desc    Delete all notifications
 * @access  Private
 */
router.delete("/delete-all/all", notificationController.deleteAllNotifications);

// =============== PREFERENCE ROUTES ===============

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user's notification preferences
 * @access  Private
 */
router.get("/preferences/settings", notificationController.getPreferences);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user's notification preferences
 * @access  Private
 */
router.put("/preferences/settings", notificationController.updatePreferences);

// =============== PUSH NOTIFICATION ROUTES ===============

/**
 * @route   POST /api/notifications/push/subscribe
 * @desc    Subscribe to push notifications
 * @access  Private
 */
router.post("/push/subscribe", notificationController.subscribeToPush);

/**
 * @route   POST /api/notifications/push/unsubscribe
 * @desc    Unsubscribe from push notifications
 * @access  Private
 */
router.post("/push/unsubscribe", notificationController.unsubscribeFromPush);

// =============== TEST ROUTE (Development) ===============

/**
 * @route   POST /api/notifications/test
 * @desc    Send a test notification
 * @access  Private
 */
router.post("/test", notificationController.sendTestNotification);

module.exports = router;
