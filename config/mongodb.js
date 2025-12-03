const mongoose = require('mongoose');

/**
 * MongoDB Connection Configuration
 * Establishes connection to MongoDB database for storing email bodies and other data
 */

const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipedrive_crm';
    
    await mongoose.connect(mongoURI);

    console.log('✅ MongoDB Connected Successfully');
    console.log(`📍 MongoDB URI: ${mongoURI}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    return true; // Return true on successful connection

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.warn('⚠️ Continuing without MongoDB - email body storage will be disabled');
    // Don't throw - allow app to continue without MongoDB
    return false;
  }
};

// Export the connection function
module.exports = {
  connectMongoDB,
  mongoose
};
