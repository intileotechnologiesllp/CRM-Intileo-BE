const express = require('express');
const router = express.Router();
const MongoDBService = require('../../services/mongodbService');
const { checkMongoConnection } = require('../../models/mongodb');

// Import email body routes
const emailBodyRoutes = require('./emailBodyRoutes');

/**
 * MongoDB Analytics and Email Body Storage Routes
 * 
 * These routes demonstrate how to use MongoDB alongside your existing MySQL system
 * They provide analytics, logging, and email body storage capabilities that complement your CRM
 */

// Middleware to check MongoDB connection
const ensureMongoConnection = (req, res, next) => {
  if (!checkMongoConnection()) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB connection is not available'
    });
  }
  next();
};

// Apply middleware to all routes
router.use(ensureMongoConnection);

// Email body storage routes
router.use('/', emailBodyRoutes);

/**
 * @route   GET /api/mongodb/health
 * @desc    Check MongoDB connection status
 * @access  Public (for monitoring)
 */
router.get('/health', (req, res) => {
  try {
    const isConnected = checkMongoConnection();
    res.json({
      success: true,
      mongodb: {
        connected: isConnected,
        status: isConnected ? 'healthy' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking MongoDB health',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/mongodb/analytics/log
 * @desc    Log user activity
 * @access  Private
 */
router.post('/analytics/log', async (req, res) => {
  try {
    const { eventType, eventData } = req.body;
    const userId = req.adminId; // From your auth middleware
    
    // You might want to get userEmail from your existing user system
    const userEmail = req.userEmail || 'unknown@example.com';
    
    const result = await MongoDBService.logUserActivity(
      userId, 
      userEmail, 
      eventType, 
      eventData
    );
    
    res.json({
      success: true,
      message: 'Activity logged successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging activity',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/mongodb/analytics/user/:userId
 * @desc    Get user activity summary
 * @access  Private
 */
router.get('/analytics/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const summary = await MongoDBService.getUserActivitySummary(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting user activity summary',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/mongodb/analytics/events/:eventType
 * @desc    Get recent events by type
 * @access  Private
 */
router.get('/analytics/events/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const { limit = 50 } = req.query;
    
    const events = await MongoDBService.getTopEventsByType(eventType, parseInt(limit));
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting events by type',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/mongodb/email/activity
 * @desc    Log email activity
 * @access  Private
 */
router.post('/email/activity', async (req, res) => {
  try {
    const { emailId, activityType, trackingData, interactionData } = req.body;
    const userId = req.adminId;
    
    const result = await MongoDBService.logEmailActivity(
      emailId,
      userId,
      activityType,
      trackingData,
      interactionData
    );
    
    res.json({
      success: true,
      message: 'Email activity logged successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging email activity',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/mongodb/email/analytics/:emailId
 * @desc    Get email analytics
 * @access  Private
 */
router.get('/email/analytics/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    
    const analytics = await MongoDBService.getEmailAnalytics(emailId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting email analytics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/mongodb/dashboard/:userId
 * @desc    Get dashboard analytics for user
 * @access  Private
 */
router.get('/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 7 } = req.query;
    
    const dashboard = await MongoDBService.getDashboardAnalytics(userId, parseInt(days));
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting dashboard analytics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/mongodb/engagement/:userId
 * @desc    Get user engagement metrics
 * @access  Private
 */
router.get('/engagement/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;
    
    const engagement = await MongoDBService.getUserEngagementMetrics(userId, parseInt(days));
    
    res.json({
      success: true,
      data: engagement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting engagement metrics',
      error: error.message
    });
  }
});

module.exports = router;