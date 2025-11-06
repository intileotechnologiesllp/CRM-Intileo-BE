const express = require('express');
const router = express.Router();
const EmailBodyMongoService = require('../../services/emailBodyMongoService');

/**
 * Test endpoint to check email body in MongoDB
 * GET /api/mongodb/email-body/:emailId/check
 */
router.get('/email-body/:emailId/check', async (req, res) => {
  try {
    const { emailId } = req.params;
    const masterUserID = req.adminId; // Assuming middleware sets this
    
    if (!masterUserID) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - masterUserID required'
      });
    }
    
    const result = await EmailBodyMongoService.hasEmailBody(emailId, masterUserID);
    
    res.json({
      success: true,
      emailId,
      mongoStatus: result
    });
  } catch (error) {
    console.error('Error checking email body in MongoDB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test endpoint to get email body from MongoDB
 * GET /api/mongodb/email-body/:emailId
 */
router.get('/email-body/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { preserveOriginal = 'false', cleanBody = 'true' } = req.query;
    const masterUserID = req.adminId;
    
    if (!masterUserID) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - masterUserID required'
      });
    }
    
    const options = {
      cleanBody: cleanBody === 'true',
      preserveOriginal: preserveOriginal === 'true'
    };
    
    const result = await EmailBodyMongoService.getEmailBody(emailId, masterUserID, options);
    
    res.json({
      success: true,
      emailId,
      result
    });
  } catch (error) {
    console.error('Error getting email body from MongoDB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test endpoint to migrate email body from MySQL to MongoDB
 * POST /api/mongodb/email-body/:emailId/migrate
 */
router.post('/email-body/:emailId/migrate', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { mysqlBody, attachments = [] } = req.body;
    const masterUserID = req.adminId;
    
    if (!masterUserID) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - masterUserID required'
      });
    }
    
    if (!mysqlBody) {
      return res.status(400).json({
        success: false,
        error: 'mysqlBody is required in request body'
      });
    }
    
    const result = await EmailBodyMongoService.migrateEmailBodyFromMySQL(
      emailId, 
      masterUserID, 
      mysqlBody, 
      attachments
    );
    
    res.json({
      success: true,
      emailId,
      migrationResult: result
    });
  } catch (error) {
    console.error('Error migrating email body to MongoDB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get email body statistics for a user
 * GET /api/mongodb/email-body/stats
 */
router.get('/email-body/stats', async (req, res) => {
  try {
    const masterUserID = req.adminId;
    
    if (!masterUserID) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - masterUserID required'
      });
    }
    
    const stats = await EmailBodyMongoService.getBodyStatistics(masterUserID);
    
    res.json({
      success: true,
      masterUserID,
      statistics: stats
    });
  } catch (error) {
    console.error('Error getting email body statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cleanup old email bodies (maintenance endpoint)
 * DELETE /api/mongodb/email-body/cleanup
 */
router.delete('/email-body/cleanup', async (req, res) => {
  try {
    const { daysOld = 365, dryRun = true } = req.query;
    const masterUserID = req.adminId;
    
    if (!masterUserID) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - masterUserID required'
      });
    }
    
    // Only allow cleanup for admin users (add your own authorization logic)
    const result = await EmailBodyMongoService.cleanupOldBodies(
      parseInt(daysOld), 
      dryRun !== 'false'
    );
    
    res.json({
      success: true,
      cleanupResult: result
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;