const express = require("express");
const router = express.Router();
const userSessionController = require("../controllers/userSession/userSessionController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * @route   GET /api/user-sessions/active
 * @desc    Get all active sessions for the current user
 * @access  Private
 */
router.get("/active", userSessionController.getActiveSessions);

/**
 * @route   GET /api/user-sessions/history
 * @desc    Get device login history (last 60 days) with pagination
 * @access  Private
 * @query   page - Page number (default: 1)
 * @query   limit - Results per page (default: 50)
 */
router.get("/history", userSessionController.getSessionHistory);

/**
 * @route   POST /api/user-sessions/logout/:sessionId
 * @desc    Logout from a specific device/session
 * @access  Private
 * @param   sessionId - The session ID to logout
 */
router.post("/logout/:sessionId", userSessionController.logoutSpecificSession);

/**
 * @route   POST /api/user-sessions/logout-all-others
 * @desc    Logout from all other devices except current
 * @access  Private
 */
router.post("/logout-all-others", userSessionController.logoutAllOtherSessions);

/**
 * @route   GET /api/user-sessions/export
 * @desc    Export session history to CSV
 * @access  Private
 */
router.get("/export", userSessionController.exportSessionHistory);

module.exports = router;
