const Imap = require("imap-simple");

/**
 * IMAP Connection Pool for handling multiple users efficiently
 * Reduces connection overhead and manages concurrent IMAP sessions
 */
class ImapConnectionPool {
  constructor() {
    this.pools = new Map(); // userID -> connection pool
    this.activeConnections = new Map(); // userID -> active connection count
    this.maxConnectionsPerUser = 2; // Maximum connections per user
    this.connectionTimeout = 30000; // 30 seconds timeout
    this.maxIdleTime = 300000; // 5 minutes before closing idle connections
    
    console.log('🔗 [IMAP POOL] Connection pool initialized');
  }

  /**
   * Get or create a connection pool for a user
   */
  async getConnection(userCredential) {
    const userKey = this.getUserKey(userCredential);
    
    // Check if user already has active connections
    const activeCount = this.activeConnections.get(userKey) || 0;
    if (activeCount >= this.maxConnectionsPerUser) {
      console.log(`⚠️ [IMAP POOL] User ${userKey} has reached max connections (${activeCount})`);
      throw new Error(`Maximum IMAP connections reached for user. Please wait and try again.`);
    }

    try {
      const connection = await this.createConnection(userCredential);
      this.incrementActiveConnections(userKey);
      
      console.log(`🔗 [IMAP POOL] Created connection for user ${userKey} (Active: ${this.activeConnections.get(userKey)})`);
      return connection;
    } catch (error) {
      console.error(`❌ [IMAP POOL] Failed to create connection for user ${userKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(userCredential, connection) {
    const userKey = this.getUserKey(userCredential);
    
    try {
      if (connection && connection.imap && connection.imap.state !== 'disconnected') {
        await connection.end();
      }
    } catch (error) {
      console.error(`⚠️ [IMAP POOL] Error closing connection for user ${userKey}:`, error.message);
    } finally {
      this.decrementActiveConnections(userKey);
      console.log(`🔌 [IMAP POOL] Released connection for user ${userKey} (Active: ${this.activeConnections.get(userKey) || 0})`);
    }
  }

  /**
   * Create a new IMAP connection
   */
  async createConnection(userCredential) {
    const imapSettings = this.getImapSettings(userCredential);
    
    const imapConfig = {
      imap: {
        user: userCredential.email,
        password: userCredential.appPassword,
        host: imapSettings.host,
        port: imapSettings.port,
        tls: imapSettings.tls,
        authTimeout: this.connectionTimeout,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true,
        // Add connection pooling specific settings
        connTimeout: this.connectionTimeout,
        authTimeout: this.connectionTimeout,
      }
    };

    const connection = await Imap.connect(imapConfig);
    
    // Add error handler
    connection.on('error', (err) => {
      console.error(`❌ [IMAP POOL] Connection error for user ${this.getUserKey(userCredential)}:`, err.message);
    });

    return connection;
  }

  /**
   * Get IMAP settings based on provider
   */
  getImapSettings(userCredential) {
    const PROVIDER_CONFIG = {
      gmail: { host: "imap.gmail.com", port: 993, tls: true },
      yandex: { host: "imap.yandex.com", port: 993, tls: true },
      outlook: { host: "outlook.office365.com", port: 993, tls: true },
      yahoo: { host: "imap.mail.yahoo.com", port: 993, tls: true },
    };

    const provider = userCredential.provider || 'gmail';
    
    if (provider === 'custom') {
      return {
        host: userCredential.imapHost,
        port: userCredential.imapPort,
        tls: userCredential.imapTLS
      };
    }

    return PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.gmail;
  }

  /**
   * Generate a unique key for the user
   */
  getUserKey(userCredential) {
    return `${userCredential.email}_${userCredential.provider || 'gmail'}`;
  }

  /**
   * Increment active connection count
   */
  incrementActiveConnections(userKey) {
    const current = this.activeConnections.get(userKey) || 0;
    this.activeConnections.set(userKey, current + 1);
  }

  /**
   * Decrement active connection count
   */
  decrementActiveConnections(userKey) {
    const current = this.activeConnections.get(userKey) || 0;
    const newCount = Math.max(0, current - 1);
    if (newCount === 0) {
      this.activeConnections.delete(userKey);
    } else {
      this.activeConnections.set(userKey, newCount);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalActiveConnections: Array.from(this.activeConnections.values()).reduce((sum, count) => sum + count, 0),
      activeUsers: this.activeConnections.size,
      userConnections: Object.fromEntries(this.activeConnections)
    };
  }

  /**
   * Clean up idle connections (call this periodically)
   */
  cleanup() {
    const stats = this.getStats();
    console.log(`🧹 [IMAP POOL] Cleanup - Active connections: ${stats.totalActiveConnections}, Active users: ${stats.activeUsers}`);
  }
}

// Create singleton instance
const imapPool = new ImapConnectionPool();

// Cleanup task every 5 minutes
setInterval(() => {
  imapPool.cleanup();
}, 300000);

module.exports = imapPool;