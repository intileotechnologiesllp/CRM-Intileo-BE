const ContactSyncConfig = require("../../models/contact/contactSyncConfigModel");
const ContactSyncHistory = require("../../models/contact/contactSyncHistoryModel");
const ContactChangeLog = require("../../models/contact/contactChangeLogModel");
const contactSyncService = require("../../services/contactSyncService");
const googleContactsService = require("../../services/googleContactsService");

/**
 * Get Google OAuth authorization URL
 */
exports.getGoogleAuthUrl = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    
    // Pass user ID in state parameter for callback
    const authUrl = googleContactsService.getAuthorizationUrl(masterUserID);

    res.status(200).json({
      success: true,
      authUrl,
      message:
        "Please visit this URL to authorize access to your Google Contacts",
    });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate authorization URL",
      error: error.message,
    });
  }
};

/**
 * Handle Google OAuth callback
 */
exports.handleGoogleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).send(`
        <html>
          <body>
            <h2>Authorization Failed</h2>
            <p>Authorization code is missing.</p>
            <a href="${process.env.FRONTEND_URL}">Go back to app</a>
          </body>
        </html>
      `);
    }

    if (!state) {
      return res.status(400).send(`
        <html>
          <body>
            <h2>Authorization Failed</h2>
            <p>User ID is missing from state parameter.</p>
            <a href="${process.env.FRONTEND_URL}">Go back to app</a>
          </body>
        </html>
      `);
    }

    const masterUserID = parseInt(state);

    // Exchange code for tokens
    const tokens = await googleContactsService.getTokensFromCode(code);

    // Check if sync config already exists
    let syncConfig = await ContactSyncConfig.findOne({
      where: { masterUserID, provider: "google" },
    });

    if (syncConfig) {
      // Update existing config
      await syncConfig.update({
        googleEmail: tokens.email,
        googleAccessToken: tokens.accessToken,
        googleRefreshToken: tokens.refreshToken,
        googleTokenExpiry: new Date(tokens.expiryDate),
        isActive: true,
      });
    } else {
      // Create new config
      syncConfig = await ContactSyncConfig.create({
        masterUserID,
        provider: "google",
        googleEmail: tokens.email,
        googleAccessToken: tokens.accessToken,
        googleRefreshToken: tokens.refreshToken,
        googleTokenExpiry: new Date(tokens.expiryDate),
        isActive: true,
        syncMode: "bidirectional",
        syncDirection: "two_way",
      });
    }

    // Send success HTML page that will close popup or redirect
    res.status(200).send(`
      <html>
        <head>
          <title>Authorization Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #667eea; margin-bottom: 20px; }
            p { color: #666; margin-bottom: 30px; font-size: 16px; }
            .success-icon { font-size: 60px; margin-bottom: 20px; }
            .btn {
              background: #667eea;
              color: white;
              padding: 12px 30px;
              border: none;
              border-radius: 5px;
              text-decoration: none;
              display: inline-block;
              cursor: pointer;
              font-size: 16px;
            }
            .btn:hover { background: #5568d3; }
            .info { background: #f0f4ff; padding: 15px; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Google Account Connected!</h1>
            <p>Your Google Contacts account has been successfully connected.</p>
            <div class="info">
              <strong>Email:</strong> ${syncConfig.googleEmail}<br>
              <strong>Sync Mode:</strong> ${syncConfig.syncMode}
            </div>
            <p style="margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}" class="btn">
                Go Back to App
              </a>
            </p>
            <p style="margin-top: 10px; color: #999; font-size: 14px;">
              You can now trigger a contact sync from your CRM.
            </p>
          </div>
          <script>
            // If opened in popup, notify parent and close
            if (window.opener) {
              window.opener.postMessage({
                type: 'google-auth-success',
                syncConfig: ${JSON.stringify({
                  syncConfigId: syncConfig.syncConfigId,
                  googleEmail: syncConfig.googleEmail,
                  syncMode: syncConfig.syncMode,
                  isActive: syncConfig.isActive,
                })}
              }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error handling Google callback:", error);
    res.status(500).send(`
      <html>
        <head>
          <title>Authorization Failed</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            h1 { color: #f5576c; }
            .error-icon { font-size: 60px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Connection Failed</h1>
            <p>${error.message}</p>
            <a href="${process.env.FRONTEND_URL}">Go back to app</a>
          </div>
        </body>
      </html>
    `);
  }
};

/**
 * Create or update sync configuration
 */
exports.createOrUpdateSyncConfig = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const {
      syncMode,
      syncDirection,
      autoSyncEnabled,
      syncFrequency,
      conflictResolution,
      deletionHandling,
      fieldMapping,
    } = req.body;

    // Find existing config
    let syncConfig = await ContactSyncConfig.findOne({
      where: { masterUserID, provider: "google" },
    });

    if (syncConfig) {
      // Update existing
      await syncConfig.update({
        syncMode: syncMode || syncConfig.syncMode,
        syncDirection: syncDirection || syncConfig.syncDirection,
        autoSyncEnabled:
          autoSyncEnabled !== undefined
            ? autoSyncEnabled
            : syncConfig.autoSyncEnabled,
        syncFrequency: syncFrequency || syncConfig.syncFrequency,
        conflictResolution:
          conflictResolution || syncConfig.conflictResolution,
        deletionHandling: deletionHandling || syncConfig.deletionHandling,
        fieldMapping: fieldMapping || syncConfig.fieldMapping,
      });
    } else {
      return res.status(404).json({
        success: false,
        message:
          "No Google account connected. Please connect your Google account first.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Sync configuration updated successfully",
      syncConfig,
    });
  } catch (error) {
    console.error("Error updating sync config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sync configuration",
      error: error.message,
    });
  }
};

/**
 * Get sync configuration
 */
exports.getSyncConfig = async (req, res) => {
  try {
    const masterUserID = req.adminId;

    const syncConfig = await ContactSyncConfig.findOne({
      where: { masterUserID, provider: "google" },
      attributes: { exclude: ["googleAccessToken", "googleRefreshToken"] },
    });

    if (!syncConfig) {
      return res.status(404).json({
        success: false,
        message: "No sync configuration found. Please connect Google account.",
      });
    }

    res.status(200).json({
      success: true,
      syncConfig,
    });
  } catch (error) {
    console.error("Error fetching sync config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sync configuration",
      error: error.message,
    });
  }
};

/**
 * Start manual sync
 */
exports.startSync = async (req, res) => {
  try {
    const masterUserID = req.adminId;

    // Get sync config
    const syncConfig = await ContactSyncConfig.findOne({
      where: { masterUserID, provider: "google", isActive: true },
    });

    if (!syncConfig) {
      return res.status(404).json({
        success: false,
        message:
          "No active sync configuration found. Please set up Google sync first.",
      });
    }

    // Start sync in background (don't wait)
    contactSyncService
      .performSync(masterUserID, syncConfig.syncConfigId)
      .then((result) => {
        console.log("✅ Sync completed:", result);
      })
      .catch((error) => {
        console.error("❌ Sync failed:", error);
      });

    res.status(200).json({
      success: true,
      message: "Contact sync started. This may take a few minutes.",
      syncConfigId: syncConfig.syncConfigId,
    });
  } catch (error) {
    console.error("Error starting sync:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start sync",
      error: error.message,
    });
  }
};

/**
 * Get sync history
 */
exports.getSyncHistory = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows } = await ContactSyncHistory.findAndCountAll({
      where: { masterUserID },
      order: [["startedAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      history: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sync history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sync history",
      error: error.message,
    });
  }
};

/**
 * Get specific sync history details
 */
exports.getSyncHistoryDetails = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { syncHistoryId } = req.params;

    const history = await ContactSyncHistory.findOne({
      where: { syncHistoryId, masterUserID },
    });

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Sync history not found",
      });
    }

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Error fetching sync history details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sync history details",
      error: error.message,
    });
  }
};

/**
 * Get change logs for a sync
 */
exports.getChangeLogs = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { syncHistoryId } = req.params;
    const { page = 1, limit = 50, operation, changeType } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause
    const where = { masterUserID, syncHistoryId };
    if (operation) where.operation = operation;
    if (changeType) where.changeType = changeType;

    const { count, rows } = await ContactChangeLog.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      changeLogs: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching change logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch change logs",
      error: error.message,
    });
  }
};

/**
 * Get change logs for a specific contact
 */
exports.getContactChangeLogs = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { personId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows } = await ContactChangeLog.findAndCountAll({
      where: { masterUserID, personId },
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      changeLogs: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching contact change logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact change logs",
      error: error.message,
    });
  }
};

/**
 * Disconnect Google account
 */
exports.disconnectGoogle = async (req, res) => {
  try {
    const masterUserID = req.adminId;

    const syncConfig = await ContactSyncConfig.findOne({
      where: { masterUserID, provider: "google" },
    });

    if (!syncConfig) {
      return res.status(404).json({
        success: false,
        message: "No Google account connected",
      });
    }

    await syncConfig.update({
      isActive: false,
      autoSyncEnabled: false,
    });

    res.status(200).json({
      success: true,
      message: "Google account disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting Google:", error);
    res.status(500).json({
      success: false,
      message: "Failed to disconnect Google account",
      error: error.message,
    });
  }
};

/**
 * Get sync statistics
 */
exports.getSyncStats = async (req, res) => {
  try {
    const masterUserID = req.adminId;

    const syncConfig = await ContactSyncConfig.findOne({
      where: { masterUserID, provider: "google" },
    });

    if (!syncConfig) {
      return res.status(404).json({
        success: false,
        message: "No sync configuration found",
      });
    }

    // Get recent sync history
    const recentSyncs = await ContactSyncHistory.findAll({
      where: { masterUserID },
      order: [["startedAt", "DESC"]],
      limit: 10,
    });

    // Calculate stats
    const totalSyncs = recentSyncs.length;
    const completedSyncs = recentSyncs.filter(
      (s) => s.status === "completed"
    ).length;
    const failedSyncs = recentSyncs.filter((s) => s.status === "failed").length;

    const totalCreated = recentSyncs.reduce(
      (sum, s) => sum + (s.createdInCRM || 0) + (s.createdInGoogle || 0),
      0
    );
    const totalUpdated = recentSyncs.reduce(
      (sum, s) => sum + (s.updatedInCRM || 0) + (s.updatedInGoogle || 0),
      0
    );
    const totalDeleted = recentSyncs.reduce(
      (sum, s) => sum + (s.deletedInCRM || 0) + (s.deletedInGoogle || 0),
      0
    );
    const totalConflicts = recentSyncs.reduce(
      (sum, s) => sum + (s.conflicts || 0),
      0
    );

    res.status(200).json({
      success: true,
      stats: {
        syncConfig: {
          isActive: syncConfig.isActive,
          autoSyncEnabled: syncConfig.autoSyncEnabled,
          syncMode: syncConfig.syncMode,
          lastSyncAt: syncConfig.lastSyncAt,
          nextSyncAt: syncConfig.nextSyncAt,
        },
        overview: {
          totalSyncs,
          completedSyncs,
          failedSyncs,
          successRate:
            totalSyncs > 0
              ? Math.round((completedSyncs / totalSyncs) * 100)
              : 0,
        },
        operations: {
          totalCreated,
          totalUpdated,
          totalDeleted,
          totalConflicts,
        },
        recentSyncs: recentSyncs.map((s) => ({
          syncHistoryId: s.syncHistoryId,
          status: s.status,
          startedAt: s.startedAt,
          duration: s.duration,
          summary: s.summary,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching sync stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sync statistics",
      error: error.message,
    });
  }
};
