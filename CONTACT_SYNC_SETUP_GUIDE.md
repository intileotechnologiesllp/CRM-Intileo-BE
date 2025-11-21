# Contact Sync Setup Guide

## Prerequisites

1. Node.js and npm installed
2. PostgreSQL/MySQL database running
3. Google Cloud Console account
4. Existing CRM application

---

## Step 1: Google Cloud Console Setup

### 1.1 Create Project

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter project name: "CRM Contact Sync"
4. Click "Create"

### 1.2 Enable Google People API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google People API"
3. Click on it and click "Enable"
4. Wait for API to be enabled

### 1.3 Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (or Internal for Google Workspace)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Your CRM Name
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click "Save and Continue"
6. **Scopes**: Click "Add or Remove Scopes"
   - Search and add: `https://www.googleapis.com/auth/contacts`
   - Search and add: `https://www.googleapis.com/auth/contacts.readonly`
   - Click "Update"
7. Click "Save and Continue"
8. **Test users** (for External apps in testing):
   - Add your Google account email
   - Click "Add"
9. Click "Save and Continue"

### 1.4 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Enter name: "CRM Contact Sync Web Client"
5. **Authorized JavaScript origins**:
   - Add: `http://localhost:3000` (for development)
   - Add: `https://yourdomain.com` (for production)
6. **Authorized redirect URIs**:
   - Add: `http://localhost:3000/api/contact-sync/oauth/google/callback` (dev)
   - Add: `https://yourdomain.com/api/contact-sync/oauth/google/callback` (prod)
7. Click "Create"
8. **Save the credentials**:
   - Copy the **Client ID**
   - Copy the **Client Secret**
   - Store them securely

---

## Step 2: Database Setup

### 2.1 Create Database Tables

The models will auto-create tables via Sequelize sync, but you can manually create them:

```sql
-- Contact Sync Config Table
CREATE TABLE IF NOT EXISTS contactSyncConfig (
  syncConfigId SERIAL PRIMARY KEY,
  masterUserID INTEGER NOT NULL REFERENCES masterUsers(masterUserID),
  provider VARCHAR(50) DEFAULT 'google',
  googleEmail VARCHAR(255),
  googleAccessToken TEXT,
  googleRefreshToken TEXT,
  googleTokenExpiry TIMESTAMP,
  outlookEmail VARCHAR(255),
  outlookAccessToken TEXT,
  outlookRefreshToken TEXT,
  outlookTokenExpiry TIMESTAMP,
  isActive BOOLEAN DEFAULT true,
  syncMode VARCHAR(50) DEFAULT 'bidirectional',
  syncDirection VARCHAR(50) DEFAULT 'two_way',
  autoSyncEnabled BOOLEAN DEFAULT false,
  syncFrequency VARCHAR(50),
  lastSyncAt TIMESTAMP,
  nextSyncAt TIMESTAMP,
  conflictResolution VARCHAR(50) DEFAULT 'newest_wins',
  deletionHandling VARCHAR(50) DEFAULT 'soft_delete',
  fieldMapping JSONB,
  syncStats JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(masterUserID, provider)
);

-- Contact Sync History Table
CREATE TABLE IF NOT EXISTS contactSyncHistory (
  syncHistoryId SERIAL PRIMARY KEY,
  syncConfigId INTEGER NOT NULL REFERENCES contactSyncConfig(syncConfigId),
  masterUserID INTEGER NOT NULL REFERENCES masterUsers(masterUserID),
  status VARCHAR(50) DEFAULT 'in_progress',
  startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completedAt TIMESTAMP,
  duration INTEGER,
  createdInCRM INTEGER DEFAULT 0,
  updatedInCRM INTEGER DEFAULT 0,
  deletedInCRM INTEGER DEFAULT 0,
  createdInGoogle INTEGER DEFAULT 0,
  updatedInGoogle INTEGER DEFAULT 0,
  deletedInGoogle INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  conflicts INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  errorDetails JSONB,
  summary TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sync_history_config ON contactSyncHistory(syncConfigId);
CREATE INDEX idx_sync_history_user ON contactSyncHistory(masterUserID);
CREATE INDEX idx_sync_history_status ON contactSyncHistory(status);
CREATE INDEX idx_sync_history_started ON contactSyncHistory(startedAt);

-- Contact Change Log Table
CREATE TABLE IF NOT EXISTS contactChangeLog (
  changeLogId SERIAL PRIMARY KEY,
  syncHistoryId INTEGER NOT NULL REFERENCES contactSyncHistory(syncHistoryId),
  masterUserID INTEGER NOT NULL REFERENCES masterUsers(masterUserID),
  personId INTEGER REFERENCES persons(personId),
  googleContactId VARCHAR(255),
  operation VARCHAR(100),
  changeType VARCHAR(50),
  direction VARCHAR(50),
  fieldsBefore JSONB,
  fieldsAfter JSONB,
  changedFields JSONB,
  conflictReason TEXT,
  conflictResolution VARCHAR(50),
  winningSource VARCHAR(50),
  crmUpdatedAt TIMESTAMP,
  googleUpdatedAt TIMESTAMP,
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_change_log_history ON contactChangeLog(syncHistoryId);
CREATE INDEX idx_change_log_person ON contactChangeLog(personId);
CREATE INDEX idx_change_log_google ON contactChangeLog(googleContactId);
CREATE INDEX idx_change_log_operation ON contactChangeLog(operation);
CREATE INDEX idx_change_log_type ON contactChangeLog(changeType);

-- Contact Sync Mapping Table
CREATE TABLE IF NOT EXISTS contactSyncMapping (
  mappingId SERIAL PRIMARY KEY,
  masterUserID INTEGER NOT NULL REFERENCES masterUsers(masterUserID),
  personId INTEGER NOT NULL REFERENCES persons(personId),
  googleContactId VARCHAR(255) UNIQUE,
  googleResourceName VARCHAR(255),
  googleEtag VARCHAR(255),
  lastSyncedAt TIMESTAMP,
  crmUpdatedAt TIMESTAMP,
  googleUpdatedAt TIMESTAMP,
  syncStatus VARCHAR(50) DEFAULT 'synced',
  isDeleted BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(masterUserID, personId)
);

CREATE INDEX idx_mapping_user ON contactSyncMapping(masterUserID);
CREATE INDEX idx_mapping_person ON contactSyncMapping(personId);
CREATE INDEX idx_mapping_google ON contactSyncMapping(googleContactId);
```

### 2.2 Verify Person Table

Ensure your `persons` table has these columns:
- `personId` (primary key)
- `masterUserID` (foreign key)
- `contactPerson` (name)
- `email`
- `phone`
- `postalAddress`
- `organization`
- `jobTitle`
- `notes`
- `updatedAt` (timestamp for conflict resolution)
- `createdAt`

---

## Step 3: Environment Configuration

### 3.1 Add to .env File

Add the following variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-from-step-1.4
GOOGLE_CLIENT_SECRET=your-client-secret-from-step-1.4
GOOGLE_REDIRECT_URI=http://localhost:3000/api/contact-sync/oauth/google/callback

# For Production
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/contact-sync/oauth/google/callback

# Database Configuration (if not already set)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_crm_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Application Configuration
FRONTEND_URL=http://localhost:3001
JWT_SECRET=your-jwt-secret
```

### 3.2 Verify Environment Variables

Create a test file to verify configuration:

```javascript
// test-config.js
require('dotenv').config();

console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
console.log('Google Redirect URI:', process.env.GOOGLE_REDIRECT_URI || '✗ Missing');
```

Run: `node test-config.js`

---

## Step 4: Install Dependencies

### 4.1 Install Required Packages

```bash
npm install googleapis google-auth-library
```

### 4.2 Verify Installation

```bash
npm list googleapis google-auth-library
```

---

## Step 5: Initialize Models

### 5.1 Update models/index.js

Add the new models to your Sequelize initialization:

```javascript
// models/index.js
const ContactSyncConfig = require('./contact/contactSyncConfigModel');
const ContactSyncHistory = require('./contact/contactSyncHistoryModel');
const ContactChangeLog = require('./contact/contactChangeLogModel');
const ContactSyncMapping = require('./contact/contactSyncMappingModel');

// Define associations
ContactSyncConfig.hasMany(ContactSyncHistory, { 
  foreignKey: 'syncConfigId',
  onDelete: 'CASCADE'
});
ContactSyncHistory.belongsTo(ContactSyncConfig, { 
  foreignKey: 'syncConfigId' 
});

ContactSyncHistory.hasMany(ContactChangeLog, { 
  foreignKey: 'syncHistoryId',
  onDelete: 'CASCADE'
});
ContactChangeLog.belongsTo(ContactSyncHistory, { 
  foreignKey: 'syncHistoryId' 
});

module.exports = {
  // ... existing models
  ContactSyncConfig,
  ContactSyncHistory,
  ContactChangeLog,
  ContactSyncMapping
};
```

### 5.2 Sync Database

Run your application to auto-create tables:

```bash
npm start
```

Or use Sequelize sync in your app initialization:

```javascript
// In your main app file
sequelize.sync({ alter: true })
  .then(() => console.log('Database synced'))
  .catch(err => console.error('Sync error:', err));
```

---

## Step 6: Test the Setup

### 6.1 Start the Application

```bash
npm start
```

### 6.2 Test OAuth Flow

1. Make a GET request to get auth URL:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/contact-sync/oauth/google/authorize
```

2. Visit the returned `authUrl` in your browser
3. Authorize the application
4. You should be redirected to your callback URL
5. Check if sync configuration was created

### 6.3 Test Manual Sync

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/contact-sync/start
```

### 6.4 Check Sync Status

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/contact-sync/stats
```

---

## Step 7: Frontend Integration

### 7.1 Create OAuth Popup (Recommended)

```javascript
// frontend/src/components/GoogleContactSync.jsx
import React, { useState } from 'react';

const GoogleContactSync = () => {
  const [syncing, setSyncing] = useState(false);

  const connectGoogle = async () => {
    try {
      const response = await fetch('/api/contact-sync/oauth/google/authorize', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const { authUrl } = await response.json();
      
      // Open in popup
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const popup = window.open(
        authUrl,
        'Google Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // Listen for callback
      window.addEventListener('message', (event) => {
        if (event.data.type === 'google-auth-success') {
          console.log('Google connected!');
          popup.close();
          loadSyncConfig();
        }
      });
    } catch (error) {
      console.error('Failed to connect Google:', error);
    }
  };

  const startSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/contact-sync/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();
      alert(result.message);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <h2>Google Contacts Sync</h2>
      <button onClick={connectGoogle}>Connect Google Account</button>
      <button onClick={startSync} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Start Sync'}
      </button>
    </div>
  );
};

export default GoogleContactSync;
```

### 7.2 OAuth Callback Page

```javascript
// frontend/src/pages/GoogleCallback.jsx
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleCallback(code);
    }
  }, [searchParams]);

  const handleCallback = async (code) => {
    try {
      const response = await fetch(
        `/api/contact-sync/oauth/google/callback?code=${code}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      const result = await response.json();
      
      if (result.success) {
        // Notify parent window (if popup)
        if (window.opener) {
          window.opener.postMessage({ type: 'google-auth-success' }, '*');
        } else {
          // Redirect to settings page
          window.location.href = '/settings/contact-sync';
        }
      }
    } catch (error) {
      console.error('Callback failed:', error);
      alert('Failed to connect Google account');
    }
  };

  return <div>Connecting Google account...</div>;
};

export default GoogleCallback;
```

---

## Step 8: Production Deployment

### 8.1 Update Environment Variables

```env
GOOGLE_CLIENT_ID=your-production-client-id
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/contact-sync/oauth/google/callback
```

### 8.2 Update Google Cloud Console

1. Go to OAuth 2.0 Client credentials
2. Add production redirect URI
3. Add production JavaScript origins
4. Verify OAuth consent screen is published

### 8.3 SSL/HTTPS Configuration

Ensure your production server uses HTTPS:
- Google OAuth requires HTTPS for production
- Update redirect URI to use `https://`

### 8.4 Enable Auto-Sync (Optional)

Create a cron job or scheduler:

```javascript
// utils/contactSyncScheduler.js
const cron = require('node-cron');
const contactSyncService = require('../services/contactSyncService');
const ContactSyncConfig = require('../models/contact/contactSyncConfigModel');

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled contact sync...');
  
  try {
    const configs = await ContactSyncConfig.findAll({
      where: { 
        isActive: true, 
        autoSyncEnabled: true,
        syncFrequency: 'hourly'
      }
    });

    for (const config of configs) {
      await contactSyncService.performSync(
        config.masterUserID, 
        config.syncConfigId
      );
    }
  } catch (error) {
    console.error('Scheduled sync failed:', error);
  }
});
```

---

## Troubleshooting

### Issue: "Redirect URI mismatch"

**Solution:**
1. Check Google Cloud Console → Credentials
2. Ensure redirect URI exactly matches `.env` file
3. Include the protocol (`http://` or `https://`)
4. No trailing slashes

### Issue: "Invalid token" or "Token expired"

**Solution:**
- Tokens are automatically refreshed
- If issue persists, disconnect and reconnect Google account
- Check `googleRefreshToken` is saved in database

### Issue: "API quota exceeded"

**Solution:**
1. Go to Google Cloud Console → APIs & Services → Quotas
2. Check current usage
3. Request quota increase if needed
4. Default: 90 requests per minute per user

### Issue: "Contacts not syncing"

**Solution:**
1. Check sync history for errors: `GET /api/contact-sync/history`
2. View change logs: `GET /api/contact-sync/history/:id/changes`
3. Verify field mappings are correct
4. Ensure `updatedAt` timestamps exist on contacts

### Issue: Database connection errors

**Solution:**
1. Verify database credentials in `.env`
2. Check database server is running
3. Ensure tables are created (run migrations)
4. Check Sequelize connection logs

---

## Security Considerations

1. **Never commit** `.env` file to version control
2. **Store tokens** securely in database (encrypted if possible)
3. **Use HTTPS** in production
4. **Validate** all user inputs
5. **Rate limit** API endpoints
6. **Monitor** sync operations for suspicious activity
7. **Rotate** OAuth credentials periodically
8. **Implement** proper error logging (don't expose sensitive data)

---

## Next Steps

1. ✅ Complete setup steps 1-7
2. Test sync with a few contacts first
3. Review sync history and change logs
4. Configure conflict resolution strategy
5. Enable auto-sync once confident
6. Build frontend UI for sync management
7. Add email notifications for sync failures
8. Implement webhooks for real-time sync (optional)

---

## Support

For issues:
1. Check application logs
2. Review sync history: `/api/contact-sync/history`
3. Check Google Cloud Console logs
4. Verify environment variables are correct
5. Consult Google People API documentation

---

**Setup Complete!** 🎉

Your contact sync system is now ready to use. Start by connecting a Google account and running a manual sync.
