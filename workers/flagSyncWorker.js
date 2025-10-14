const amqp = require('amqplib');
const pLimit = require('p-limit');
const Imap = require('imap-simple');
const UserCredential = require('../models/email/userCredentialModel');
const Email = require('../models/email/emailModel');

// 🚀 PRODUCTION ARCHITECTURE: Flag Sync Worker
// Dedicated worker process for background IMAP flag synchronization

class FlagSyncWorker {
  constructor(options = {}) {
    this.connection = null;
    this.channel = null;
    this.isRunning = false;
    this.processedJobs = 0;
    this.failedJobs = 0;
    
    // Worker configuration
    this.concurrency = options.concurrency || 2; // Max 2 concurrent IMAP connections per worker
    this.prefetch = options.prefetch || 5; // Prefetch 5 messages at a time
    this.workerName = options.workerName || `flag-sync-worker-${process.pid}`;
    
    // Concurrency limiter for IMAP operations
    this.imapLimit = pLimit(this.concurrency);
    
    // Active IMAP connections tracking
    this.activeConnections = new Map();
    
    console.log(`🏭 [${this.workerName}] Initialized with concurrency: ${this.concurrency}`);
  }

  // Start the worker
  async start() {
    try {
      console.log(`🚀 [${this.workerName}] Starting flag sync worker...`);
      
      // Connect to RabbitMQ
      this.connection = await amqp.connect('amqp://localhost');
      this.channel = await this.connection.createChannel();
      
      // Set prefetch count for this worker
      await this.channel.prefetch(this.prefetch);
      
      // Ensure queue exists with minimal settings to avoid conflicts
      await this.channel.assertQueue('SYNC_FLAGS_QUEUE', {
        durable: true
      });
      
      this.isRunning = true;
      
      // Start consuming messages
      await this.channel.consume('SYNC_FLAGS_QUEUE', async (message) => {
        if (message) {
          await this.processJob(message);
        }
      }, {
        noAck: false // Manual acknowledgment for reliability
      });
      
      console.log(`✅ [${this.workerName}] Worker started and listening for flag sync jobs`);
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error(`❌ [${this.workerName}] Failed to start worker:`, error.message);
      throw error;
    }
  }

  // Process individual flag sync job
  async processJob(message) {
    let job;
    const jobStartTime = Date.now();
    
    try {
      job = JSON.parse(message.content.toString());
      console.log(`🔄 [${this.workerName}] Processing flag sync for user ${job.userID} (Job: ${job.jobId})`);
      
      // 🛡️ JOB-LEVEL TIMEOUT PROTECTION: Prevent jobs from running indefinitely
      const JOB_TIMEOUT = 120000; // 2 minutes max per job
      
      const jobWithTimeout = async () => {
        return this.imapLimit(async () => {
          await this.syncUserFlags(job);
        });
      };
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Job timeout after ${JOB_TIMEOUT/1000}s`)), JOB_TIMEOUT)
      );
      
      // Race between job completion and timeout
      await Promise.race([jobWithTimeout(), timeoutPromise]);
      
      // Acknowledge successful processing
      this.channel.ack(message);
      this.processedJobs++;
      
      const jobDuration = ((Date.now() - jobStartTime) / 1000).toFixed(1);
      console.log(`✅ [${this.workerName}] Completed flag sync for user ${job.userID} in ${jobDuration}s (Total processed: ${this.processedJobs})`);
      
    } catch (error) {
      const jobDuration = ((Date.now() - jobStartTime) / 1000).toFixed(1);
      console.error(`❌ [${this.workerName}] Failed to process job after ${jobDuration}s:`, error.message);
      
      // Check if it's a timeout error
      if (error.message.includes('timeout')) {
        console.log(`⏰ [${this.workerName}] JOB TIMEOUT DETECTED - job exceeded ${jobDuration}s limit`);
        console.log(`🔄 [${this.workerName}] This job will be retried with shorter operations`);
      }
      
      try {
        // Handle retry logic
        if (job && job.retryCount < job.maxRetries) {
          await this.retryJob(job, message);
        } else {
          // Max retries exceeded, reject message
          this.channel.nack(message, false, false);
          this.failedJobs++;
          console.error(`💀 [${this.workerName}] Job failed permanently for user ${job?.userID}`);
        }
      } catch (retryError) {
        console.error(`❌ [${this.workerName}] Retry handling failed:`, retryError.message);
        this.channel.nack(message, false, false);
        this.failedJobs++;
      }
    }
  }

  // Sync flags for a specific user
  async syncUserFlags(job) {
    const { userID, emailUIDs } = job;
    let connection = null;
    
    try {
      console.log(`🔌 [${this.workerName}] Connecting to IMAP for user ${userID}...`);
      
      // 🏥 HEALTH CHECK: Track failed attempts per user
      if (!this.userHealthCheck) {
        this.userHealthCheck = new Map();
      }
      
      const userHealth = this.userHealthCheck.get(userID) || { 
        consecutiveFailures: 0, 
        lastSuccess: Date.now(),
        skipUntil: null 
      };
      
      // Skip users with too many consecutive failures (temporary cooldown)
      if (userHealth.skipUntil && Date.now() < userHealth.skipUntil) {
        const remainingCooldown = Math.ceil((userHealth.skipUntil - Date.now()) / 1000);
        console.log(`❄️ [${this.workerName}] User ${userID} in cooldown for ${remainingCooldown}s due to connection issues`);
        return; // Skip this user for now
      }
      
      // 🚨 EARLY VALIDATION: Check if user has emails before IMAP connection
      const emailCount = await Email.count({
        where: {
          masterUserID: userID,
          uid: { [require('sequelize').Op.not]: null }
        }
      });
      
      if (emailCount === 0) {
        console.log(`⏭️ [${this.workerName}] User ${userID} has no emails with UIDs - skipping flag sync`);
        return;
      }
      
      console.log(`📊 [${this.workerName}] User ${userID} has ${emailCount} emails with UIDs - proceeding with sync`);
      
      // Get user credentials
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: userID },
        attributes: ['email', 'appPassword', 'provider', 'imapHost', 'imapPort', 'imapTLS']
      });
      
      if (!userCredential) {
        throw new Error(`No credentials found for user ${userID}`);
      }
      
      // Get IMAP configuration
      const imapConfig = this.getImapConfig(userCredential);
      
      // Connect to IMAP with timeout
      const connectPromise = Imap.connect(imapConfig);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('IMAP connection timeout')), 15000)
      );
      
      connection = await Promise.race([connectPromise, timeoutPromise]);
      this.activeConnections.set(userID, connection);
      
      // Get emails from database that need flag sync
      const emailsToSync = await Email.findAll({
        where: {
          masterUserID: userID,
          uid: { [require('sequelize').Op.not]: null }
        },
        attributes: ['emailID', 'uid', 'isRead', 'folder'],
        limit: 1000 // Process in batches of 1000
      });
      
      console.log(`📧 [${this.workerName}] Found ${emailsToSync.length} emails to sync for user ${userID}`);
      
      if (emailsToSync.length === 0) {
        console.log(`ℹ️ [${this.workerName}] No emails to sync for user ${userID}`);
        return;
      }
      
      // Group emails by folder for efficient processing
      const emailsByFolder = this.groupEmailsByFolder(emailsToSync);
      
      let totalUpdated = 0;
      
      // Process each folder
      for (const [folder, folderEmails] of Object.entries(emailsByFolder)) {
        try {
          console.log(`📁 [${this.workerName}] Syncing ${folderEmails.length} emails in folder: ${folder}`);
          
          await connection.openBox(folder);
          
          // Create UID list for IMAP fetch
          const uids = folderEmails.map(email => email.uid).filter(uid => uid);
          
          if (uids.length === 0) continue;
          
          console.log(`🔍 [${this.workerName}] Fetching IMAP flags for UIDs: ${uids.slice(0, 5).join(',')}${uids.length > 5 ? '...' : ''} (${uids.length} total)`);
          
          // 🛡️ PROVIDER-SPECIFIC TIMEOUT PROTECTION
          const isYandex = userCredential.email.includes('yandex') || userCredential.email.includes('intileo') || userCredential.provider === 'yandex';
          
          const IMAP_SEARCH_TIMEOUT = isYandex ? 8000 : 15000; // Shorter timeout for Yandex
          const QUICK_SEARCH_TIMEOUT = isYandex ? 3000 : 5000; // Much faster for Yandex
          
          // 🔧 YANDEX-OPTIMIZED BATCH PROCESSING: Smaller batches for restrictive servers
          const MAX_UID_BATCH_SIZE = isYandex ? 3 : 10; // Much smaller batches for Yandex
          
          if (isYandex) {
            console.log(`🟡 [${this.workerName}] YANDEX MODE: Using conservative settings (${MAX_UID_BATCH_SIZE} UIDs/batch, ${IMAP_SEARCH_TIMEOUT/1000}s timeout)`);
          }
          console.log(`📦 [${this.workerName}] Processing ${uids.length} UIDs in batches of ${MAX_UID_BATCH_SIZE}`);
          
          let allMessages = [];
          let batchCount = 0;
          let successfulBatches = 0;
          
          // 🔧 BATCHED IMAP SEARCH: Process UIDs in small batches to avoid timeouts
          console.log(`⏱️ [${this.workerName}] Starting batched IMAP search with ${IMAP_SEARCH_TIMEOUT/1000}s timeout protection per batch...`);
          
          const searchWithTimeout = async (searchCriteria, options) => {
            const searchPromise = connection.search(searchCriteria, options);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`IMAP search timeout after ${IMAP_SEARCH_TIMEOUT/1000}s`)), IMAP_SEARCH_TIMEOUT)
            );
            return Promise.race([searchPromise, timeoutPromise]);
          };
          
          // 🚨 YANDEX-OPTIMIZED ALTERNATIVE: Use simpler search for problematic servers
          const tryYandexOptimizedSearch = async (uidList, provider = 'unknown') => {
            console.log(`🔄 [${this.workerName}] Trying ${provider}-optimized search for ${uidList.length} UIDs`);
            
            try {
              // For Yandex: Use very simple search criteria without complex body fetching
              const searchResults = [];
              
              // Process UIDs one by one with minimal options for Yandex compatibility
              for (const uid of uidList.slice(0, 5)) { // Limit to first 5 UIDs for Yandex
                try {
                  console.log(`🔍 [${this.workerName}] Yandex search: UID ${uid}`);
                  
                  const simpleSearchPromise = connection.search([['UID', uid]], {
                    struct: false // Minimal options for Yandex compatibility
                  });
                  
                  const yandexTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Yandex search timeout after 3s')), 3000)
                  );
                  
                  const result = await Promise.race([simpleSearchPromise, yandexTimeout]);
                  if (result && result.length > 0) {
                    searchResults.push(...result);
                    console.log(`✅ [${this.workerName}] Yandex UID ${uid}: Found message`);
                  }
                  
                  // Longer delay for Yandex to prevent rate limiting
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                } catch (uidError) {
                  console.log(`⚠️ [${this.workerName}] Yandex UID ${uid} failed: ${uidError.message}`);
                }
              }
              
              if (searchResults.length > 0) {
                console.log(`✅ [${this.workerName}] Yandex-optimized search succeeded: ${searchResults.length} messages`);
                return searchResults;
              } else {
                console.log(`❌ [${this.workerName}] Yandex-optimized search failed: No messages found`);
                return [];
              }
              
            } catch (fetchError) {
              console.log(`❌ [${this.workerName}] Yandex-optimized search failed: ${fetchError.message}`);
              return [];
            }
          };
          
          // Process UIDs in batches
          for (let i = 0; i < uids.length; i += MAX_UID_BATCH_SIZE) {
            const batchUIDs = uids.slice(i, i + MAX_UID_BATCH_SIZE);
            batchCount++;
            
            console.log(`📦 [${this.workerName}] Processing batch ${batchCount}: UIDs ${batchUIDs.slice(0, 3).join(',')}${batchUIDs.length > 3 ? '...' : ''} (${batchUIDs.length} UIDs)`);
            
            try {
              let batchMessages = [];
              
              if (batchUIDs.length === 1) {
                // Single UID search
                console.log(`🔍 [${this.workerName}] Batch ${batchCount}: Searching single UID ${batchUIDs[0]}`);
                batchMessages = await searchWithTimeout([['UID', batchUIDs[0]]], {
                  bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                  struct: false
                });
              } else {
                // Multiple UID search - use individual searches for better reliability
                console.log(`🔍 [${this.workerName}] Batch ${batchCount}: Searching ${batchUIDs.length} UIDs individually`);
                
                for (const uid of batchUIDs) {
                  try {
                    // Use quicker timeout for individual UID searches
                    const quickSearchPromise = connection.search([['UID', uid]], {
                      bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
                      struct: false
                    });
                    const quickTimeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error(`Quick UID search timeout after ${QUICK_SEARCH_TIMEOUT/1000}s`)), QUICK_SEARCH_TIMEOUT)
                    );
                    
                    const individualResult = await Promise.race([quickSearchPromise, quickTimeoutPromise]);
                    batchMessages.push(...individualResult);
                  } catch (individualError) {
                    console.log(`⚠️ [${this.workerName}] Batch ${batchCount}: UID ${uid} search failed: ${individualError.message}`);
                    
                    // If too many individual failures, skip rest of batch
                    if (individualError.message.includes('timeout')) {
                      console.log(`⏰ [${this.workerName}] Batch ${batchCount}: Too many timeouts, skipping remaining UIDs in batch`);
                      break;
                    }
                  }
                }
              }
              
              allMessages.push(...batchMessages);
              successfulBatches++;
              console.log(`✅ [${this.workerName}] Batch ${batchCount} completed: ${batchMessages.length} messages found`);
              
              // Provider-specific delay between batches
              if (i + MAX_UID_BATCH_SIZE < uids.length) {
                const delay = isYandex ? 2000 : 500; // 2 seconds for Yandex, 500ms for others
                await new Promise(resolve => setTimeout(resolve, delay));
                if (isYandex) console.log(`⏳ [${this.workerName}] Yandex rate-limiting delay: ${delay}ms`);
              }
              
            } catch (batchError) {
              console.error(`❌ [${this.workerName}] Batch ${batchCount} failed:`, batchError.message);
              
              if (batchError.message.includes('timeout')) {
                console.log(`⏰ [${this.workerName}] Batch ${batchCount} timeout - continuing with next batch`);
              }
            }
          }
          
          console.log(`📦 [${this.workerName}] Batched search completed: ${successfulBatches}/${batchCount} successful batches, ${allMessages.length} total messages`);
          
          // Use allMessages instead of messages for further processing
          let messages = allMessages;
          
          // 🚨 ENHANCED FALLBACK: Try Yandex-optimized approach if SEARCH completely failed
          if (messages.length === 0 && uids.length > 0) {
            console.log(`⚠️ [${this.workerName}] SEARCH FAILED: No IMAP messages retrieved for ${uids.length} UIDs`);
            console.log(`🔄 [${this.workerName}] Trying Yandex-optimized approach...`);
            
            // Try Yandex-optimized search as fallback
            const providerType = userCredential.provider === 'yandex' || 
                               userCredential.email?.includes('yandex') || 
                               userCredential.email?.includes('intileo') ? 'yandex' : 'gmail';
            
            const yandexResult = await tryYandexOptimizedSearch(uids, providerType);
            
            if (yandexResult.length > 0) {
              messages = yandexResult;
              console.log(`✅ [${this.workerName}] YANDEX FALLBACK SUCCESS: Retrieved ${messages.length} messages`);
            } else {
              console.log(`❌ [${this.workerName}] ALL SEARCH METHODS FAILED: Skipping folder ${folder}`);
              console.log(`🔄 [${this.workerName}] Will retry this folder in next sync cycle`);
              // For Yandex users, this is expected behavior - log as info, not error
              if (userCredential.email?.includes('yandex') || userCredential.email?.includes('intileo')) {
                console.log(`ℹ️ [${this.workerName}] Yandex IMAP limitations: Flag sync may be limited for folder ${folder}`);
              }
              console.log(`ℹ️ [${this.workerName}] No flag updates needed for folder ${folder} (IMAP server limitations)`);
              continue;
            }
          }
          
          // Create UID to flags mapping
          const flagMap = new Map();
          console.log(`📊 [${this.workerName}] Processing ${messages.length} IMAP messages for flag extraction`);
          
          messages.forEach((message, index) => {
            try {
              const uid = message.attributes?.uid?.toString();
              const flags = message.attributes?.flags || [];
              const isRead = flags.includes('\\Seen');
              
              if (uid) {
                flagMap.set(uid, isRead);
                if (index < 3) { // Log first 3 for debugging
                  console.log(`🏷️ [${this.workerName}] UID ${uid}: flags=[${flags.join(',')}], isRead=${isRead}`);
                }
              } else {
                console.warn(`⚠️ [${this.workerName}] Message missing UID:`, JSON.stringify(message.attributes));
              }
            } catch (flagError) {
              console.error(`❌ [${this.workerName}] Error processing message flags:`, flagError.message);
            }
          });
          
          console.log(`🗺️ [${this.workerName}] Created flag map with ${flagMap.size} entries for folder ${folder}`);
          
          // Update database with new flags
          const updates = [];
          let matched = 0;
          let unchanged = 0;
          
          for (const email of folderEmails) {
            const emailUID = email.uid?.toString();
            
            if (flagMap.has(emailUID)) {
              matched++;
              const imapIsRead = flagMap.get(emailUID);
              const dbIsRead = Boolean(email.isRead);
              
              console.log(`🔄 [${this.workerName}] UID ${emailUID}: DB=${dbIsRead}, IMAP=${imapIsRead}`);
              
              if (dbIsRead !== imapIsRead) {
                updates.push({
                  emailID: email.emailID,
                  uid: emailUID,
                  isRead: imapIsRead,
                  oldValue: dbIsRead
                });
              } else {
                unchanged++;
              }
            } else {
              console.warn(`⚠️ [${this.workerName}] No IMAP data found for DB UID ${emailUID} in folder ${folder}`);
            }
          }
          
          console.log(`📊 [${this.workerName}] Folder ${folder}: ${matched} matched, ${unchanged} unchanged, ${updates.length} need updates`);
          
          // Batch update database
          if (updates.length > 0) {
            console.log(`📝 [${this.workerName}] Applying ${updates.length} flag updates in folder ${folder}:`);
            
            for (const update of updates) {
              try {
                const result = await Email.update(
                  { isRead: update.isRead },
                  { where: { emailID: update.emailID } }
                );
                
                console.log(`  ✅ UID ${update.uid}: ${update.oldValue} → ${update.isRead} (affected: ${result[0]})`);
              } catch (updateError) {
                console.error(`  ❌ Failed to update UID ${update.uid}:`, updateError.message);
              }
            }
            
            totalUpdated += updates.length;
            console.log(`📝 [${this.workerName}] Successfully updated ${updates.length} emails in folder ${folder}`);
          } else {
            console.log(`ℹ️ [${this.workerName}] No flag updates needed for folder ${folder}`);
          }
          
        } catch (folderError) {
          console.error(`❌ [${this.workerName}] Error syncing folder ${folder}:`, folderError.message);
        }
      }
      
      console.log(`✅ [${this.workerName}] Flag sync completed for user ${userID}: ${totalUpdated} emails updated`);
      
      // 🏥 HEALTH CHECK: Mark successful sync
      if (this.userHealthCheck) {
        const userHealth = this.userHealthCheck.get(userID) || { 
          consecutiveFailures: 0, 
          lastSuccess: Date.now(),
          skipUntil: null 
        };
        
        userHealth.consecutiveFailures = 0;
        userHealth.lastSuccess = Date.now();
        userHealth.skipUntil = null;
        this.userHealthCheck.set(userID, userHealth);
        
        if (totalUpdated > 0) {
          console.log(`🏥 [${this.workerName}] User ${userID} health: GOOD (${totalUpdated} updates applied)`);
        }
      }
      
    } catch (error) {
      console.error(`❌ [${this.workerName}] Flag sync failed for user ${userID}:`, error.message);
      
      // 🏥 HEALTH CHECK: Track failure
      if (this.userHealthCheck) {
        const userHealth = this.userHealthCheck.get(userID) || { 
          consecutiveFailures: 0, 
          lastSuccess: Date.now(),
          skipUntil: null 
        };
        
        userHealth.consecutiveFailures++;
        
        // Apply cooldown if too many failures
        if (userHealth.consecutiveFailures >= 3) {
          const cooldownMinutes = Math.min(userHealth.consecutiveFailures, 10); // Max 10 minute cooldown
          userHealth.skipUntil = Date.now() + (cooldownMinutes * 60 * 1000);
          console.log(`🏥 [${this.workerName}] User ${userID} health: BAD (${userHealth.consecutiveFailures} failures) - applying ${cooldownMinutes}min cooldown`);
        } else {
          console.log(`🏥 [${this.workerName}] User ${userID} health: DEGRADED (${userHealth.consecutiveFailures} failures)`);
        }
        
        this.userHealthCheck.set(userID, userHealth);
      }
      
      throw error;
    } finally {
      // Clean up IMAP connection
      if (connection) {
        try {
          await connection.end();
          this.activeConnections.delete(userID);
          console.log(`🔌 [${this.workerName}] IMAP connection closed for user ${userID}`);
        } catch (closeError) {
          console.error(`❌ [${this.workerName}] Error closing IMAP connection:`, closeError.message);
        }
      }
    }
  }

  // Get IMAP configuration for user
  getImapConfig(userCredential) {
    const providerConfigs = {
      gmail: { host: 'imap.gmail.com', port: 993, tls: true },
      yandex: { host: 'imap.yandex.com', port: 993, tls: true },
      outlook: { host: 'outlook.office365.com', port: 993, tls: true },
      yahoo: { host: 'imap.mail.yahoo.com', port: 993, tls: true }
    };
    
    const provider = userCredential.provider || 'gmail';
    const config = providerConfigs[provider];
    
    if (provider === 'custom') {
      return {
        imap: {
          user: userCredential.email,
          password: userCredential.appPassword,
          host: userCredential.imapHost,
          port: userCredential.imapPort,
          tls: userCredential.imapTLS,
          authTimeout: 15000,
          connTimeout: 15000,
          tlsOptions: { rejectUnauthorized: false }
        }
      };
    }
    
    return {
      imap: {
        user: userCredential.email,
        password: userCredential.appPassword,
        host: config.host,
        port: config.port,
        tls: config.tls,
        authTimeout: 15000,
        connTimeout: 15000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };
  }

  // Group emails by folder for efficient processing
  groupEmailsByFolder(emails) {
    const groups = {};
    
    emails.forEach(email => {
      const folder = email.folder || 'INBOX';
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(email);
    });
    
    return groups;
  }

  // Retry failed job
  async retryJob(job, originalMessage) {
    try {
      job.retryCount = (job.retryCount || 0) + 1;
      job.retryTimestamp = new Date().toISOString();
      
      // Calculate delay based on retry count (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, job.retryCount), 30000); // Max 30 seconds
      
      console.log(`🔄 [${this.workerName}] Retrying job for user ${job.userID} (attempt ${job.retryCount}/${job.maxRetries}) in ${delay}ms`);
      
      // Schedule retry
      setTimeout(async () => {
        try {
          await this.channel.sendToQueue(
            'SYNC_FLAGS_QUEUE',
            Buffer.from(JSON.stringify(job)),
            {
              persistent: true,
              priority: Math.max(1, job.priority - 1) // Lower priority for retries
            }
          );
        } catch (retryError) {
          console.error(`❌ [${this.workerName}] Failed to schedule retry:`, retryError.message);
        }
      }, delay);
      
      // Acknowledge original message
      this.channel.ack(originalMessage);
      
    } catch (error) {
      console.error(`❌ [${this.workerName}] Retry logic failed:`, error.message);
      throw error;
    }
  }

  // Setup graceful shutdown
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`🛑 [${this.workerName}] Received ${signal}, starting graceful shutdown...`);
      
      this.isRunning = false;
      
      // Close active IMAP connections
      for (const [userID, connection] of this.activeConnections) {
        try {
          await connection.end();
          console.log(`🔌 [${this.workerName}] Closed IMAP connection for user ${userID}`);
        } catch (error) {
          console.error(`❌ [${this.workerName}] Error closing connection for user ${userID}:`, error.message);
        }
      }
      
      // Close RabbitMQ connections
      try {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
        console.log(`✅ [${this.workerName}] RabbitMQ connections closed`);
      } catch (error) {
        console.error(`❌ [${this.workerName}] Error closing RabbitMQ:`, error.message);
      }
      
      console.log(`✅ [${this.workerName}] Graceful shutdown completed. Processed: ${this.processedJobs}, Failed: ${this.failedJobs}`);
      process.exit(0);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  // Get worker statistics
  getStats() {
    return {
      workerName: this.workerName,
      isRunning: this.isRunning,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      activeConnections: this.activeConnections.size,
      concurrency: this.concurrency,
      uptime: process.uptime()
    };
  }
}

module.exports = FlagSyncWorker;