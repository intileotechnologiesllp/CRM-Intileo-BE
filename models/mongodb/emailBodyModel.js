const mongoose = require('mongoose');

/**
 * EmailBody Schema for MongoDB
 * 
 * This model stores email body content separately from MySQL to reduce 
 * MySQL table size and improve performance for large text data
 */

const emailBodySchema = new mongoose.Schema({
  // Reference to MySQL email record
  emailID: {
    type: String,
    required: true,
    unique: true, // One body per email
    index: true
  },
  
  // User information for data isolation
  masterUserID: {
    type: String,
    required: true,
    index: true
  },
  
  // Email body content
  bodyHtml: {
    type: String,
    default: null
  },
  
  bodyText: {
    type: String,
    default: null
  },
  
  // Processed/cleaned body (what gets displayed to user)
  processedBody: {
    type: String,
    default: null
  },
  
  // Body metadata
  metadata: {
    originalSize: Number, // Size in bytes of original body
    processedSize: Number, // Size in bytes of processed body
    contentType: String, // 'html', 'text', 'mixed'
    hasImages: Boolean,
    hasAttachments: Boolean,
    hasCidReferences: Boolean,
    encoding: String,
    language: String // Detected language
  },
  
  // Processing status
  fetchStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'processing'],
    default: 'pending',
    index: true
  },
  
  // Processing history
  processingHistory: [{
    action: String, // 'fetched', 'cleaned', 'updated'
    timestamp: Date,
    details: String,
    processingTime: Number, // in milliseconds
    success: Boolean
  }],
  
  // Error information
  errorInfo: {
    lastError: String,
    errorCount: Number,
    lastErrorAt: Date
  },
  
  // Source information
  source: {
    provider: String, // 'gmail', 'outlook', etc.
    imapFolder: String,
    messageId: String,
    uid: String
  },
  
  // Performance metrics
  performance: {
    fetchTime: Number, // Time to fetch from IMAP
    cleanTime: Number, // Time to clean/process
    saveTime: Number, // Time to save to MongoDB
    totalProcessingTime: Number
  },
  
  // Versioning for body updates
  version: {
    type: Number,
    default: 1
  },
  
  // Backup of original content (optional, for debugging)
  originalContent: {
    enabled: {
      type: Boolean,
      default: false
    },
    bodyHtml: String,
    bodyText: String
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'email_bodies'
});

// Compound indexes for efficient queries
emailBodySchema.index({ emailID: 1, masterUserID: 1 });
emailBodySchema.index({ masterUserID: 1, fetchStatus: 1 });
emailBodySchema.index({ masterUserID: 1, createdAt: -1 });
emailBodySchema.index({ fetchStatus: 1, updatedAt: 1 }); // For cleanup tasks

// Static methods for common operations
emailBodySchema.statics.findByEmailID = function(emailID, masterUserID) {
  return this.findOne({ emailID, masterUserID });
};

emailBodySchema.statics.createOrUpdateBody = async function(emailID, masterUserID, bodyData) {
  const startTime = Date.now();
  
  try {
    const existing = await this.findOne({ emailID, masterUserID });
    
    if (existing) {
      // Update existing record
      Object.assign(existing, bodyData);
      existing.version += 1;
      existing.performance.saveTime = Date.now() - startTime;
      
      // Add to processing history
      existing.processingHistory.push({
        action: 'updated',
        timestamp: new Date(),
        details: 'Body content updated',
        processingTime: Date.now() - startTime,
        success: true
      });
      
      return await existing.save();
    } else {
      // Create new record
      const newBody = new this({
        emailID,
        masterUserID,
        ...bodyData,
        performance: {
          ...bodyData.performance,
          saveTime: Date.now() - startTime
        },
        processingHistory: [{
          action: 'created',
          timestamp: new Date(),
          details: 'Initial body content saved',
          processingTime: Date.now() - startTime,
          success: true
        }]
      });
      
      return await newBody.save();
    }
  } catch (error) {
    console.error(`Error saving email body for ${emailID}:`, error);
    throw error;
  }
};

emailBodySchema.statics.getBodyByEmailID = async function(emailID, masterUserID) {
  try {
    const body = await this.findOne({ emailID, masterUserID });
    
    if (body && body.fetchStatus === 'completed') {
      // Return the processed body, fallback to HTML, then text
      return {
        success: true,
        body: body.processedBody || body.bodyHtml || body.bodyText || '',
        bodyHtml: body.bodyHtml,
        bodyText: body.bodyText,
        processedBody: body.processedBody,
        metadata: body.metadata,
        fetchStatus: body.fetchStatus
      };
    }
    
    return {
      success: false,
      body: '',
      fetchStatus: body ? body.fetchStatus : 'not_found',
      error: body ? null : 'Email body not found in MongoDB'
    };
  } catch (error) {
    console.error(`Error retrieving email body for ${emailID}:`, error);
    return {
      success: false,
      body: '',
      fetchStatus: 'error',
      error: error.message
    };
  }
};

emailBodySchema.statics.markAsFailed = async function(emailID, masterUserID, error) {
  try {
    await this.updateOne(
      { emailID, masterUserID },
      {
        $set: {
          fetchStatus: 'failed',
          'errorInfo.lastError': error,
          'errorInfo.lastErrorAt': new Date()
        },
        $inc: {
          'errorInfo.errorCount': 1
        },
        $push: {
          processingHistory: {
            action: 'failed',
            timestamp: new Date(),
            details: error,
            success: false
          }
        }
      },
      { upsert: true }
    );
  } catch (updateError) {
    console.error(`Error marking email body as failed for ${emailID}:`, updateError);
  }
};

emailBodySchema.statics.getPendingBodies = function(limit = 50) {
  return this.find({ fetchStatus: 'pending' })
    .sort({ createdAt: 1 })
    .limit(limit);
};

emailBodySchema.statics.getFailedBodies = function(limit = 50) {
  return this.find({ fetchStatus: 'failed' })
    .sort({ 'errorInfo.lastErrorAt': -1 })
    .limit(limit);
};

// Instance methods
emailBodySchema.methods.updateProcessingStatus = function(status, details = '') {
  this.fetchStatus = status;
  this.processingHistory.push({
    action: status,
    timestamp: new Date(),
    details: details,
    success: status === 'completed',
    processingTime: this.performance.totalProcessingTime || 0
  });
  
  return this.save();
};

emailBodySchema.methods.addProcessingMetrics = function(metrics) {
  this.performance = {
    ...this.performance,
    ...metrics,
    totalProcessingTime: (metrics.fetchTime || 0) + (metrics.cleanTime || 0) + (metrics.saveTime || 0)
  };
  
  return this;
};

// Virtual for body summary
emailBodySchema.virtual('summary').get(function() {
  const body = this.processedBody || this.bodyText || this.bodyHtml || '';
  return {
    hasContent: !!body,
    length: body.length,
    preview: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
    contentType: this.metadata?.contentType || 'unknown',
    lastUpdated: this.updatedAt
  };
});

// Pre-save middleware
emailBodySchema.pre('save', function(next) {
  // Update metadata if body content changed
  if (this.isModified('bodyHtml') || this.isModified('bodyText') || this.isModified('processedBody')) {
    const body = this.processedBody || this.bodyHtml || this.bodyText || '';
    
    this.metadata = {
      ...this.metadata,
      originalSize: (this.bodyHtml || '').length + (this.bodyText || '').length,
      processedSize: (this.processedBody || '').length,
      hasImages: body.includes('<img') || body.includes('data:image/'),
      hasCidReferences: body.includes('cid:'),
      contentType: this.bodyHtml ? 'html' : (this.bodyText ? 'text' : 'empty')
    };
  }
  
  next();
});

// Export the model
const EmailBody = mongoose.model('EmailBody', emailBodySchema);

module.exports = EmailBody;