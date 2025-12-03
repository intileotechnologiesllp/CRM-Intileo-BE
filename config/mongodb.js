const mongoose = require('mongoose');

/**
 * MongoDB Connection Configuration
 * Establishes connection to MongoDB database for storing email bodies and other data
 */

const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipedrive_crm';
    
    // Disable buffering globally to prevent timeout errors when MongoDB is unavailable
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 5000); // Reduce buffer timeout to 5 seconds
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    });

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
    
    // Disable buffering to prevent timeout errors
    mongoose.set('bufferCommands', false);
    
    return false;
  }
};

// Helper function to check if MongoDB is connected
const isMongoDBConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Export the connection function
module.exports = {
  connectMongoDB,
  isMongoDBConnected,
  mongoose
};
