// 🚀 EMAIL BODY MANAGEMENT ROUTES
// Routes for managing background body fetching and on-demand body retrieval

const express = require('express');
const router = express.Router();
const EmailBodyService = require('../services/emailBodyService');
const BackgroundBodyFetcher = require('../workers/backgroundBodyFetcher');
const { verifyToken } = require('../middlewares/authMiddleware');
const dbContextMiddleware = require("../middlewares/dbContext");


router.use(dbContextMiddleware);


// 📊 Get body fetch statistics for current user
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const stats = await EmailBodyService.getBodyFetchStats(masterUserID);
    
    res.json({
      success: true,
      message: 'Body fetch statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error getting body fetch stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get body fetch statistics',
      error: error.message
    });
  }
});

// 📊 Get overall system statistics (admin only)
router.get('/stats/overall', verifyToken, async (req, res) => {
  try {
    // TODO: Add admin check here if needed
    const stats = await BackgroundBodyFetcher.getOverallStats();
    
    res.json({
      success: true,
      message: 'Overall system statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error getting overall stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get overall statistics',
      error: error.message
    });
  }
});

// 🔄 Manually trigger background body fetching for current user
router.post('/fetch/background', verifyToken, async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { batchSize = 20 } = req.body;
    
    // Get user provider info
    const { UserCredential } = require('../models');
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: masterUserID }
    });
    
    if (!userCredential) {
      return res.status(400).json({
        success: false,
        message: 'User email credentials not found'
      });
    }
    
    const result = await BackgroundBodyFetcher.triggerManualFetch(
      masterUserID, 
      userCredential.provider || 'gmail', 
      batchSize
    );
    
    res.json({
      success: true,
      message: 'Manual background fetch completed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error in manual background fetch:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger manual background fetch',
      error: error.message
    });
  }
});

// 🎯 Fetch specific email body on-demand
router.post('/fetch/on-demand/:emailId', verifyToken, async (req, res) => {
  try {
    const { emailId } = req.params;
    const masterUserID = req.adminId;
    
    // Get user provider info
    const { UserCredential } = require('../models');
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: masterUserID }
    });
    
    if (!userCredential) {
      return res.status(400).json({
        success: false,
        message: 'User email credentials not found'
      });
    }
    
    const updatedEmail = await EmailBodyService.fetchEmailBodyOnDemand(
      emailId,
      masterUserID,
      userCredential.provider || 'gmail'
    );
    
    res.json({
      success: true,
      message: 'Email body fetched successfully',
      data: {
        emailId: emailId,
        hasBody: !!updatedEmail.body,
        bodyLength: updatedEmail.body ? updatedEmail.body.length : 0,
        fetchStatus: updatedEmail.body_fetch_status
      }
    });
  } catch (error) {
    console.error('Error in on-demand fetch:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email body on-demand',
      error: error.message
    });
  }
});

// 🔄 Background worker management routes (admin only)

// Start background worker
router.post('/worker/start', verifyToken, async (req, res) => {
  try {
    // TODO: Add admin check here if needed
    
    if (BackgroundBodyFetcher.getStatus().isRunning) {
      return res.json({
        success: true,
        message: 'Background worker is already running',
        data: BackgroundBodyFetcher.getStatus()
      });
    }
    
    BackgroundBodyFetcher.startBackgroundFetching();
    
    res.json({
      success: true,
      message: 'Background body fetcher started successfully',
      data: BackgroundBodyFetcher.getStatus()
    });
  } catch (error) {
    console.error('Error starting background worker:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to start background worker',
      error: error.message
    });
  }
});

// Stop background worker
router.post('/worker/stop', verifyToken, async (req, res) => {
  try {
    // TODO: Add admin check here if needed
    
    BackgroundBodyFetcher.stopBackgroundFetching();
    
    res.json({
      success: true,
      message: 'Background body fetcher stopped successfully',
      data: BackgroundBodyFetcher.getStatus()
    });
  } catch (error) {
    console.error('Error stopping background worker:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to stop background worker',
      error: error.message
    });
  }
});

// Get worker status
router.get('/worker/status', verifyToken, async (req, res) => {
  try {
    const status = BackgroundBodyFetcher.getStatus();
    
    res.json({
      success: true,
      message: 'Worker status retrieved successfully',
      data: status
    });
  } catch (error) {
    console.error('Error getting worker status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get worker status',
      error: error.message
    });
  }
});

module.exports = router;
