/**
 * Test endpoints for IMAP sync functionality
 * These endpoints are for testing and should be secured in production
 */

const { syncImapFlags, checkImapHealth } = require('../../services/imapSyncService');
const Email = require('../../models/email/emailModel');

/**
 * Test IMAP health for a user
 */
exports.testImapHealth = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    
    if (!masterUserID) {
      return res.status(400).json({
        success: false,
        message: "Admin ID required"
      });
    }

    console.log(`🔍 [IMAP TEST] Testing IMAP health for user ${masterUserID}`);
    
    const isHealthy = await checkImapHealth(masterUserID);
    
    res.status(200).json({
      success: true,
      message: "IMAP health check completed",
      data: {
        masterUserID,
        isHealthy,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ [IMAP TEST] Health check error:`, error.message);
    res.status(500).json({
      success: false,
      message: "IMAP health check failed",
      error: error.message
    });
  }
};

/**
 * Test IMAP sync for a specific set of emails
 */
exports.testImapSync = async (req, res) => {
  const {  Email  } = require.models;
  try {
    const masterUserID = req.adminId;
    const { emailIds, limit = 10 } = req.body;
    
    if (!masterUserID) {
      return res.status(400).json({
        success: false,
        message: "Admin ID required"
      });
    }

    console.log(`🔍 [IMAP TEST] Testing sync for user ${masterUserID}`);
    
    // Get test emails
    let emails;
    if (emailIds && emailIds.length > 0) {
      emails = await Email.findAll({
        where: {
          emailID: emailIds,
          masterUserID
        },
        attributes: ['emailID', 'uid', 'messageId', 'isRead', 'folder'],
        limit: Math.min(limit, 50) // Safety limit
      });
    } else {
      emails = await Email.findAll({
        where: {
          masterUserID,
          uid: { [require('sequelize').Op.ne]: null } // Only emails with UIDs
        },
        attributes: ['emailID', 'uid', 'messageId', 'isRead', 'folder'],
        limit: Math.min(limit, 10),
        order: [['createdAt', 'DESC']]
      });
    }

    if (emails.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No emails found for sync test",
        data: {
          masterUserID,
          emailsFound: 0
        }
      });
    }

    console.log(`📧 [IMAP TEST] Found ${emails.length} emails for sync test`);
    
    // Convert to plain objects
    const emailData = emails.map(email => email.get({ plain: true }));
    
    // Test sync
    const syncedEmails = await syncImapFlags(emailData, masterUserID);
    
    // Compare results
    const changes = [];
    emailData.forEach((original, index) => {
      const synced = syncedEmails[index];
      if (synced && original.isRead !== synced.isRead) {
        changes.push({
          emailID: original.emailID,
          uid: original.uid,
          before: original.isRead,
          after: synced.isRead
        });
      }
    });

    res.status(200).json({
      success: true,
      message: "IMAP sync test completed",
      data: {
        masterUserID,
        emailsProcessed: emails.length,
        changesDetected: changes.length,
        changes,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ [IMAP TEST] Sync test error:`, error.message);
    res.status(500).json({
      success: false,
      message: "IMAP sync test failed",
      error: error.message
    });
  }
};

/**
 * Get IMAP sync statistics
 */
exports.getImapStats = async (req, res) => {
  const { Email } = require.models;
  try {
    const masterUserID = req.adminId;
    
    if (!masterUserID) {
      return res.status(400).json({
        success: false,
        message: "Admin ID required"
      });
    }

    const { Sequelize } = require('sequelize');
    
    // Get email statistics
    const totalEmails = await Email.count({
      where: { masterUserID }
    });
    
    const emailsWithUIDs = await Email.count({
      where: { 
        masterUserID,
        uid: { [Sequelize.Op.ne]: null }
      }
    });
    
    const readEmails = await Email.count({
      where: { 
        masterUserID,
        isRead: true
      }
    });
    
    const unreadEmails = await Email.count({
      where: { 
        masterUserID,
        isRead: false
      }
    });

    // Get sample emails with UIDs for debugging
    const sampleEmailsWithUIDs = await Email.findAll({
      where: { 
        masterUserID,
        uid: { [Sequelize.Op.ne]: null }
      },
      attributes: ['emailID', 'uid', 'messageId', 'isRead', 'folder', 'subject'],
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      message: "IMAP statistics retrieved",
      data: {
        masterUserID,
        statistics: {
          totalEmails,
          emailsWithUIDs,
          readEmails,
          unreadEmails,
          syncableEmails: emailsWithUIDs,
          syncablePercentage: totalEmails > 0 ? ((emailsWithUIDs / totalEmails) * 100).toFixed(2) : 0
        },
        sampleEmailsWithUIDs: sampleEmailsWithUIDs.map(email => ({
          emailID: email.emailID,
          uid: email.uid,
          isRead: email.isRead,
          folder: email.folder,
          subject: email.subject ? email.subject.substring(0, 50) + '...' : null
        })),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ [IMAP STATS] Error:`, error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get IMAP statistics",
      error: error.message
    });
  }
};