const mongoose = require('mongoose');

/**
 * Analytics Schema for MongoDB
 * 
 * This model demonstrates how to use MongoDB with Mongoose in your CRM system
 * It stores analytics data like user activities, email interactions, etc.
 */

const analyticsSchema = new mongoose.Schema({
  // User information
  userId: {
    type: String,
    required: true,
    index: true // Index for faster queries
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Event tracking
  eventType: {
    type: String,
    required: true,
    enum: [
      'email_opened',
      'email_clicked', 
      'lead_created',
      'deal_created',
      'login',
      'logout',
      'page_view',
      'document_download',
      'form_submission',
      'api_call'
    ]
  },
  
  // Event details
  eventData: {
    emailId: String,
    leadId: String,
    dealId: String,
    pageUrl: String,
    ipAddress: String,
    userAgent: String,
    duration: Number, // in seconds
    metadata: mongoose.Schema.Types.Mixed // Flexible field for additional data
  },
  
  // Geolocation (optional)
  location: {
    country: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true // Index for time-based queries
  },
  
  // Session information
  sessionId: String,
  
  // Performance metrics
  performance: {
    loadTime: Number,
    responseTime: Number,
    errorCount: Number
  }
}, {
  // Schema options
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'analytics' // Explicit collection name
});

// Indexes for better query performance
analyticsSchema.index({ userId: 1, timestamp: -1 });
analyticsSchema.index({ eventType: 1, timestamp: -1 });
analyticsSchema.index({ 'eventData.emailId': 1 });
analyticsSchema.index({ 'eventData.leadId': 1 });
analyticsSchema.index({ 'eventData.dealId': 1 });

// Static methods for common queries
analyticsSchema.statics.getEventsByUser = function(userId, startDate, endDate) {
  return this.find({
    userId: userId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ timestamp: -1 });
};

analyticsSchema.statics.getEventsByType = function(eventType, limit = 100) {
  return this.find({ eventType }).sort({ timestamp: -1 }).limit(limit);
};

// Instance methods
analyticsSchema.methods.getRelatedEvents = function() {
  return this.constructor.find({
    userId: this.userId,
    timestamp: {
      $gte: new Date(this.timestamp.getTime() - 60000), // 1 minute before
      $lte: new Date(this.timestamp.getTime() + 60000)  // 1 minute after
    }
  });
};

// Pre-save middleware (runs before saving)
analyticsSchema.pre('save', function(next) {
  // Add any pre-save logic here
  if (!this.sessionId) {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Virtual fields (computed properties)
analyticsSchema.virtual('isRecentEvent').get(function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.timestamp > oneHourAgo;
});

// Export the model
const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;