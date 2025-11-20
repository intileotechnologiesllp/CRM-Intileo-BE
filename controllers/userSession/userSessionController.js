const LoginHistory = require("../../models/reports/loginHistoryModel");
const { Op } = require("sequelize");
const moment = require("moment-timezone");

/**
 * Get all active sessions for the current user
 * @route GET /api/user-sessions/active
 * @access Private
 */
exports.getActiveSessions = async (req, res) => {
  try {
    const userId = req.adminId || req.user?.id;
    const currentSessionId = req.sessionId; // From JWT token

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Get all active sessions for this user
    const activeSessions = await LoginHistory.findAll({
      where: {
        userId: userId,
        isActive: true,
        logoutTime: null,
      },
      order: [["loginTime", "DESC"]],
    });

    // Format the sessions and identify current device
    const formattedSessions = activeSessions.map((session) => ({
      sessionId: session.id,
      device: session.device || "Unknown Device",
      location: session.location || "Unknown Location",
      ipAddress: session.ipAddress,
      loginTime: session.loginTime,
      loginTimeFormatted: moment(session.loginTime).format("MMMM DD, YYYY h:mm A"),
      isCurrentDevice: session.id === currentSessionId,
      loginVia: "password", // Can be enhanced to track OAuth logins
    }));

    res.status(200).json({
      success: true,
      message: "Active sessions retrieved successfully",
      data: {
        totalActiveSessions: formattedSessions.length,
        sessions: formattedSessions,
      },
    });
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve active sessions",
      error: error.message,
    });
  }
};

/**
 * Get device history (last 60 days) for the current user
 * @route GET /api/user-sessions/history
 * @access Private
 */
exports.getSessionHistory = async (req, res) => {
  try {
    const userId = req.adminId || req.user?.id;
    const { page = 1, limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Calculate date 60 days ago
    const sixtyDaysAgo = moment().subtract(60, "days").toDate();

    // Get login history for last 60 days with pagination
    const offset = (page - 1) * limit;
    const { count, rows: sessionHistory } = await LoginHistory.findAndCountAll({
      where: {
        userId: userId,
        loginTime: {
          [Op.gte]: sixtyDaysAgo,
        },
      },
      order: [["loginTime", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Format the history
    const formattedHistory = sessionHistory.map((session) => {
      const loginTime = moment(session.loginTime);
      const logoutTime = session.logoutTime ? moment(session.logoutTime) : null;
      
      return {
        sessionId: session.id,
        device: session.device || "Unknown Device",
        location: session.location || "Unknown Location",
        ipAddress: session.ipAddress,
        loginTime: session.loginTime,
        loginTimeFormatted: loginTime.format("MMMM DD, YYYY h:mm A"),
        logoutTime: session.logoutTime,
        logoutTimeFormatted: logoutTime ? logoutTime.format("MMMM DD, YYYY h:mm A") : null,
        duration: session.duration || null,
        loginVia: "password", // Can be enhanced
        logoutReason: session.logoutTime 
          ? (session.isActive === false ? "Logged out" : "Session expired")
          : null,
        isActive: session.isActive,
      };
    });

    res.status(200).json({
      success: true,
      message: "Session history retrieved successfully",
      data: {
        totalSessions: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        sessionsPerPage: parseInt(limit),
        sessions: formattedHistory,
      },
    });
  } catch (error) {
    console.error("Error fetching session history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve session history",
      error: error.message,
    });
  }
};

/**
 * Logout from a specific device/session
 * @route POST /api/user-sessions/logout/:sessionId
 * @access Private
 */
exports.logoutSpecificSession = async (req, res) => {
  try {
    const userId = req.adminId || req.user?.id;
    const { sessionId } = req.params;
    const currentSessionId = req.sessionId; // From JWT token

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Prevent user from logging out their current session via this endpoint
    if (parseInt(sessionId) === currentSessionId) {
      return res.status(400).json({
        success: false,
        message: "Cannot logout current session. Use the regular logout endpoint instead.",
      });
    }

    // Find the session
    const session = await LoginHistory.findOne({
      where: {
        id: sessionId,
        userId: userId,
        isActive: true,
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Active session not found",
      });
    }

    // Calculate session duration
    const loginTime = new Date(session.loginTime);
    const logoutTime = new Date();
    const durationInSeconds = Math.floor((logoutTime - loginTime) / 1000);
    const durationHours = Math.floor(durationInSeconds / 3600);
    const durationMinutes = Math.floor((durationInSeconds % 3600) / 60);
    const duration = `${durationHours} hours ${durationMinutes} minutes`;

    // Mark session as inactive
    await session.update({
      isActive: false,
      logoutTime: moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss"),
      duration: duration,
    });

    res.status(200).json({
      success: true,
      message: "Session logged out successfully",
      data: {
        sessionId: session.id,
        device: session.device,
        location: session.location,
        loggedOutAt: session.logoutTime,
      },
    });
  } catch (error) {
    console.error("Error logging out specific session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to logout session",
      error: error.message,
    });
  }
};

/**
 * Logout from all other devices except current
 * @route POST /api/user-sessions/logout-all-others
 * @access Private
 */
exports.logoutAllOtherSessions = async (req, res) => {
  try {
    const userId = req.adminId || req.user?.id;
    const currentSessionId = req.sessionId; // From JWT token

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!currentSessionId) {
      return res.status(400).json({
        success: false,
        message: "Current session ID not found",
      });
    }

    // Find all active sessions except current one
    const otherSessions = await LoginHistory.findAll({
      where: {
        userId: userId,
        isActive: true,
        id: {
          [Op.ne]: currentSessionId, // Not equal to current session
        },
      },
    });

    const logoutTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");

    // Logout all other sessions
    const logoutPromises = otherSessions.map(async (session) => {
      const loginTime = new Date(session.loginTime);
      const logoutTimeDate = new Date();
      const durationInSeconds = Math.floor((logoutTimeDate - loginTime) / 1000);
      const durationHours = Math.floor(durationInSeconds / 3600);
      const durationMinutes = Math.floor((durationInSeconds % 3600) / 60);
      const duration = `${durationHours} hours ${durationMinutes} minutes`;

      return session.update({
        isActive: false,
        logoutTime: logoutTime,
        duration: duration,
      });
    });

    await Promise.all(logoutPromises);

    res.status(200).json({
      success: true,
      message: `Successfully logged out from ${otherSessions.length} other device(s)`,
      data: {
        loggedOutSessions: otherSessions.length,
        currentSessionId: currentSessionId,
        loggedOutAt: logoutTime,
      },
    });
  } catch (error) {
    console.error("Error logging out all other sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to logout from other devices",
      error: error.message,
    });
  }
};

/**
 * Export session history to CSV
 * @route GET /api/user-sessions/export
 * @access Private
 */
exports.exportSessionHistory = async (req, res) => {
  try {
    const userId = req.adminId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Calculate date 60 days ago
    const sixtyDaysAgo = moment().subtract(60, "days").toDate();

    // Get all session history for last 60 days
    const sessionHistory = await LoginHistory.findAll({
      where: {
        userId: userId,
        loginTime: {
          [Op.gte]: sixtyDaysAgo,
        },
      },
      order: [["loginTime", "DESC"]],
    });

    // Create CSV content
    const csvHeader = "Device,Location,IP Address,Login Time,Logout Time,Duration,Status\n";
    const csvRows = sessionHistory.map((session) => {
      const device = (session.device || "Unknown Device").replace(/,/g, ";");
      const location = (session.location || "Unknown Location").replace(/,/g, ";");
      const ipAddress = session.ipAddress || "N/A";
      const loginTime = moment(session.loginTime).format("YYYY-MM-DD HH:mm:ss");
      const logoutTime = session.logoutTime 
        ? moment(session.logoutTime).format("YYYY-MM-DD HH:mm:ss")
        : "N/A";
      const duration = session.duration || "N/A";
      const status = session.isActive ? "Active" : "Logged out";

      return `"${device}","${location}","${ipAddress}","${loginTime}","${logoutTime}","${duration}","${status}"`;
    }).join("\n");

    const csvContent = csvHeader + csvRows;

    // Set response headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="session-history-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Error exporting session history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export session history",
      error: error.message,
    });
  }
};
