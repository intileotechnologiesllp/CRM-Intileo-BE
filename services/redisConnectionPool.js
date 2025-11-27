// /**
//  * Redis-based IMAP Connection Pool Manager
//  * 
//  * Ensures only 1 active IMAP connection per Gmail user across multiple PM2 instances
//  * Uses Redis locks with TTL for distributed coordination
//  */

// const redis = require('redis');

// // Simple logging functions
// const logEmailInfo = (message) => console.log(`📧 ${message}`);
// const logEmailError = (message, error) => console.error(`❌ ${message}`, error || '');

// class RedisConnectionPool {
//   constructor() {
//     this.client = null;
//     this.isConnected = false;
//     this.connectionLockTTL = 300; // 5 minutes TTL for connection locks
//     this.retryInterval = 60000; // 1 minute retry for Redis connection
//   }

//   /**
//    * Initialize Redis connection with retry logic
//    */
//   async initialize() {
//     try {
//       // Redis connection configuration
//       const redisConfig = {
//         host: process.env.REDIS_HOST || 'redis-server',  // Use valid hostname
//         port: process.env.REDIS_PORT || 6379,
//         password: process.env.REDIS_PASSWORD || undefined,
//         db: process.env.REDIS_DB || 0,
//         retryDelayOnFailover: 100,
//         enableReadyCheck: true,
//         maxRetriesPerRequest: 3,
//         lazyConnect: true
//       };

//       this.client = redis.createClient(redisConfig);

//       // Handle Redis events
//       this.client.on('connect', () => {
//         logEmailInfo('[REDIS-POOL] Connected to Redis server');
//         this.isConnected = true;
//       });

//       this.client.on('error', (error) => {
//         logEmailError('[REDIS-POOL] Redis connection error:', error.message);
//         this.isConnected = false;
//         this.scheduleReconnect();
//       });

//       this.client.on('end', () => {
//         logEmailInfo('[REDIS-POOL] Redis connection ended');
//         this.isConnected = false;
//         this.scheduleReconnect();
//       });

//       // Connect to Redis
//       await this.client.connect();
//       return true;

//     } catch (error) {
//       logEmailError('[REDIS-POOL] Failed to initialize Redis:', error.message);
//       this.isConnected = false;
//       this.scheduleReconnect();
//       return false;
//     }
//   }

//   /**
//    * Schedule reconnection attempt
//    */
//   scheduleReconnect() {
//     setTimeout(() => {
//       if (!this.isConnected) {
//         logEmailInfo('[REDIS-POOL] Attempting Redis reconnection...');
//         this.initialize().catch(error => {
//           logEmailError('[REDIS-POOL] Reconnection failed:', error.message);
//         });
//       }
//     }, this.retryInterval);
//   }

//   /**
//    * Acquire exclusive IMAP connection lock for a user
//    * @param {string} email - User's email address
//    * @param {string} instanceId - PM2 instance identifier
//    * @returns {boolean} - True if lock acquired, false if already locked
//    */
//   async acquireConnectionLock(email, instanceId = process.env.pm_id || 'default') {
//     if (!this.isConnected || !this.client) {
//       logEmailError('[REDIS-POOL] Redis not connected, allowing connection (fallback)');
//       return true; // Fallback to allow connection if Redis unavailable
//     }

//     try {
//       const lockKey = `imap:active:${email}`;
//       const lockValue = `${instanceId}:${Date.now()}`;

//       // Try to acquire lock with TTL
//       const result = await this.client.setNX(lockKey, lockValue);
      
//       if (result) {
//         // Lock acquired, set TTL
//         await this.client.expire(lockKey, this.connectionLockTTL);
//         logEmailInfo(`[REDIS-POOL] 🔒 Acquired IMAP lock for ${email} on instance ${instanceId}`);
//         return true;
//       } else {
//         // Lock exists, check if it's our own instance
//         const existingLock = await this.client.get(lockKey);
//         if (existingLock && existingLock.startsWith(instanceId + ':')) {
//           // Same instance, refresh TTL
//           await this.client.expire(lockKey, this.connectionLockTTL);
//           logEmailInfo(`[REDIS-POOL] 🔄 Refreshed IMAP lock for ${email} on instance ${instanceId}`);
//           return true;
//         } else {
//           logEmailInfo(`[REDIS-POOL] 🚫 IMAP lock exists for ${email} (held by: ${existingLock})`);
//           return false;
//         }
//       }

//     } catch (error) {
//       logEmailError('[REDIS-POOL] Error acquiring connection lock:', error.message);
//       return true; // Fallback to allow connection if Redis error
//     }
//   }

//   /**
//    * Release IMAP connection lock for a user
//    * @param {string} email - User's email address
//    * @param {string} instanceId - PM2 instance identifier
//    */
//   async releaseConnectionLock(email, instanceId = process.env.pm_id || 'default') {
//     if (!this.isConnected || !this.client) {
//       return; // Nothing to release if Redis unavailable
//     }

//     try {
//       const lockKey = `imap:active:${email}`;
//       const existingLock = await this.client.get(lockKey);

//       if (existingLock && existingLock.startsWith(instanceId + ':')) {
//         await this.client.del(lockKey);
//         logEmailInfo(`[REDIS-POOL] 🔓 Released IMAP lock for ${email} on instance ${instanceId}`);
//       } else {
//         logEmailInfo(`[REDIS-POOL] 🤷 No matching lock to release for ${email} on instance ${instanceId}`);
//       }

//     } catch (error) {
//       logEmailError('[REDIS-POOL] Error releasing connection lock:', error.message);
//     }
//   }

//   /**
//    * Check if IMAP connection is allowed for a user
//    * @param {string} email - User's email address
//    * @returns {boolean} - True if connection allowed
//    */
//   async isConnectionAllowed(email) {
//     if (!this.isConnected || !this.client) {
//       return true; // Fallback to allow if Redis unavailable
//     }

//     try {
//       const lockKey = `imap:active:${email}`;
//       const lock = await this.client.get(lockKey);
      
//       if (!lock) {
//         return true; // No lock exists
//       }

//       const instanceId = process.env.pm_id || 'default';
//       return lock.startsWith(instanceId + ':'); // Allow if it's our lock

//     } catch (error) {
//       logEmailError('[REDIS-POOL] Error checking connection permission:', error.message);
//       return true; // Fallback to allow if Redis error
//     }
//   }

//   /**
//    * Get all active IMAP connections
//    * @returns {Array} - List of active connections
//    */
//   async getActiveConnections() {
//     if (!this.isConnected || !this.client) {
//       return [];
//     }

//     try {
//       const keys = await this.client.keys('imap:active:*');
//       const connections = [];

//       for (const key of keys) {
//         const email = key.replace('imap:active:', '');
//         const lockValue = await this.client.get(key);
//         const ttl = await this.client.ttl(key);
        
//         connections.push({
//           email,
//           instance: lockValue ? lockValue.split(':')[0] : 'unknown',
//           ttl
//         });
//       }

//       return connections;

//     } catch (error) {
//       logEmailError('[REDIS-POOL] Error getting active connections:', error.message);
//       return [];
//     }
//   }

//   /**
//    * Cleanup expired locks (maintenance function)
//    */
//   async cleanupExpiredLocks() {
//     if (!this.isConnected || !this.client) {
//       return;
//     }

//     try {
//       const keys = await this.client.keys('imap:active:*');
//       let cleaned = 0;

//       for (const key of keys) {
//         const ttl = await this.client.ttl(key);
//         if (ttl === -1) { // No expiry set
//           await this.client.expire(key, this.connectionLockTTL);
//         } else if (ttl <= 0) { // Expired
//           await this.client.del(key);
//           cleaned++;
//         }
//       }

//       if (cleaned > 0) {
//         logEmailInfo(`[REDIS-POOL] 🧹 Cleaned up ${cleaned} expired IMAP locks`);
//       }

//     } catch (error) {
//       logEmailError('[REDIS-POOL] Error during cleanup:', error.message);
//     }
//   }

//   /**
//    * Graceful shutdown
//    */
//   async shutdown() {
//     try {
//       if (this.client && this.isConnected) {
//         await this.client.quit();
//         logEmailInfo('[REDIS-POOL] Redis connection closed gracefully');
//       }
//     } catch (error) {
//       logEmailError('[REDIS-POOL] Error during shutdown:', error.message);
//     }
//   }
// }

// // Singleton instance
// const redisConnectionPool = new RedisConnectionPool();

// // Initialize on module load
// redisConnectionPool.initialize().catch(error => {
//   logEmailError('[REDIS-POOL] Initial connection failed:', error.message);
// });

// // Cleanup expired locks every 5 minutes
// setInterval(() => {
//   redisConnectionPool.cleanupExpiredLocks();
// }, 5 * 60 * 1000);

// // Graceful shutdown on process exit
// process.on('SIGINT', async () => {
//   await redisConnectionPool.shutdown();
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   await redisConnectionPool.shutdown();
//   process.exit(0);
// });

// module.exports = redisConnectionPool;