// 📧 IMAP IDLE MANAGER - Real-time Email Synchronization
// Handles bidirectional sync: CRM ↔ Gmail/Yandex with IMAP IDLE
const Imap = require('imap');
const { EventEmitter } = require('events');
const Email = require('../models/email/emailModel');
const UserCredential = require('../models/email/userCredentialModel');
const { Op } = require('sequelize');
const redisConnectionPool = require('./redisConnectionPool');

class ImapIdleManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // userID -> connection info
    this.reconnectDelays = new Map(); // userID -> current delay
    this.maxReconnectDelay = 300000; // 5 minutes max delay (recommended)
    this.initialReconnectDelay = 1000; // 1 second initial delay
    this.heartbeatInterval = 60000; // 1 minute heartbeat
    this.isInitialized = false;
    
    // 🚨 GMAIL CONNECTION LIMITS MANAGEMENT
    this.maxConnectionsPerAccount = 1; // Gmail allows ~15, but we'll be conservative
    this.connectionLimitBackoff = 60000; // 1 minute backoff for connection limit errors
    this.lastConnectionLimitError = new Map(); // userID -> timestamp
    
    // 🔄 AUTOMATIC RECONNECTION SCHEDULING
    this.reconnectTimers = new Map(); // userID -> timeout ID
    
    console.log('🚀 [IMAP-IDLE] Manager initialized with Gmail connection limits and auto-reconnect');
  }

  // Initialize the IDLE manager
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🔄 [IMAP-IDLE] Starting initialization...');
    
    try {
      // Start heartbeat to keep connections alive
      this.startHeartbeat();
      
      // 🔄 Start automatic reconnection scheduler
      this.startAutoReconnectScheduler();
      
      this.isInitialized = true;
      console.log('✅ [IMAP-IDLE] Manager ready for connections');
      
    } catch (error) {
      console.error('❌ [IMAP-IDLE] Initialization failed:', error.message);
      throw error;
    }
  }

  // Start IDLE monitoring for a user
  async startIdleForUser(userID) {
    try {
      console.log(`🔄 [IMAP-IDLE] Starting IDLE for user ${userID}...`);
      
      // Check if already connected - close old connection first (recommended)
      if (this.connections.has(userID)) {
        console.log(`⚠️ [IMAP-IDLE] User ${userID} already has IDLE connection, closing old connection...`);
        const oldConnection = this.connections.get(userID);
        try {
          if (oldConnection.imap) {
            oldConnection.imap.end();
          }
        } catch (cleanupError) {
          console.warn(`⚠️ [IMAP-IDLE] Error closing old connection for user ${userID}:`, cleanupError.message);
        }
        this.connections.delete(userID);
      }

      // Get user credentials
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: userID }
      });

      if (!userCredential) {
        throw new Error(`No credentials found for user ${userID}`);
      }

      // 🚨 CHECK CONNECTION LIMITS - Avoid Gmail "Too many connections" error
      if (!this.shouldAttemptConnection(userID, userCredential.email)) {
        throw new Error(`Connection limit backoff active for ${userCredential.email}. Waiting before retry.`);
      }

      // 🔒 CHECK REDIS CONNECTION POOL - Ensure only 1 IMAP connection per user across instances
      const connectionAllowed = await redisConnectionPool.acquireConnectionLock(userCredential.email);
      if (!connectionAllowed) {
        throw new Error(`Another PM2 instance already has active IMAP connection for ${userCredential.email}`);
      }

      // Validate credentials (recommended)
      if (!userCredential.email) {
        throw new Error(`No email configured for user ${userID}`);
      }
      if (!userCredential.appPassword) {
        throw new Error(`No app password configured for user ${userID}`);
      }

      // Determine IMAP settings based on provider
      let imapHost, imapPort;
      if (userCredential.provider === 'yandex' || userCredential.email.includes('intileo.com')) {
        imapHost = 'imap.yandex.com';
        imapPort = 993;
      } else {
        // Default to Gmail
        imapHost = 'imap.gmail.com';
        imapPort = 993;
      }

      console.log(`📧 [IMAP-IDLE] Connecting user ${userID} to ${userCredential.email} via ${userCredential.imapHost || imapHost} (provider: ${userCredential.provider || 'gmail'})`);

      // Create IMAP connection with provider-specific configuration
      const imapConfig = {
        user: userCredential.email,
        password: userCredential.appPassword, // Use app password
        host: userCredential.imapHost || imapHost,
        port: userCredential.imapPort || imapPort,
        tls: userCredential.imapTLS !== false,
        authTimeout: 60000, // 60 second auth timeout
        connTimeout: 60000, // 60 second connection timeout
        tlsOptions: {
          rejectUnauthorized: false,
          servername: userCredential.imapHost || imapHost,
          secureProtocol: 'TLSv1_2_method' // Force TLS v1.2
        },
        keepalive: {
          interval: 10000,
          idleInterval: 300000,
          forceNoop: true
        },
        debug: (msg) => {
          if (msg.includes('LOGIN') || msg.includes('AUTH') || msg.includes('OK') || msg.includes('BAD')) {
            console.log(`🔍 [IMAP-IDLE-DEBUG] User ${userID}: ${msg}`);
          }
        }
      };

      const imap = new Imap(imapConfig);

      // Store connection info
      this.connections.set(userID, {
        imap: imap,
        email: userCredential.email,
        isIdle: false,
        lastActivity: Date.now(),
        reconnectCount: 0,
        userID: userID
      });

      // Set up event handlers
      this.setupImapEventHandlers(userID, imap);

      // Connect to IMAP server
      await this.connectImap(userID, imap);

      console.log(`✅ [IMAP-IDLE] IDLE started for user ${userID} (${userCredential.email})`);
      
      return { 
        success: true, 
        message: 'IDLE monitoring started',
        email: userCredential.email 
      };

    } catch (error) {
      console.error(`❌ [IMAP-IDLE] Failed to start IDLE for user ${userID}:`, error.message);
      
      // Clean up on failure
      this.connections.delete(userID);
      
      throw error;
    }
  }

  // Setup IMAP event handlers
  setupImapEventHandlers(userID, imap) {
    const connectionInfo = this.connections.get(userID);

    // Ready event - server is ready
    imap.once('ready', async () => {
      console.log(`🔗 [IMAP-IDLE] Connected to server for user ${userID}`);
      
      try {
        // Open INBOX in read-write mode
        await this.openInbox(imap);
        
        // Start IDLE mode
        await this.startIdle(userID, imap);
        
      } catch (error) {
        console.error(`❌ [IMAP-IDLE] Failed to start IDLE for user ${userID}:`, error.message);
        this.handleDisconnect(userID, error);
      }
    });

    // Mail event - new email or flag change
    imap.on('mail', async (numNewMsgs) => {
      console.log(`📬 [IMAP-IDLE] New mail event for user ${userID}: ${numNewMsgs} messages`);
      
      try {
        // Process new/changed emails (IDLE simplified for testing)
        await this.processMailChanges(userID, imap);
        
      } catch (error) {
        console.error(`❌ [IMAP-IDLE] Mail processing failed for user ${userID}:`, error.message);
        this.handleDisconnect(userID, error);
      }
    });

    // Update event - email flags changed (read/unread status)
    imap.on('update', async (seqno, info) => {
      console.log(`🔄 [IMAP-IDLE] Flag update for user ${userID}, seq: ${seqno}`);
      
      try {
        // Process flag changes (IDLE simplified for testing)
        await this.processFlagChanges(userID, imap, seqno, info);
        
      } catch (error) {
        console.error(`❌ [IMAP-IDLE] Flag processing failed for user ${userID}:`, error.message);
        this.handleDisconnect(userID, error);
      }
    });

    // Error events
    imap.once('error', (error) => {
      console.error(`❌ [IMAP-IDLE] Connection error for user ${userID}:`, error.message);
      console.error(`❌ [IMAP-IDLE] Error details:`, {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
        stack: error.stack
      });
      this.handleDisconnect(userID, error);
    });

    // End event - connection closed
    imap.once('end', () => {
      console.log(`🔌 [IMAP-IDLE] Connection ended for user ${userID}`);
      this.handleDisconnect(userID, new Error('Connection ended'));
    });

    // Close event
    imap.once('close', (hadError) => {
      console.log(`🔌 [IMAP-IDLE] Connection closed for user ${userID}, hadError: ${hadError}`);
      if (hadError) {
        this.handleDisconnect(userID, new Error('Connection closed with error'));
      }
    });
  }

  // Connect to IMAP server
  async connectImap(userID, imap) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IMAP connection timeout after 60 seconds'));
      }, 60000); // 60 second timeout (increased for Gmail)

      imap.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      imap.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      imap.connect();
    });
  }

  // Open INBOX folder
  async openInbox(imap) {
    return new Promise((resolve, reject) => {
      imap.openBox('INBOX', false, (error, box) => {
        if (error) {
          reject(error);
        } else {
          console.log(`📂 [IMAP-IDLE] INBOX opened, ${box.messages.total} messages`);
          resolve(box);
        }
      });
    });
  }

  // Start IDLE mode - Simplified for basic connection testing
  async startIdle(userID, imap) {
    const connectionInfo = this.connections.get(userID);
    if (!connectionInfo) return;

    try {
      // Skip IDLE for now, just mark as ready
      connectionInfo.isIdle = true;
      connectionInfo.lastActivity = Date.now();
      console.log(`⏱️ [IMAP-IDLE] Connection ready for user ${userID} (IDLE disabled for testing)`);
      return Promise.resolve();
    } catch (error) {
      console.error(`❌ [IMAP-IDLE] IDLE setup failed for user ${userID}:`, error.message);
      return Promise.reject(error);
    }
  }

  // Stop IDLE mode - Simplified
  async stopIdle(userID, imap) {
    const connectionInfo = this.connections.get(userID);
    if (!connectionInfo || !connectionInfo.isIdle) return;

    try {
      connectionInfo.isIdle = false;
      connectionInfo.lastActivity = Date.now();
      console.log(`🛑 [IMAP-IDLE] IDLE stopped for user ${userID}`);
      return Promise.resolve();
    } catch (error) {
      console.error(`❌ [IMAP-IDLE] IDLE stop failed for user ${userID}:`, error.message);
      return Promise.reject(error);
    }
  }

  // Process new mail and flag changes
  async processMailChanges(userID, imap) {
    try {
      console.log(`🔍 [IMAP-IDLE] Processing mail changes for user ${userID}...`);
      
      // Get recent messages (last 10 for performance)
      const searchCriteria = ['RECENT'];
      
      imap.search(searchCriteria, (error, results) => {
        if (error) {
          console.error(`❌ [IMAP-IDLE] Search failed:`, error.message);
          return;
        }

        if (!results || results.length === 0) {
          console.log(`ℹ️ [IMAP-IDLE] No recent messages for user ${userID}`);
          return;
        }

        console.log(`📬 [IMAP-IDLE] Found ${results.length} recent messages for user ${userID}`);
        
        // Trigger email sync for this user (integrate with your existing sync)
        this.emit('newMail', { userID, messageCount: results.length, uids: results });
      });

    } catch (error) {
      console.error(`❌ [IMAP-IDLE] Mail processing error:`, error.message);
    }
  }

  // Process flag changes (read/unread status)
  async processFlagChanges(userID, imap, seqno, info) {
    try {
      console.log(`🔄 [IMAP-IDLE] Processing flag changes for user ${userID}...`);
      
      if (!info || !info.flags) return;

      // Check if this is a read/unread flag change
      const isRead = info.flags.includes('\\Seen');
      const uid = info.uid;
      
      if (uid) {
        console.log(`📧 [IMAP-IDLE] UID ${uid} flag changed: isRead=${isRead}`);
        
        // Update database to match server state
        await this.updateEmailReadStatus(userID, uid, isRead);
        
        // Emit event for real-time UI updates
        this.emit('flagChange', { userID, uid, isRead, seqno });
      }

    } catch (error) {
      console.error(`❌ [IMAP-IDLE] Flag processing error:`, error.message);
    }
  }

  // Update email read status in database
  async updateEmailReadStatus(userID, uid, isRead) {
    try {
      const [updatedCount] = await Email.update(
        { 
          isRead: isRead,
          updatedAt: new Date(),
          lastSyncAt: new Date(),
          syncReason: 'imap_idle_flag_change'
        },
        {
          where: {
            uid: uid,
            masterUserID: userID
          }
        }
      );

      if (updatedCount > 0) {
        console.log(`✅ [IMAP-IDLE] Updated UID ${uid} for user ${userID}: isRead=${isRead}`);
      } else {
        console.log(`⚠️ [IMAP-IDLE] Email UID ${uid} not found in database for user ${userID}`);
      }

    } catch (error) {
      console.error(`❌ [IMAP-IDLE] Database update failed:`, error.message);
    }
  }

  // Mark email as read/unread on server
  async markEmailOnServer(userID, uid, isRead) {
    try {
      const connectionInfo = this.connections.get(userID);
      if (!connectionInfo || !connectionInfo.imap) {
        throw new Error('No IMAP connection for user');
      }

      const imap = connectionInfo.imap;
      
      console.log(`📤 [IMAP-IDLE] Marking UID ${uid} as ${isRead ? 'read' : 'unread'} for user ${userID}...`);

      // IDLE stop disabled for testing - proceed directly to flag update

      // Update server flags
      return new Promise((resolve, reject) => {
        const flag = isRead ? '\\Seen' : '';
        const action = isRead ? 'addFlags' : 'delFlags';
        
        imap[action]([uid], flag, (error) => {
          if (error) {
            reject(error);
          } else {
            console.log(`✅ [IMAP-IDLE] Server flag updated for UID ${uid}`);
            resolve();
          }
        });
      }).finally(async () => {
        // IDLE restart disabled for testing
        console.log(`ℹ️ [IMAP-IDLE] Flag update completed for UID ${uid} (IDLE restart disabled)`);
      });

    } catch (error) {
      console.error(`❌ [IMAP-IDLE] Server flag update failed:`, error.message);
      throw error;
    }
  }

  // Stop IDLE for a user
  async stopIdleForUser(userID) {
    try {
      console.log(`🛑 [IMAP-IDLE] Stopping IDLE for user ${userID}...`);
      
      const connectionInfo = this.connections.get(userID);
      if (!connectionInfo) {
        console.log(`ℹ️ [IMAP-IDLE] No active connection for user ${userID}`);
        return { success: true, message: 'No active IDLE connection' };
      }

      // Stop IDLE and close connection
      if (connectionInfo.imap) {
        if (connectionInfo.isIdle) {
          await this.stopIdle(userID, connectionInfo.imap);
        }
        connectionInfo.imap.end();
      }

      // 🔓 RELEASE REDIS CONNECTION LOCK
      if (connectionInfo.email) {
        await redisConnectionPool.releaseConnectionLock(connectionInfo.email);
      }

      // Remove from connections and cleanup
      this.connections.delete(userID);
      this.reconnectDelays.delete(userID);
      
      // 🔄 CANCEL PENDING RECONNECT TIMERS
      if (this.reconnectTimers.has(userID)) {
        clearTimeout(this.reconnectTimers.get(userID));
        this.reconnectTimers.delete(userID);
      }

      console.log(`✅ [IMAP-IDLE] IDLE stopped for user ${userID}`);
      
      return { 
        success: true, 
        message: 'IDLE monitoring stopped' 
      };

    } catch (error) {
      console.error(`❌ [IMAP-IDLE] Failed to stop IDLE for user ${userID}:`, error.message);
      throw error;
    }
  }

  // Start heartbeat to keep connections alive
  startHeartbeat() {
    setInterval(() => {
      this.connections.forEach((connectionInfo, userID) => {
        const timeSinceLastActivity = Date.now() - connectionInfo.lastActivity;
        
        if (timeSinceLastActivity > this.heartbeatInterval) {
          console.log(`💓 [IMAP-IDLE] Heartbeat for user ${userID}`);
          
          // Send NOOP command to keep connection alive
          if (connectionInfo.imap && !connectionInfo.isIdle) {
            connectionInfo.imap.noop((error) => {
              if (error) {
                console.warn(`⚠️ [IMAP-IDLE] Heartbeat failed for user ${userID}:`, error.message);
                this.handleDisconnect(userID, error);
              } else {
                connectionInfo.lastActivity = Date.now();
              }
            });
          }
        }
      });
    }, this.heartbeatInterval);
  }

  // 🔄 Automatic reconnection scheduler - checks for users ready to reconnect
  startAutoReconnectScheduler() {
    setInterval(async () => {
      const now = Date.now();
      
      // Check for users with connection limit backoff that should retry
      for (const [userID, lastErrorTime] of this.lastConnectionLimitError.entries()) {
        const timeSinceError = now - lastErrorTime;
        
        if (timeSinceError >= this.connectionLimitBackoff) {
          // Check if user doesn't already have active connection
          if (!this.connections.has(userID)) {
            console.log(`🔄 [AUTO-RECONNECT] Attempting reconnect for user ${userID} after connection limit backoff`);
            
            try {
              await this.startIdleForUser(userID);
              this.lastConnectionLimitError.delete(userID); // Clear backoff on success
              console.log(`✅ [AUTO-RECONNECT] Successfully reconnected user ${userID}`);
            } catch (error) {
              if (this.isConnectionLimitError(error)) {
                // Still hitting connection limits - extend backoff
                this.lastConnectionLimitError.set(userID, now);
                console.log(`🚨 [AUTO-RECONNECT] Connection limit still active for user ${userID}, extending backoff`);
              } else {
                console.warn(`⚠️ [AUTO-RECONNECT] Failed to reconnect user ${userID}:`, error.message);
                // Don't remove from backoff map for non-connection-limit errors
              }
            }
          }
        }
      }
      
      // Get all users that should have active IMAP connections
      try {
        const allUsers = await this.getAllActiveUsers();
        
        for (const user of allUsers) {
          const userID = user.masterUserID;
          
          // Skip if user has active connection
          if (this.connections.has(userID)) {
            continue;
          }
          
          // Skip if user is in connection limit backoff
          const lastError = this.lastConnectionLimitError.get(userID);
          if (lastError && (now - lastError) < this.connectionLimitBackoff) {
            continue;
          }
          
          // Skip if user has a pending reconnect timer
          if (this.reconnectTimers.has(userID)) {
            continue;
          }
          
          console.log(`🔄 [AUTO-RECONNECT] Starting IMAP IDLE for disconnected user ${userID}`);
          
          try {
            await this.startIdleForUser(userID);
            console.log(`✅ [AUTO-RECONNECT] Started IDLE for user ${userID}`);
          } catch (error) {
            if (!this.isConnectionLimitError(error)) {
              console.warn(`⚠️ [AUTO-RECONNECT] Failed to start IDLE for user ${userID}:`, error.message);
            }
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ [AUTO-RECONNECT] Error getting active users:`, error.message);
      }
      
    }, 30000); // Check every 30 seconds
  }

  // Get all users that should have active IMAP connections
  async getAllActiveUsers() {
    try {
      const users = await UserCredential.findAll({
        where: {
          email: { [Op.not]: null },
          appPassword: { [Op.not]: null },
          imapHost: { [Op.not]: null }
        }
      });
      
      return users;
    } catch (error) {
      console.error('❌ [AUTO-RECONNECT] Error fetching active users:', error.message);
      return [];
    }
  }

  // 🔍 Get comprehensive connection status including Redis locks
  async getDetailedConnectionStatus() {
    const status = {
      localConnections: {},
      redisLocks: [],
      connectionLimitBackoffs: {},
      pendingReconnects: {},
      summary: {}
    };

    // Local connections
    for (const [userID, connectionInfo] of this.connections.entries()) {
      const isHealthy = connectionInfo.imap && 
                       connectionInfo.imap._sock && 
                       connectionInfo.imap._sock.readable &&
                       !connectionInfo.imap._sock.destroyed;

      status.localConnections[userID] = {
        email: connectionInfo.email,
        isIdle: connectionInfo.isIdle,
        healthy: isHealthy,
        lastActivity: new Date(connectionInfo.lastActivity).toISOString(),
        reconnectCount: connectionInfo.reconnectCount
      };
    }

    // Redis locks
    try {
      status.redisLocks = await redisConnectionPool.getActiveConnections();
    } catch (error) {
      status.redisLocks = [`Error getting Redis locks: ${error.message}`];
    }

    // Connection limit backoffs
    const now = Date.now();
    for (const [userID, timestamp] of this.lastConnectionLimitError.entries()) {
      const remainingBackoff = Math.max(0, this.connectionLimitBackoff - (now - timestamp));
      status.connectionLimitBackoffs[userID] = {
        backoffStarted: new Date(timestamp).toISOString(),
        remainingMs: remainingBackoff,
        remainingSeconds: Math.ceil(remainingBackoff / 1000)
      };
    }

    // Pending reconnects
    for (const [userID, timerId] of this.reconnectTimers.entries()) {
      status.pendingReconnects[userID] = 'Scheduled';
    }

    // Summary
    status.summary = {
      totalLocalConnections: Object.keys(status.localConnections).length,
      totalRedisLocks: Array.isArray(status.redisLocks) ? status.redisLocks.length : 0,
      usersInBackoff: Object.keys(status.connectionLimitBackoffs).length,
      pendingReconnects: Object.keys(status.pendingReconnects).length
    };

    return status;
  }

  // Get connection status
  getConnectionStatus(userID) {
    const connectionInfo = this.connections.get(userID);
    
    if (!connectionInfo) {
      return { 
        connected: false, 
        isConnected: false,
        message: 'No active connection' 
      };
    }

    // 🧠 ENHANCED CONNECTION HEALTH CHECK
    const isHealthy = connectionInfo.imap && 
                     connectionInfo.imap._sock && 
                     connectionInfo.imap._sock.readable &&
                     !connectionInfo.imap._sock.destroyed;

    return {
      connected: true,
      isConnected: isHealthy,
      isIdle: connectionInfo.isIdle,
      email: connectionInfo.email,
      lastActivity: new Date(connectionInfo.lastActivity).toISOString(),
      reconnectCount: connectionInfo.reconnectCount,
      healthy: isHealthy,
      socketReadable: connectionInfo.imap && connectionInfo.imap._sock ? connectionInfo.imap._sock.readable : false,
      socketDestroyed: connectionInfo.imap && connectionInfo.imap._sock ? connectionInfo.imap._sock.destroyed : true
    };
  }

  // Get all active connections
  getAllConnections() {
    const connections = {};
    
    this.connections.forEach((connectionInfo, userID) => {
      connections[userID] = this.getConnectionStatus(userID);
    });
    
    return connections;
  }

  // 🧠 VALIDATE CONNECTION USING NOOP (from your suggestion)
  async validateConnection(userID) {
    const connectionInfo = this.connections.get(userID);
    
    if (!connectionInfo || !connectionInfo.imap) {
      return { valid: false, reason: 'No connection found' };
    }

    try {
      // Use NOOP to test if connection is alive (same as your logs show)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ valid: false, reason: 'NOOP timeout' });
        }, 5000);

        connectionInfo.imap.once('error', () => {
          clearTimeout(timeout);
          resolve({ valid: false, reason: 'Connection error' });
        });

        // Check if noop function exists before calling it
        if (typeof connectionInfo.imap.noop === 'function') {
          // Send NOOP and wait for OK response (like in your logs)
          connectionInfo.imap.noop((error) => {
            clearTimeout(timeout);
            if (error) {
              resolve({ valid: false, reason: 'NOOP failed', error: error.message });
            } else {
              resolve({ valid: true, reason: 'NOOP OK Success' }); // 🎯 Using your pattern!
            }
          });
        } else {
          // If noop is not available, check connection state directly
          clearTimeout(timeout);
          if (connectionInfo.imap.state === 'authenticated' || connectionInfo.imap.state === 'selected') {
            resolve({ valid: true, reason: 'Connection state OK' });
          } else {
            resolve({ valid: false, reason: 'Connection state invalid: ' + connectionInfo.imap.state });
          }
        }
      });
    } catch (error) {
      return { valid: false, reason: 'Validation error', error: error.message };
    }
  }

  // 🚨 GMAIL CONNECTION LIMITS MANAGEMENT

  // Check if we should attempt connection (avoid "Too many connections" errors)
  shouldAttemptConnection(userID, email) {
    const lastError = this.lastConnectionLimitError.get(userID);
    
    if (!lastError) {
      return true; // No previous connection limit error
    }
    
    const timeSinceError = Date.now() - lastError;
    const shouldRetry = timeSinceError > this.connectionLimitBackoff;
    
    if (!shouldRetry) {
      console.log(`🚨 [IMAP-IDLE] Connection backoff active for ${email}. ${Math.round((this.connectionLimitBackoff - timeSinceError) / 1000)}s remaining`);
    }
    
    return shouldRetry;
  }

  // Record connection limit error for backoff
  recordConnectionLimitError(userID, email, error) {
    this.lastConnectionLimitError.set(userID, Date.now());
    console.log(`🚨 [IMAP-IDLE] Connection limit error recorded for ${email}. Backoff for ${this.connectionLimitBackoff/1000}s`);
    
    // Clear any existing reconnect attempts
    this.reconnectDelays.delete(userID);
  }

  // Enhanced error handling with connection limit detection
  isConnectionLimitError(error) {
    const errorMessage = error.message ? error.message.toLowerCase() : '';
    return errorMessage.includes('too many') && 
           errorMessage.includes('connection') ||
           errorMessage.includes('simultaneous');
  }

  // Enhanced disconnect handler with connection limit management
  handleDisconnect(userID, error) {
    const connectionInfo = this.connections.get(userID);
    if (!connectionInfo) return;

    console.log(`🔌 [IMAP-IDLE] Handling disconnect for user ${userID}:`, error.message);

    // � RELEASE REDIS CONNECTION LOCK
    if (connectionInfo.email) {
      redisConnectionPool.releaseConnectionLock(connectionInfo.email).catch(lockError => {
        console.warn(`⚠️ [IMAP-IDLE] Error releasing Redis lock for ${connectionInfo.email}:`, lockError.message);
      });
    }

    // �🚨 SPECIAL HANDLING FOR CONNECTION LIMIT ERRORS
    if (this.isConnectionLimitError(error)) {
      this.recordConnectionLimitError(userID, connectionInfo.email, error);
      console.log(`🚨 [IMAP-IDLE] Gmail connection limit reached for ${connectionInfo.email}. Stopping aggressive reconnection.`);
      
      // Clean up connection immediately for connection limit errors
      this.connections.delete(userID);
      return; // Don't attempt reconnection for connection limit errors
    }

    // Normal disconnect handling for other errors
    this.connections.delete(userID);
    
    // Only attempt reconnection for non-connection-limit errors
    const currentDelay = this.reconnectDelays.get(userID) || this.initialReconnectDelay;
    const nextDelay = Math.min(currentDelay * 2, this.maxReconnectDelay);
    
    this.reconnectDelays.set(userID, nextDelay);
    
    console.log(`🔄 [IMAP-IDLE] Scheduling reconnect for user ${userID} in ${currentDelay}ms (next: ${nextDelay}ms)...`);
    
    // 🕐 SCHEDULE AUTOMATIC RECONNECTION
    const timerId = setTimeout(async () => {
      this.reconnectTimers.delete(userID); // Clear timer tracking
      
      try {
        await this.startIdleForUser(userID);
        this.reconnectDelays.delete(userID); // Reset on successful reconnection
        console.log(`✅ [AUTO-RECONNECT] Successfully reconnected user ${userID} after disconnect`);
      } catch (reconnectError) {
        console.error(`❌ [AUTO-RECONNECT] Reconnection failed for user ${userID}:`, reconnectError.message);
        // Auto-reconnect scheduler will handle further attempts
      }
    }, currentDelay);
    
    // Track the timer so we can prevent duplicate attempts
    this.reconnectTimers.set(userID, timerId);
  }

  // Shutdown all connections
  async shutdown() {
    console.log('🛑 [IMAP-IDLE] Shutting down all connections...');
    
    const shutdownPromises = Array.from(this.connections.keys()).map(userID => 
      this.stopIdleForUser(userID).catch(error => 
        console.error(`❌ [IMAP-IDLE] Shutdown error for user ${userID}:`, error.message)
      )
    );
    
    await Promise.allSettled(shutdownPromises);
    
    console.log('✅ [IMAP-IDLE] All connections shut down');
  }
}

// Export singleton instance
const imapIdleManager = new ImapIdleManager();

module.exports = imapIdleManager;