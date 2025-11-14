// 📧 REAL-TIME EMAIL SYNC - Frontend Integration with IMAP IDLE
// Replace your existing email API calls with these functions

class RealtimeEmailAPI {
  constructor() {
    this.baseURL = '/api/email';
    this.isRealtimeActive = false;
    this.eventSource = null; // For Server-Sent Events (optional)
  }

  // Get auth headers
  getHeaders() {
    return {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json'
    };
  }

  // 📧 1. Load emails with automatic IMAP IDLE startup
  // REPLACE: your current getEmails calls with this
  async getEmailsRealtime(page = 1, limit = 20, filters = {}) {
    try {
      console.log('📧 Loading emails with real-time IMAP IDLE sync...');
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters
      });

      const response = await fetch(`${this.baseURL}/get-emails-realtime?${params}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const emailData = await response.json();
      
      // Mark realtime as active
      this.isRealtimeActive = true;
      
      console.log('✅ Emails loaded with IMAP IDLE active');
      return emailData;
      
    } catch (error) {
      console.error('❌ Failed to load realtime emails:', error);
      throw error;
    }
  }

  // ✅ 2. Mark email as read/unread with instant Gmail sync
  // This updates both CRM database AND Gmail server immediately
  async markEmailReadRealtime(emailUID, isRead = true) {
    try {
      console.log(`📤 Marking email ${emailUID} as ${isRead ? 'read' : 'unread'} (with Gmail sync)...`);
      
      const response = await fetch(`${this.baseURL}/mark-read-realtime`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          emailUID: emailUID,
          isRead: isRead
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Email ${emailUID} marked as ${isRead ? 'read' : 'unread'} - synced to Gmail!`);
        
        // Update UI immediately
        this.updateEmailInUI(emailUID, isRead);
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to update email status');
      }
      
    } catch (error) {
      console.error('❌ Failed to mark email as read/unread:', error);
      throw error;
    }
  }

  // 📋 3. Bulk mark emails with Gmail sync
  async bulkMarkEmailsRealtime(emailUIDs, isRead = true) {
    try {
      console.log(`📋 Bulk marking ${emailUIDs.length} emails as ${isRead ? 'read' : 'unread'} (with Gmail sync)...`);
      
      const response = await fetch(`${this.baseURL}/bulk-mark-realtime`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          emailUIDs: emailUIDs,
          isRead: isRead
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Bulk operation completed: ${result.results.serverSynced} emails synced to Gmail`);
        
        // Update UI for all emails
        emailUIDs.forEach(uid => {
          this.updateEmailInUI(uid, isRead);
        });
        
        return result;
      } else {
        throw new Error(result.error || 'Bulk operation failed');
      }
      
    } catch (error) {
      console.error('❌ Bulk operation failed:', error);
      throw error;
    }
  }

  // 🔄 4. Start real-time sync manually
  async startRealtimeSync() {
    try {
      console.log('🔄 Starting real-time email sync...');
      
      const response = await fetch(`${this.baseURL}/start-realtime-sync`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const result = await response.json();
      
      if (result.success) {
        this.isRealtimeActive = true;
        console.log(`✅ Real-time sync started for ${result.email}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to start real-time sync:', error);
      throw error;
    }
  }

  // 🛑 5. Stop real-time sync
  async stopRealtimeSync() {
    try {
      console.log('🛑 Stopping real-time email sync...');
      
      const response = await fetch(`${this.baseURL}/stop-realtime-sync`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const result = await response.json();
      
      if (result.success) {
        this.isRealtimeActive = false;
        console.log('✅ Real-time sync stopped');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to stop real-time sync:', error);
      throw error;
    }
  }

  // 📊 6. Check real-time sync status
  async getRealtimeStatus() {
    try {
      const response = await fetch(`${this.baseURL}/realtime-status`, {
        headers: this.getHeaders()
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('📊 Real-time status:', result.status);
        this.isRealtimeActive = result.status.connected;
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to get real-time status:', error);
      throw error;
    }
  }

  // 🎯 Update email UI element
  updateEmailInUI(emailUID, isRead) {
    try {
      // Find the email row by UID
      const emailRow = document.querySelector(`[data-email-uid="${emailUID}"]`);
      
      if (emailRow) {
        // Update visual indicators
        const readIndicator = emailRow.querySelector('.read-indicator, .unread-dot, .blue-dot');
        
        if (isRead) {
          // Mark as read - remove unread indicators
          emailRow.classList.remove('unread');
          emailRow.classList.add('read');
          
          if (readIndicator) {
            readIndicator.style.display = 'none'; // Hide blue dot
          }
          
          // Update any read/unread buttons
          const markReadBtn = emailRow.querySelector('.mark-read-btn');
          if (markReadBtn) {
            markReadBtn.textContent = 'Mark as Unread';
            markReadBtn.dataset.isRead = 'true';
          }
          
        } else {
          // Mark as unread - add unread indicators
          emailRow.classList.remove('read');
          emailRow.classList.add('unread');
          
          if (readIndicator) {
            readIndicator.style.display = 'block'; // Show blue dot
          }
          
          // Update any read/unread buttons
          const markReadBtn = emailRow.querySelector('.mark-read-btn');
          if (markReadBtn) {
            markReadBtn.textContent = 'Mark as Read';
            markReadBtn.dataset.isRead = 'false';
          }
        }
        
        console.log(`🎯 UI updated for email ${emailUID}: ${isRead ? 'read' : 'unread'}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to update UI:', error);
    }
  }

  // 🔄 Show sync status indicator
  showSyncStatus(isActive, message = '') {
    let statusEl = document.getElementById('realtime-sync-status');
    
    if (!statusEl) {
      // Create status indicator if it doesn't exist
      statusEl = document.createElement('div');
      statusEl.id = 'realtime-sync-status';
      statusEl.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        color: white;
        font-size: 12px;
        font-weight: 500;
        z-index: 1000;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(statusEl);
    }
    
    if (isActive) {
      statusEl.style.backgroundColor = '#28a745';
      statusEl.innerHTML = '🟢 Real-time sync active';
    } else {
      statusEl.style.backgroundColor = '#dc3545';
      statusEl.innerHTML = '🔴 Real-time sync inactive';
    }
    
    if (message) {
      statusEl.innerHTML += ` - ${message}`;
    }
  }

  // 🚀 Initialize real-time email system
  async initialize() {
    try {
      // Check current status
      await this.getRealtimeStatus();
      
      // Update status indicator
      this.showSyncStatus(this.isRealtimeActive);
      
      // Start real-time sync if not active
      if (!this.isRealtimeActive) {
        await this.startRealtimeSync();
      }
      
      console.log('🚀 Real-time email system initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize real-time email system:', error);
      this.showSyncStatus(false, 'Failed to start');
    }
  }

  // 🛑 Cleanup on page unload
  async cleanup() {
    if (this.isRealtimeActive) {
      await this.stopRealtimeSync();
    }
    
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// 🚀 USAGE EXAMPLES:

// Initialize the real-time email API
const realtimeEmail = new RealtimeEmailAPI();

// 📧 1. Replace your existing getEmails calls:
async function loadEmails() {
  try {
    const emails = await realtimeEmail.getEmailsRealtime(1, 20);
    renderEmailsInUI(emails);
  } catch (error) {
    showErrorMessage('Failed to load emails');
  }
}

// ✅ 2. Replace your mark as read functionality:
async function handleMarkAsRead(emailUID) {
  try {
    await realtimeEmail.markEmailReadRealtime(emailUID, true);
    // UI is automatically updated + Gmail is instantly synced
  } catch (error) {
    showErrorMessage('Failed to mark email as read');
  }
}

// 📧 3. Replace your mark as unread functionality:
async function handleMarkAsUnread(emailUID) {
  try {
    await realtimeEmail.markEmailReadRealtime(emailUID, false);
    // UI is automatically updated + Gmail is instantly synced
  } catch (error) {
    showErrorMessage('Failed to mark email as unread');
  }
}

// 📋 4. Replace your bulk operations:
async function markAllAsRead(selectedEmailUIDs) {
  try {
    await realtimeEmail.bulkMarkEmailsRealtime(selectedEmailUIDs, true);
    // All selected emails updated in UI + Gmail synced
  } catch (error) {
    showErrorMessage('Failed to mark emails as read');
  }
}

// 🎯 EVENT HANDLERS FOR YOUR UI:

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await realtimeEmail.initialize();
  await loadEmails();
});

// Handle email clicks with real-time sync
document.addEventListener('click', async (e) => {
  // Mark as read/unread button clicks
  if (e.target.classList.contains('mark-read-btn')) {
    const emailUID = e.target.dataset.emailUid;
    const isCurrentlyRead = e.target.dataset.isRead === 'true';
    
    if (isCurrentlyRead) {
      await handleMarkAsUnread(emailUID);
    } else {
      await handleMarkAsRead(emailUID);
    }
  }
  
  // Email row clicks (mark as read when opened)
  if (e.target.closest('.email-row')) {
    const emailRow = e.target.closest('.email-row');
    const emailUID = emailRow.dataset.emailUid;
    const isRead = emailRow.classList.contains('read');
    
    if (!isRead) {
      await handleMarkAsRead(emailUID);
    }
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
  await realtimeEmail.cleanup();
});

// 📊 Status monitoring (optional)
setInterval(async () => {
  try {
    await realtimeEmail.getRealtimeStatus();
    realtimeEmail.showSyncStatus(realtimeEmail.isRealtimeActive);
  } catch (error) {
    realtimeEmail.showSyncStatus(false, 'Connection error');
  }
}, 30000); // Check every 30 seconds

// Helper functions
function renderEmailsInUI(emailData) {
  // Your existing email rendering logic here
  // Make sure to add data-email-uid attribute to each row
  console.log('Rendering emails with real-time sync active...');
}

function showErrorMessage(message) {
  // Your error notification system
  console.error(message);
}

// Export for use in other modules
window.RealtimeEmailAPI = RealtimeEmailAPI;
window.realtimeEmail = realtimeEmail;