const mongoose = require('mongoose');

/**
 * MongoDB Models Index File
 * 
 * This file serves as a central export point for all MongoDB models
 * Import your MongoDB models here and export them for use across the application
 * 
 * Example usage:
 * const { Analytics, EmailActivityLog } = require('./models/mongodb');
 */

// Import MongoDB models
const Analytics = require('./analyticsModel');
const EmailActivityLog = require('./emailActivityLogModel');
const EmailBody = require('./emailBodyModel');

// Example model imports (uncomment when you create these models):
// const MongoLead = require('./leadModel');
// const MongoActivity = require('./activityModel');

// Export all models
module.exports = {
  // Analytics and logging models
  Analytics,
  EmailActivityLog,
  EmailBody,
  
  // Add your additional MongoDB models here
  // MongoLead,
  // MongoActivity,
};

// Helper function to check MongoDB connection status
const checkMongoConnection = () => {
  return mongoose.connection.readyState === 1;
};

// Export helper functions
module.exports.checkMongoConnection = checkMongoConnection;