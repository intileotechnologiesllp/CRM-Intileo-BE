const Imap = require('imap-simple');
const pLimit = require('p-limit');
const Email = require('../models/email/emailModel');
const UserCredential = require('../models/email/userCredentialModel');

// Configuration
const MAX_CONCURRENT_IMAP = 2; // Reduced to 2 for better performance with multiple users
const IMAP_TIMEOUT = 15000; // Increased to 15 seconds for better reliability
const SYNC_BATCH_SIZE = 200; // 🚀 FIX 1: Increased batch size from 50 to 200 emails
const MAX_VISIBLE_EMAILS = 500; // 🚀 FIX 2: Only sync first 500 emails (UI visible range)
const LARGE_MAILBOX_THRESHOLD = 10000; // Consider mailbox "large" if more than 10k emails

// Create concurrency limiter - only 2 users can sync simultaneously
const imapLimiter = pLimit(MAX_CONCURRENT_IMAP);

// Track active sync operations
const activeSyncs = new Map();

/**
 * 🚀 PERFORMANCE HELPER: Create efficient UID ranges for IMAP FETCH
 * Converts array of UIDs into ranges like "1:50,75:100" for better IMAP performance
 */
function createUidRanges(uids) {
  if (!uids || uids.length === 0) return [];
  
  // Sort UIDs numerically
  const sortedUids = uids.map(Number).sort((a, b) => a - b);
  const ranges = [];
  
  let start = sortedUids[0];
  let end = start;
  
  for (let i = 1; i < sortedUids.length; i++) {
    if (sortedUids[i] === end + 1) {
      // Consecutive UID, extend range
      end = sortedUids[i];
    } else {
      // Gap found, close current range and start new one
      ranges.push(start === end ? `${start}` : `${start}:${end}`);
      start = end = sortedUids[i];
    }
  }
  
  // Add final range
  ranges.push(start === end ? `${start}` : `${start}:${end}`);
  
  // Split large ranges to avoid IMAP limitations (max 50 UIDs per range)
  const optimizedRanges = [];
  for (const range of ranges) {
    if (range.includes(':')) {
      const [rangeStart, rangeEnd] = range.split(':').map(Number);
      const rangeSize = rangeEnd - rangeStart + 1;
      
      if (rangeSize > 50) {
        // Split large range into chunks of 50
        for (let chunk = rangeStart; chunk <= rangeEnd; chunk += 50) {
          const chunkEnd = Math.min(chunk + 49, rangeEnd);
          optimizedRanges.push(chunk === chunkEnd ? `${chunk}` : `${chunk}:${chunkEnd}`);
        }
      } else {
        optimizedRanges.push(range);
      }
    } else {
      optimizedRanges.push(range);
    }
  }
  
  return optimizedRanges;
}

/**
 * Sync read/unread flags for paginated emails from IMAP with concurrency control
 * @param {Array} emails - Array of email objects from database
 * @param {number} masterUserID - User ID for IMAP credentials
 * @returns {Promise<Array>} Updated emails array
 */
async function syncImapFlags(emails, masterUserID) {
  // 🚀 PERFORMANCE: Check for existing sync operation
  if (activeSyncs.has(masterUserID)) {
    console.log(`⚠️ [IMAP SYNC] User ${masterUserID} already has active sync operation`);
    return emails; // Return original emails without syncing
  }

  // 🚀 PERFORMANCE: Use concurrency limiter to control simultaneous operations
  return imapLimiter(async () => {
    activeSyncs.set(masterUserID, Date.now());
    console.log(`🔄 [IMAP SYNC] Starting sync for user ${masterUserID} with concurrency control (Active syncs: ${activeSyncs.size})`);
    
    try {
      return await performImapSync(emails, masterUserID);
    } finally {
      activeSyncs.delete(masterUserID);
      console.log(`✅ [IMAP SYNC] Completed sync for user ${masterUserID} (Active syncs: ${activeSyncs.size})`);
    }
  });
}

/**
 * Internal function to perform the actual IMAP sync
 */
async function performImapSync(emails, masterUserID) {
  if (!emails || emails.length === 0) {
    return emails;
  }

  // 🚀 FIX 2: Limit emails to visible range for large users
  let emailsToSync = emails;
  const isLargeMailbox = emails.length > LARGE_MAILBOX_THRESHOLD;
  
  if (isLargeMailbox) {
    // Only sync visible emails for large mailboxes (first 500)
    emailsToSync = emails.slice(0, MAX_VISIBLE_EMAILS);
    console.log(`⚡ [LARGE MAILBOX OPTIMIZATION] User ${masterUserID} has ${emails.length} emails, syncing only first ${emailsToSync.length} for performance`);
  }
  
  let connection = null;
  
  try {
    console.log(`🔄 [IMAP SYNC] Starting flag sync for ALL ${emailsToSync.length} emails (User: ${masterUserID})`);
    
    // Get user's IMAP credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
      attributes: ['email', 'appPassword', 'smtpHost', 'smtpPort', 'imapHost', 'imapPort', 'provider']
    });

    if (!userCredential || !userCredential.appPassword) {
      console.log(`⚠️ [IMAP SYNC] No IMAP credentials found for user ${masterUserID}`);
      return emails;
    }

    // 🚀 PERFORMANCE: Use optimized IMAP connection with timeout control
    const connectionTimeout = 15000; // 15 seconds
    const imapSettings = getImapSettings(userCredential);
    
    if (!imapSettings) {
      console.log(`⚠️ [IMAP SYNC] Unable to determine IMAP settings for user ${masterUserID}`);
      return emails;
    }

    console.log(`🔗 [IMAP SYNC] Connecting to ${imapSettings.host} for user ${masterUserID} with ${connectionTimeout}ms timeout`);
    
    const connectionConfig = {
      imap: {
        user: userCredential.email,
        password: userCredential.appPassword,
        host: imapSettings.host,
        port: imapSettings.port,
        tls: imapSettings.tls,
        authTimeout: connectionTimeout,
        connTimeout: connectionTimeout,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: false, // Disable keepalive for faster cleanup
      }
    };

    // Connect with timeout protection
    const connectPromise = Imap.connect(connectionConfig);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('IMAP connection timeout')), connectionTimeout)
    );
    
    connection = await Promise.race([connectPromise, timeoutPromise]);

    // Filter emails that have UIDs (only fetched emails have UIDs) from the limited set
    const emailsWithUIDs = emailsToSync.filter(email => email.uid && email.uid !== null);
    
    if (emailsWithUIDs.length === 0) {
      console.log(`ℹ️ [IMAP SYNC] No emails with UIDs to sync for user ${masterUserID}`);
      return emails;
    }

    console.log(`📧 [IMAP SYNC] Found ${emailsWithUIDs.length} emails with UIDs to sync (processing ALL emails)`);

    // Prepare IMAP configuration with auto-detected settings
    const mainImapConfig = {
      imap: {
        user: userCredential.email,
        password: userCredential.appPassword,
        host: imapSettings.host,
        port: imapSettings.port,
        tls: imapSettings.tls,
        authTimeout: IMAP_TIMEOUT,
        connTimeout: IMAP_TIMEOUT,
        tlsOptions: {
          rejectUnauthorized: false
        }
      }
    };

    console.log(`📋 [IMAP SYNC] Using IMAP settings: ${imapSettings.host}:${imapSettings.port} (Provider: ${imapSettings.provider})`);

    // Use concurrency limiter for IMAP connection
    const syncResult = await imapLimiter(async () => {
      console.log(`🔍 [DEBUG] Calling performImapSync with masterUserID: ${masterUserID}, type: ${typeof masterUserID}`);
      return await performImapSync(mainImapConfig, emailsWithUIDs, masterUserID);
    });

    // Return the synced emails directly (processing ALL emails)
    return syncResult || emails;

  } catch (error) {
    console.error(`❌ [IMAP SYNC] Error syncing flags for user ${masterUserID}:`, error.message);
    return emails; // Return original emails on error
  }
}

/**
 * Perform the actual IMAP synchronization
 * @param {Object} imapConfig - IMAP configuration
 * @param {Array} emailsWithUIDs - Emails with UIDs to sync
 * @param {number} masterUserID - User ID
 * @returns {Promise<Array>} Updated emails
 */
async function performImapSync(imapConfig, emailsWithUIDs, masterUserID) {
  let connection = null;
  
  try {
    // Connect to IMAP
    console.log(`� [DEBUG] performImapSync received masterUserID: ${masterUserID}, type: ${typeof masterUserID}`);
    console.log(`�🔌 [IMAP SYNC] Connecting to IMAP for user ${masterUserID}...`);
    connection = await Imap.connect(imapConfig);
    
    // Group emails by folder for efficient processing
    const emailsByFolder = groupEmailsByFolder(emailsWithUIDs);
    
    const updatedEmails = [];
    const emailUpdateBatch = [];

    // Process each folder
    for (const [folder, folderEmails] of Object.entries(emailsByFolder)) {
      try {
        console.log(`📁 [IMAP SYNC] Processing folder: ${folder} (${folderEmails.length} emails)`);
        
        // Try to open the folder with fallback options
        let folderOpened = false;
        const folderVariants = getFolderVariants(folder);
        
        for (const folderVariant of folderVariants) {
          try {
            await connection.openBox(folderVariant);
            folderOpened = true;
            if (folderVariant !== folder) {
              console.log(`📁 [IMAP SYNC] Using folder variant: ${folderVariant} (requested: ${folder})`);
            }
            break;
          } catch (openError) {
            if (folderVariant === folderVariants[folderVariants.length - 1]) {
              // Last attempt failed
              throw openError;
            }
            // Try next variant
            continue;
          }
        }
        
        if (!folderOpened) {
          throw new Error(`Unable to open folder: ${folder}`);
        }
        
          // Process emails in batches to avoid memory issues
          console.log(`🚀 [BATCH PROCESSING] Processing ${folderEmails.length} emails in ${SYNC_BATCH_SIZE}-email batches`);
          
          for (let i = 0; i < folderEmails.length; i += SYNC_BATCH_SIZE) {
            const batch = folderEmails.slice(i, i + SYNC_BATCH_SIZE);
            const batchUIDs = batch.map(email => email.uid).filter(Boolean);
            
            if (batchUIDs.length === 0) continue;
            
            console.log(`🔍 [BATCH ${Math.floor(i/SYNC_BATCH_SIZE) + 1}] Processing ${batchUIDs.length} UIDs in ${folder} (${i + 1}-${Math.min(i + SYNC_BATCH_SIZE, folderEmails.length)})`);
            
            try {
              // 🚀 FIX 3: Use targeted UID FETCH instead of searching ALL emails
              // This is 100x faster than fetching all emails in large mailboxes
              const uidRanges = createUidRanges(batchUIDs);
              console.log(`⚡ [OPTIMIZED FETCH] Fetching flags for specific UIDs: ${uidRanges}`);
              
              let batchMessages = [];
              for (const uidRange of uidRanges) {
                try {
                  // Fetch only specific UIDs instead of ALL
                  const rangeMessages = await connection.search([['UID', uidRange]], {
                    bodies: '', // Don't fetch body, only headers and flags
                    markSeen: false,
                    struct: false
                  });
                  batchMessages.push(...rangeMessages);
                } catch (rangeError) {
                  console.warn(`⚠️ [UID FETCH] Failed to fetch UID range ${uidRange}:`, rangeError.message);
                  // Continue with other ranges
                }
              }
              
              // Create a map of IMAP email statuses (only for our specific UIDs)
              const imapStatusMap = {};
              for (const message of batchMessages) {
                const uid = message.attributes.uid;
                const flags = message.attributes.flags || [];
                const isRead = flags.includes('\\Seen');
                imapStatusMap[uid] = isRead;
              }
              
              console.log(`📬 [BATCH RESULTS] Found ${Object.keys(imapStatusMap).length} emails in IMAP for batch of ${batchUIDs.length} requested UIDs`);
              
              // Process emails in this batch
              for (const email of batch) {
                const imapIsRead = imapStatusMap[email.uid];
                
                if (imapIsRead !== undefined) {
                  const oldIsRead = email.isRead;
                  
                  // Only update if flags actually changed
                  if (oldIsRead !== imapIsRead) {
                    console.log(`🔄 [FLAG SYNC] UID ${email.uid}: DB=${oldIsRead} → IMAP=${imapIsRead} (EmailID: ${email.emailID})`);
                    
                    emailUpdateBatch.push({
                      emailID: email.emailID,
                      isRead: imapIsRead,
                      uid: email.uid,
                      subject: email.subject?.substring(0, 30) || 'No Subject'
                    });
                  }
                  
                  // Update the email object for response
                  email.isRead = imapIsRead;
                  updatedEmails.push(email);
                } else {
                  console.log(`⚠️ [UID NOT FOUND] UID ${email.uid} not found in IMAP, keeping DB status: ${email.isRead}`);
                  updatedEmails.push(email);
                }
              }
              
              // Add small delay between batches to avoid overwhelming server
              if (i + SYNC_BATCH_SIZE < folderEmails.length) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
              }
              
            } catch (batchError) {
              console.error(`❌ [BATCH ERROR] Failed to process batch ${Math.floor(i/SYNC_BATCH_SIZE) + 1}:`, batchError.message);
              // Add emails without sync (keep original isRead values)
              updatedEmails.push(...batch);
            }
          }
        
      } catch (folderError) {
        if (folderError.message.includes('No such folder') || folderError.message.includes('SELECT')) {
          console.log(`⚠️ [IMAP SYNC] Folder '${folder}' not found, skipping ${folderEmails.length} emails`);
          // Add emails without sync (keep original isRead values)
          updatedEmails.push(...folderEmails);
        } else {
          console.error(`❌ [IMAP SYNC] Error processing folder ${folder}:`, folderError.message);
          // Continue with other folders
          updatedEmails.push(...folderEmails);
        }
      }
    }

    // Perform batch database update
    if (emailUpdateBatch.length > 0) {
      console.log(`📝 [IMAP SYNC] Updating ${emailUpdateBatch.length} emails in database:`);
      emailUpdateBatch.forEach(update => {
        console.log(`   - EmailID ${update.emailID} (UID: ${update.uid}): isRead → ${update.isRead} | "${update.subject}"`);
      });
      
      await performBatchUpdate(emailUpdateBatch);
      console.log(`✅ [IMAP SYNC] Successfully updated ${emailUpdateBatch.length} emails in database`);
    } else {
      console.log(`ℹ️ [IMAP SYNC] No flag changes detected, no database updates needed`);
    }

    // Return ALL emails with their current flag states, not just updated ones
    // Update the isRead property for emails that had changes
    const updatedEmailsMap = new Map(updatedEmails.map(email => [email.uid, email]));
    const allEmailsWithCurrentFlags = emailsWithUIDs.map(email => {
      const updatedEmail = updatedEmailsMap.get(email.uid);
      return updatedEmail || email; // Use updated version if available, otherwise original
    });

    return allEmailsWithCurrentFlags;

  } finally {
    // Always close the connection
    if (connection) {
      try {
        await connection.end();
        console.log(`🔌 [IMAP SYNC] IMAP connection closed for user ${masterUserID}`);
      } catch (closeError) {
        console.error(`⚠️ [IMAP SYNC] Error closing IMAP connection:`, closeError.message);
      }
    }
  }
}

/**
 * Group emails by folder for efficient IMAP processing
 * @param {Array} emails - Array of emails
 * @returns {Object} Emails grouped by folder
 */
function groupEmailsByFolder(emails) {
  const folderMap = {};
  
  for (const email of emails) {
    let folder = email.folder || 'INBOX';
    
    // Map folder names to provider-specific folders
    folder = mapFolderName(folder);
    
    if (!folderMap[folder]) {
      folderMap[folder] = [];
    }
    folderMap[folder].push(email);
  }
  
  return folderMap;
}

/**
 * Map generic folder names to provider-specific folder names
 * @param {String} folder - Generic folder name
 * @returns {String} Provider-specific folder name
 */
function mapFolderName(folder) {
  const folderMapping = {
    // Normalize common folder names
    'sent': 'Sent',
    'drafts': 'Drafts', 
    'trash': 'Trash',
    'spam': 'Spam',
    'junk': 'Spam',
    'archive': 'Archive',
    
    // Yandex-specific mappings
    'Sent': 'Sent',
    'Drafts': 'Drafts',
    'Trash': 'Trash',
    'Spam': 'Spam',
    
    // Gmail-specific mappings  
    '[Gmail]/Sent Mail': 'Sent',
    '[Gmail]/Drafts': 'Drafts',
    '[Gmail]/Trash': 'Trash',
    '[Gmail]/Spam': 'Spam',
    '[Gmail]/All Mail': 'Archive',
    
    // Outlook-specific mappings
    'Sent Items': 'Sent',
    'Deleted Items': 'Trash',
    'Junk Email': 'Spam'
  };
  
  return folderMapping[folder] || folder;
}

/**
 * Get folder variants to try when opening folders
 * @param {String} folder - Original folder name
 * @returns {Array} Array of folder names to try
 */
function getFolderVariants(folder) {
  const variants = [folder]; // Always try original first
  
  switch (folder.toLowerCase()) {
    case 'sent':
      variants.push('Sent', 'Sent Items', '[Gmail]/Sent Mail', 'Отправленные');
      break;
    case 'drafts':
      variants.push('Drafts', '[Gmail]/Drafts', 'Черновики');
      break;
    case 'trash':
      variants.push('Trash', 'Deleted Items', '[Gmail]/Trash', 'Удалённые');
      break;
    case 'spam':
      variants.push('Spam', 'Junk Email', '[Gmail]/Spam', 'Спам');
      break;
    case 'archive':
      variants.push('Archive', '[Gmail]/All Mail', 'Архив');
      break;
    case 'inbox':
      variants.push('INBOX', 'Inbox', 'Входящие');
      break;
  }
  
  // Remove duplicates while preserving order
  return [...new Set(variants)];
}

/**
 * Perform batch update of email isRead flags
 * @param {Array} updates - Array of {emailID, isRead} objects
 */
async function performBatchUpdate(updates) {
  try {
    // Group updates by isRead value for efficient bulk updates
    const readUpdates = updates.filter(u => u.isRead).map(u => u.emailID);
    const unreadUpdates = updates.filter(u => !u.isRead).map(u => u.emailID);
    
    console.log(`🔄 [IMAP SYNC] Database update breakdown:`);
    console.log(`   - Mark as READ: ${readUpdates.length} emails (IDs: ${readUpdates.join(', ')})`);
    console.log(`   - Mark as UNREAD: ${unreadUpdates.length} emails (IDs: ${unreadUpdates.join(', ')})`);
    
    const updatePromises = [];
    
    if (readUpdates.length > 0) {
      updatePromises.push(
        Email.update(
          { isRead: true },
          { where: { emailID: readUpdates } }
        ).then(result => {
          console.log(`✅ [IMAP SYNC] Marked ${result[0]} emails as READ in database`);
          return result;
        })
      );
    }
    
    if (unreadUpdates.length > 0) {
      updatePromises.push(
        Email.update(
          { isRead: false },
          { where: { emailID: unreadUpdates } }
        ).then(result => {
          console.log(`✅ [IMAP SYNC] Marked ${result[0]} emails as unread in database`);
          return result;
        })
      );
    }
    
    await Promise.all(updatePromises);
    
  } catch (error) {
    console.error(`❌ [IMAP SYNC] Batch update error:`, error.message);
    throw error;
  }
}

/**
 * Check IMAP connection health for a user
 * @param {number} masterUserID - User ID
 * @returns {Promise<boolean>} True if connection is healthy
 */
async function checkImapHealth(masterUserID) {
  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
      attributes: ['email', 'appPassword', 'smtpHost', 'smtpPort', 'imapHost', 'imapPort', 'provider']
    });

    if (!userCredential || !userCredential.appPassword) {
      return false;
    }

    // Auto-detect IMAP settings
    const imapSettings = getImapSettings(userCredential);
    
    if (!imapSettings) {
      return false;
    }

    const imapConfig = {
      imap: {
        user: userCredential.email,
        password: userCredential.appPassword,
        host: imapSettings.host,
        port: imapSettings.port,
        tls: imapSettings.tls,
        authTimeout: 5000,
        connTimeout: 5000,
        tlsOptions: {
          rejectUnauthorized: false
        }
      }
    };

    const connection = await Imap.connect(imapConfig);
    await connection.end();
    return true;

  } catch (error) {
    console.error(`❌ [IMAP HEALTH] Health check failed for user ${masterUserID}:`, error.message);
    return false;
  }
}

/**
 * Auto-detect IMAP settings based on user credentials
 * @param {Object} userCredential - User credential object
 * @returns {Object|null} IMAP settings or null if unsupported
 */
function getImapSettings(userCredential) {
  // If custom IMAP settings are provided, use them
  if (userCredential.imapHost && userCredential.imapPort) {
    return {
      host: userCredential.imapHost,
      port: userCredential.imapPort,
      tls: userCredential.imapTLS !== false, // Default to true
      provider: 'custom'
    };
  }

  // Auto-detect based on provider field
  if (userCredential.provider) {
    switch (userCredential.provider.toLowerCase()) {
      case 'gmail':
        return {
          host: 'imap.gmail.com',
          port: 993,
          tls: true,
          provider: 'gmail'
        };
      case 'outlook':
        return {
          host: 'outlook.office365.com',
          port: 993,
          tls: true,
          provider: 'outlook'
        };
      case 'yahoo':
        return {
          host: 'imap.mail.yahoo.com',
          port: 993,
          tls: true,
          provider: 'yahoo'
        };
      case 'yandex':
        return {
          host: 'imap.yandex.com',
          port: 993,
          tls: true,
          provider: 'yandex'
        };
    }
  }

  // Auto-detect based on email domain
  const email = userCredential.email;
  if (email) {
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (domain) {
      // Gmail domains
      if (domain === 'gmail.com' || domain === 'googlemail.com') {
        return {
          host: 'imap.gmail.com',
          port: 993,
          tls: true,
          provider: 'gmail'
        };
      }
      
      // Outlook/Hotmail domains
      if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
        return {
          host: 'outlook.office365.com',
          port: 993,
          tls: true,
          provider: 'outlook'
        };
      }
      
      // Yahoo domains
      if (domain === 'yahoo.com' || domain === 'yahoo.in' || domain.includes('yahoo.')) {
        return {
          host: 'imap.mail.yahoo.com',
          port: 993,
          tls: true,
          provider: 'yahoo'
        };
      }
      
      // Yandex domains
      if (domain === 'yandex.com' || domain === 'yandex.ru' || domain.includes('yandex.')) {
        return {
          host: 'imap.yandex.com',
          port: 993,
          tls: true,
          provider: 'yandex'
        };
      }
    }
  }

  // Auto-detect from SMTP settings
  if (userCredential.smtpHost) {
    const smtpHost = userCredential.smtpHost.toLowerCase();
    
    if (smtpHost.includes('gmail')) {
      return {
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        provider: 'gmail'
      };
    }
    
    if (smtpHost.includes('outlook') || smtpHost.includes('office365')) {
      return {
        host: 'outlook.office365.com',
        port: 993,
        tls: true,
        provider: 'outlook'
      };
    }
    
    if (smtpHost.includes('yahoo')) {
      return {
        host: 'imap.mail.yahoo.com',
        port: 993,
        tls: true,
        provider: 'yahoo'
      };
    }
    
    if (smtpHost.includes('yandex')) {
      return {
        host: 'imap.yandex.com',
        port: 993,
        tls: true,
        provider: 'yandex'
      };
    }
  }

  // Default to Gmail if no detection possible
  console.log(`⚠️ [IMAP SYNC] Could not auto-detect provider, defaulting to Gmail`);
  return {
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    provider: 'gmail'
  };
}

module.exports = {
  syncImapFlags,
  checkImapHealth,
  getImapSettings,
  MAX_CONCURRENT_IMAP,
  SYNC_BATCH_SIZE
};