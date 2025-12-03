const redis = require('redis');

/**
 * Redis Connection Configuration
 * Establishes connection to Redis for caching and session management
 */

let redisClient = null;

const connectRedis = async () => {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      // Add password if configured
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      // Connection options
      socket: {
        connectTimeout: 5000, // 5 second timeout
        reconnectStrategy: false // Disable automatic reconnection
      }
    };

    redisClient = redis.createClient(redisConfig);

    // Suppress error events to prevent spam
    redisClient.on('error', () => {
      // Silently ignore errors during connection attempt
    });

    // Connect to Redis with timeout
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);

    console.log('✅ Redis Connected Successfully');
    console.log(`📍 Redis: ${redisConfig.host}:${redisConfig.port}`);

    return redisClient;
  } catch (error) {
    // Clean up failed client
    if (redisClient) {
      try {
        await redisClient.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
      redisClient = null;
    }
    
    console.warn('⚠️ Redis unavailable - continuing without caching');
    return null;
  }
};

// Get the Redis client instance
const getRedisClient = () => {
  return redisClient;
};

// Close Redis connection gracefully
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('🔴 Redis connection closed');
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis
};
