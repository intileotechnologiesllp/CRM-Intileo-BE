const { Analytics, EmailActivityLog } = require('../models/mongodb');

/**
 * MongoDB Service Layer
 * 
 * This service provides common MongoDB operations for your CRM system
 * It demonstrates how to integrate MongoDB alongside your existing MySQL system
 */

class MongoDBService {
  
  /**
   * Analytics Service Methods
   */
  
  // Log user activity
  static async logUserActivity(userId, userEmail, eventType, eventData = {}) {
    try {
      const analyticsEntry = new Analytics({
        userId,
        userEmail,
        eventType,
        eventData,
        timestamp: new Date()
      });
      
      await analyticsEntry.save();
      console.log(`📊 Analytics logged: ${eventType} for user ${userId}`);
      return analyticsEntry;
    } catch (error) {
      console.error('❌ Error logging analytics:', error);
      throw error;
    }
  }
  
  // Get user activity summary
  static async getUserActivitySummary(userId, startDate, endDate) {
    try {
      const activities = await Analytics.getEventsByUser(userId, startDate, endDate);
      
      // Group by event type
      const summary = activities.reduce((acc, activity) => {
        acc[activity.eventType] = (acc[activity.eventType] || 0) + 1;
        return acc;
      }, {});
      
      return {
        totalEvents: activities.length,
        eventBreakdown: summary,
        timeRange: { startDate, endDate }
      };
    } catch (error) {
      console.error('❌ Error getting user activity summary:', error);
      throw error;
    }
  }
  
  // Get top events by type
  static async getTopEventsByType(eventType, limit = 10) {
    try {
      return await Analytics.getEventsByType(eventType, limit);
    } catch (error) {
      console.error('❌ Error getting events by type:', error);
      throw error;
    }
  }
  
  /**
   * Email Activity Service Methods
   */
  
  // Log email activity
  static async logEmailActivity(emailId, userId, activityType, trackingData = {}, interactionData = {}) {
    try {
      const emailActivity = new EmailActivityLog({
        emailId,
        userId,
        activityType,
        trackingData,
        interaction: interactionData,
        activityTimestamp: new Date()
      });
      
      await emailActivity.save();
      console.log(`📧 Email activity logged: ${activityType} for email ${emailId}`);
      return emailActivity;
    } catch (error) {
      console.error('❌ Error logging email activity:', error);
      throw error;
    }
  }
  
  // Get email analytics
  static async getEmailAnalytics(emailId) {
    try {
      const analytics = await EmailActivityLog.getEmailAnalytics(emailId);
      
      // Convert to a more readable format
      const formattedAnalytics = analytics.reduce((acc, item) => {
        acc[item._id] = {
          count: item.count,
          firstActivity: item.firstActivity,
          lastActivity: item.lastActivity
        };
        return acc;
      }, {});
      
      return formattedAnalytics;
    } catch (error) {
      console.error('❌ Error getting email analytics:', error);
      throw error;
    }
  }
  
  // Get user engagement metrics
  static async getUserEngagementMetrics(userId, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const engagement = await EmailActivityLog.getUserEngagement(userId, startDate, endDate);
      
      return {
        userId,
        timeRange: { startDate, endDate },
        dailyEngagement: engagement
      };
    } catch (error) {
      console.error('❌ Error getting user engagement metrics:', error);
      throw error;
    }
  }
  
  /**
   * Integration Helper Methods
   */
  
  // Log email sent event (integrate with your existing email sending)
  static async logEmailSent(emailId, userId, userEmail, recipientEmail) {
    try {
      // Log in analytics
      await this.logUserActivity(userId, userEmail, 'email_sent', {
        emailId,
        recipientEmail
      });
      
      // Log in email activity
      await this.logEmailActivity(emailId, userId, 'sent');
      
      console.log(`✅ Email sent event logged for email ${emailId}`);
    } catch (error) {
      console.error('❌ Error logging email sent event:', error);
    }
  }
  
  // Log email opened event (for email tracking)
  static async logEmailOpened(emailId, userId, request) {
    try {
      const trackingData = {
        ipAddress: request.ip || request.connection.remoteAddress,
        userAgent: request.get('User-Agent'),
        // Add more tracking data as needed
      };
      
      await this.logEmailActivity(emailId, userId, 'opened', trackingData);
      
      console.log(`👀 Email opened event logged for email ${emailId}`);
    } catch (error) {
      console.error('❌ Error logging email opened event:', error);
    }
  }
  
  // Get dashboard analytics
  static async getDashboardAnalytics(userId, days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      // Get user activity summary
      const activitySummary = await this.getUserActivitySummary(userId, startDate, endDate);
      
      // Get engagement metrics
      const engagementMetrics = await this.getUserEngagementMetrics(userId, days);
      
      // Get recent email activities
      const recentEmailActivities = await EmailActivityLog.find({
        userId,
        activityTimestamp: { $gte: startDate }
      }).sort({ activityTimestamp: -1 }).limit(10);
      
      return {
        activitySummary,
        engagementMetrics,
        recentEmailActivities: recentEmailActivities.map(activity => ({
          emailId: activity.emailId,
          activityType: activity.activityType,
          timestamp: activity.activityTimestamp,
          engagementScore: activity.engagementScore
        }))
      };
    } catch (error) {
      console.error('❌ Error getting dashboard analytics:', error);
      throw error;
    }
  }
}

module.exports = MongoDBService;