const { getRedisClient, isRedisConnected } = require('../config/redis');

/**
 * Redis Service Layer for PipedriveCRM
 * 
 * Provides high-level Redis operations with:
 * - Intelligent caching strategies
 * - Automatic fallback handling
 * - Key naming conventions
 * - TTL management
 * - Error handling
 * - Performance monitoring
 */

class RedisService {
  constructor() {
    this.keyPrefix = 'crm:1.0';
    this.defaultTTL = 3600; // 1 hour default
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      operations: 0
    };
  }

  // =================== KEY MANAGEMENT ===================

  /**
   * Generate standardized Redis key
   * Format: crm:1.0:category:subcategory:identifier
   */
  generateKey(category, subcategory, identifier, metadata = null) {
    let key = `${this.keyPrefix}:${category}:${subcategory}:${identifier}`;
    if (metadata) {
      key += `:${metadata}`;
    }
    return key;
  }

  /**
   * Get Redis client with fallback handling
   */
  getClient() {
    const client = getRedisClient();
    if (!client) {
      console.warn('⚠️ [REDIS SERVICE] Redis not available, operations will fallback to database');
    }
    return client;
  }

  // =================== CORE OPERATIONS ===================

  /**
   * Set value with TTL
   */
  async set(key, value, ttl = this.defaultTTL) {
    const client = this.getClient();
    if (!client) return false;

    try {
      this.stats.operations++;
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await client.setex(key, ttl, serializedValue);
      } else {
        await client.set(key, serializedValue);
      }
      
      console.log(`✅ [REDIS] SET ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ [REDIS] SET failed for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get value with automatic deserialization
   */
  async get(key) {
    const client = this.getClient();
    if (!client) return null;

    try {
      this.stats.operations++;
      const value = await client.get(key);
      
      if (value === null) {
        this.stats.misses++;
        console.log(`❌ [REDIS] MISS ${key}`);
        return null;
      }
      
      this.stats.hits++;
      console.log(`✅ [REDIS] HIT ${key}`);
      return JSON.parse(value);
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ [REDIS] GET failed for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete key
   */
  async del(key) {
    const client = this.getClient();
    if (!client) return false;

    try {
      this.stats.operations++;
      const result = await client.del(key);
      console.log(`🗑️ [REDIS] DEL ${key} (${result} keys removed)`);
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ [REDIS] DEL failed for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ [REDIS] EXISTS failed for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Set TTL on existing key
   */
  async expire(key, ttl) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`❌ [REDIS] EXPIRE failed for ${key}:`, error.message);
      return false;
    }
  }

  // =================== USER CREDENTIAL CACHING ===================

  /**
   * Cache user credentials
   */
  async cacheUserCredential(masterUserID, credential, ttl = 900) { // 15 minutes
    const key = this.generateKey('user', 'credentials', masterUserID);
    
    // Clean sensitive data before caching
    const cacheData = {
      masterUserID: credential.masterUserID,
      email: credential.email,
      provider: credential.provider,
      isTrackOpenEmail: credential.isTrackOpenEmail,
      isTrackClickEmail: credential.isTrackClickEmail,
      smartBcc: credential.smartBcc,
      signature: credential.signature,
      signatureName: credential.signatureName,
      signatureImage: credential.signatureImage,
      syncStartDate: credential.syncStartDate,
      syncFolders: credential.syncFolders,
      syncAllFolders: credential.syncAllFolders,
      // Note: appPassword excluded for security
      cachedAt: new Date().toISOString()
    };

    return await this.set(key, cacheData, ttl);
  }

  /**
   * Get cached user credentials
   */
  async getUserCredential(masterUserID) {
    const key = this.generateKey('user', 'credentials', masterUserID);
    return await this.get(key);
  }

  /**
   * Invalidate user credentials cache
   */
  async invalidateUserCredential(masterUserID) {
    const key = this.generateKey('user', 'credentials', masterUserID);
    return await this.del(key);
  }

  // =================== EMAIL BODY CACHING ===================

  /**
   * Cache processed email body
   */
  async cacheEmailBody(emailID, bodyData, ttl = 3600) { // 1 hour
    const key = this.generateKey('email', 'body', emailID, 'processed');
    
    const cacheData = {
      emailID,
      body: bodyData.body || bodyData.processedBody,
      bodyHtml: bodyData.bodyHtml,
      bodyText: bodyData.bodyText,
      fetchStatus: bodyData.fetchStatus || 'completed',
      metadata: bodyData.metadata || {},
      cachedAt: new Date().toISOString()
    };

    return await this.set(key, cacheData, ttl);
  }

  /**
   * Get cached email body
   */
  async getEmailBody(emailID) {
    const key = this.generateKey('email', 'body', emailID, 'processed');
    return await this.get(key);
  }

  /**
   * Invalidate email body cache
   */
  async invalidateEmailBody(emailID) {
    const key = this.generateKey('email', 'body', emailID, 'processed');
    return await this.del(key);
  }

  // =================== PROGRAM CACHING ===================

  /**
   * Cache all programs
   */
  async cachePrograms(programs, ttl = 86400) { // 24 hours
    const key = this.generateKey('cache', 'programs', 'all');
    
    const programMap = {};
    programs.forEach(program => {
      programMap[program.program_desc] = program.programId;
    });

    return await this.set(key, {
      programs: programMap,
      count: programs.length,
      cachedAt: new Date().toISOString()
    }, ttl);
  }

  /**
   * Get cached programs
   */
  async getPrograms() {
    const key = this.generateKey('cache', 'programs', 'all');
    return await this.get(key);
  }

  /**
   * Get specific program ID by description
   */
  async getProgramId(description) {
    const programData = await this.getPrograms();
    if (!programData) return null;
    
    return programData.programs[description] || null;
  }

  // =================== SESSION MANAGEMENT ===================

  /**
   * Set user session
   */
  async setUserSession(userID, sessionData, ttl = 1800) { // 30 minutes
    const key = this.generateKey('session', 'active', 'user', userID);
    
    const session = {
      userID,
      loginTime: sessionData.loginTime || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      email: sessionData.email,
      role: sessionData.role
    };

    return await this.set(key, session, ttl);
  }

  /**
   * Get user session
   */
  async getUserSession(userID) {
    const key = this.generateKey('session', 'active', 'user', userID);
    return await this.get(key);
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(userID, ttl = 1800) {
    const session = await this.getUserSession(userID);
    if (!session) return false;

    session.lastActivity = new Date().toISOString();
    return await this.setUserSession(userID, session, ttl);
  }

  /**
   * Delete user session
   */
  async deleteUserSession(userID) {
    const key = this.generateKey('session', 'active', 'user', userID);
    return await this.del(key);
  }

  // =================== RATE LIMITING ===================

  /**
   * Check and increment rate limit
   */
  async checkRateLimit(identifier, maxRequests, windowSeconds, action = 'api') {
    const client = this.getClient();
    if (!client) return true; // Allow if Redis unavailable

    const key = this.generateKey('rate', action, identifier);
    
    try {
      const current = await client.incr(key);
      
      if (current === 1) {
        await client.expire(key, windowSeconds);
      }
      
      const allowed = current <= maxRequests;
      
      if (!allowed) {
        console.warn(`🚫 [REDIS] Rate limit exceeded for ${identifier}: ${current}/${maxRequests} in ${windowSeconds}s`);
      }
      
      return allowed;
    } catch (error) {
      console.error(`❌ [REDIS] Rate limit check failed for ${identifier}:`, error.message);
      return true; // Allow on error
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(identifier, action = 'api') {
    const client = this.getClient();
    if (!client) return null;

    const key = this.generateKey('rate', action, identifier);
    
    try {
      const [current, ttl] = await Promise.all([
        client.get(key),
        client.ttl(key)
      ]);

      return {
        current: parseInt(current) || 0,
        resetIn: ttl > 0 ? ttl : 0
      };
    } catch (error) {
      console.error(`❌ [REDIS] Rate limit status failed for ${identifier}:`, error.message);
      return null;
    }
  }

  // =================== ANALYTICS & MONITORING ===================

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.operations > 0 
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      isConnected: isRedisConnected()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      operations: 0
    };
  }

  /**
   * Flush all cache data (dangerous!)
   */
  async flushAll() {
    const client = this.getClient();
    if (!client) return false;

    try {
      await client.flushdb();
      console.log('🧹 [REDIS] All cache data flushed');
      return true;
    } catch (error) {
      console.error('❌ [REDIS] Flush failed:', error.message);
      return false;
    }
  }

  // =================== BULK OPERATIONS ===================

  /**
   * Set multiple keys at once
   */
  async mset(keyValuePairs) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const args = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        args.push(key, JSON.stringify(value));
      }
      
      await client.mset(...args);
      console.log(`✅ [REDIS] MSET ${Object.keys(keyValuePairs).length} keys`);
      return true;
    } catch (error) {
      console.error('❌ [REDIS] MSET failed:', error.message);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget(keys) {
    const client = this.getClient();
    if (!client) return {};

    try {
      const values = await client.mget(...keys);
      const result = {};
      
      keys.forEach((key, index) => {
        if (values[index] !== null) {
          try {
            result[key] = JSON.parse(values[index]);
          } catch (parseError) {
            console.error(`❌ [REDIS] Parse error for key ${key}:`, parseError.message);
            result[key] = null;
          }
        } else {
          result[key] = null;
        }
      });
      
      return result;
    } catch (error) {
      console.error('❌ [REDIS] MGET failed:', error.message);
      return {};
    }
  }
}

// Export singleton instance
module.exports = new RedisService();