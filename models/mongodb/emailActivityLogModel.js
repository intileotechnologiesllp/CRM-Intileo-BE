const mongoose = require('mongoose');

/**
 * Email Activity Log Schema for MongoDB
 * 
 * This model stores detailed email interaction logs that complement 
 * your existing MySQL email system with advanced analytics capabilities
 */

const emailActivityLogSchema = new mongoose.Schema({
  // Reference to MySQL email record
  emailId: {
    type: String,
    required: true,
    index: true
  },
  
  // User tracking
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Activity details
  activityType: {
    type: String,
    required: true,
    enum: [
      'sent',
      'delivered',
      'opened',
      'clicked',
      'replied',
      'forwarded',
      'bounced',
      'unsubscribed',
      'marked_spam',
      'marked_important',
      'archived',
      'deleted'
    ]
  },
  
  // Tracking details
  trackingData: {
    ipAddress: String,
    userAgent: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown']
    },
    browser: String,
    operatingSystem: String,
    location: {
      country: String,
      region: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    }
  },
  
  // Email interaction metrics
  interaction: {
    timeSpent: Number, // Time spent reading email in seconds
    scrollDepth: Number, // Percentage of email scrolled
    clickedLinks: [{
      url: String,
      clickedAt: Date,
      linkText: String
    }],
    attachmentDownloads: [{
      filename: String,
      downloadedAt: Date,
      fileSize: Number
    }]
  },
  
  // Campaign/Template tracking (if applicable)
  campaign: {
    campaignId: String,
    templateId: String,
    variant: String, // For A/B testing
    segmentId: String
  },
  
  // Performance metrics
  performance: {
    loadTime: Number, // Email load time in milliseconds
    renderTime: Number, // Time to render email content
    errors: [{
      errorType: String,
      errorMessage: String,
      occurredAt: Date
    }]
  },
  
  // Timestamps
  activityTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Additional metadata
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  collection: 'email_activity_logs'
});

// Compound indexes for efficient queries
emailActivityLogSchema.index({ emailId: 1, activityType: 1 });
emailActivityLogSchema.index({ userId: 1, activityTimestamp: -1 });
emailActivityLogSchema.index({ activityType: 1, activityTimestamp: -1 });
emailActivityLogSchema.index({ 'campaign.campaignId': 1, activityType: 1 });

// Static methods for analytics
emailActivityLogSchema.statics.getEmailAnalytics = function(emailId) {
  return this.aggregate([
    { $match: { emailId: emailId } },
    {
      $group: {
        _id: '$activityType',
        count: { $sum: 1 },
        lastActivity: { $max: '$activityTimestamp' },
        firstActivity: { $min: '$activityTimestamp' }
      }
    }
  ]);
};

emailActivityLogSchema.statics.getUserEngagement = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: userId,
        activityTimestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$activityTimestamp' } },
          activityType: '$activityType'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);
};

emailActivityLogSchema.statics.getCampaignPerformance = function(campaignId) {
  return this.aggregate([
    { $match: { 'campaign.campaignId': campaignId } },
    {
      $group: {
        _id: '$activityType',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        activityType: '$_id',
        count: 1,
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    }
  ]);
};

// Instance methods
emailActivityLogSchema.methods.getRelatedActivities = function() {
  return this.constructor.find({
    emailId: this.emailId,
    _id: { $ne: this._id }
  }).sort({ activityTimestamp: 1 });
};

// Pre-save middleware
emailActivityLogSchema.pre('save', function(next) {
  // Auto-detect device type from user agent
  if (this.trackingData && this.trackingData.userAgent && !this.trackingData.deviceType) {
    const ua = this.trackingData.userAgent.toLowerCase();
    if (ua.includes('mobile')) {
      this.trackingData.deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      this.trackingData.deviceType = 'tablet';
    } else if (ua.includes('desktop') || ua.includes('windows') || ua.includes('mac')) {
      this.trackingData.deviceType = 'desktop';
    } else {
      this.trackingData.deviceType = 'unknown';
    }
  }
  next();
});

// Virtual for engagement score
emailActivityLogSchema.virtual('engagementScore').get(function() {
  let score = 0;
  
  // Base activity scores
  const activityScores = {
    'opened': 1,
    'clicked': 3,
    'replied': 5,
    'forwarded': 4,
    'marked_important': 2
  };
  
  score += activityScores[this.activityType] || 0;
  
  // Bonus for time spent
  if (this.interaction && this.interaction.timeSpent) {
    score += Math.min(this.interaction.timeSpent / 30, 3); // Max 3 points for time
  }
  
  // Bonus for scroll depth
  if (this.interaction && this.interaction.scrollDepth) {
    score += (this.interaction.scrollDepth / 100) * 2; // Max 2 points for scroll
  }
  
  return Math.round(score * 10) / 10; // Round to 1 decimal place
});

const EmailActivityLog = mongoose.model('EmailActivityLog', emailActivityLogSchema);

module.exports = EmailActivityLog;