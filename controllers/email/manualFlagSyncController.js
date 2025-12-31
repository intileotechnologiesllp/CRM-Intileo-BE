const { Email } = require('../../models');
const flagSyncQueue = require('../../services/flagSyncQueueService');

/**
 * Manual Flag Sync Controller
 * Provides on-demand flag synchronization for users with problematic IMAP servers
 */

// Manual flag sync trigger for specific user
exports.triggerManualFlagSync = async (req, res) => {
  try {
    const { userID } = req.params;
    const { priority = 5 } = req.body;

    console.log(`📱 Manual flag sync requested for user ${userID}`);

    // Queue high-priority flag sync job
    const jobId = await flagSyncQueue.queueFlagSync(userID, [], priority);

    res.status(200).json({
      success: true,
      message: `Manual flag sync queued for user ${userID}`,
      jobId,
      priority,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual flag sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue manual flag sync',
      error: error.message
    });
  }
};

// Get flag sync status for user
exports.getFlagSyncStatus = async (req, res) => {
  const { Email } = require.models;
  try {
    const { userID } = req.params;

    // Get recent emails and their flag status
    const recentEmails = await Email.findAll({
      where: { masterUserID: userID },
      attributes: ['emailID', 'uid', 'isRead', 'folder', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 10
    });

    const stats = {
      totalEmails: recentEmails.length,
      readEmails: recentEmails.filter(e => e.isRead).length,
      unreadEmails: recentEmails.filter(e => !e.isRead).length,
      lastFlagUpdate: recentEmails[0]?.updatedAt || null
    };

    res.status(200).json({
      success: true,
      userID,
      stats,
      recentEmails: recentEmails.slice(0, 5), // Show 5 most recent
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Flag sync status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get flag sync status',
      error: error.message
    });
  }
};

// Mark emails as read/unread manually (bypass IMAP sync)
exports.updateEmailFlags = async (req, res) => {
  try {
    const { userID } = req.params;
    const { emailIDs, isRead } = req.body;
    const { Email  } = require.models;

    if (!Array.isArray(emailIDs) || typeof isRead !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'emailIDs must be an array and isRead must be boolean'
      });
    }

    // Update database flags directly
    const [updatedCount] = await Email.update(
      { isRead },
      { 
        where: { 
          emailID: emailIDs,
          masterUserID: userID 
        } 
      }
    );

    console.log(`📝 Manual flag update: ${updatedCount} emails updated for user ${userID}`);

    res.status(200).json({
      success: true,
      message: `Updated ${updatedCount} email flags`,
      updatedCount,
      isRead,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual flag update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email flags',
      error: error.message
    });
  }
};

module.exports = exports;