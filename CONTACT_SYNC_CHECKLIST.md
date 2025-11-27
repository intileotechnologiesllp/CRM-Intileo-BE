# Contact Sync Implementation Checklist

Use this checklist to track your implementation progress.

---

## ✅ Phase 1: Code Integration (COMPLETED)

- [x] Created 4 database models
  - [x] contactSyncConfigModel.js
  - [x] contactSyncHistoryModel.js
  - [x] contactChangeLogModel.js
  - [x] contactSyncMappingModel.js

- [x] Created 2 service files
  - [x] googleContactsService.js (421 lines)
  - [x] contactSyncService.js (817 lines)

- [x] Created API layer
  - [x] contactSyncController.js (560 lines)
  - [x] contactSyncRoutes.js (60 lines)

- [x] Integrated into application
  - [x] Added models to models/index.js
  - [x] Added associations in models/index.js
  - [x] Added routes to app.js
  - [x] Imported required services

- [x] Created documentation
  - [x] CONTACT_SYNC_API_DOCUMENTATION.md
  - [x] CONTACT_SYNC_SETUP_GUIDE.md
  - [x] CONTACT_SYNC_IMPLEMENTATION_SUMMARY.md
  - [x] CONTACT_SYNC_QUICK_REFERENCE.md
  - [x] This checklist file

---

## 📋 Phase 2: Google Cloud Console Setup (TODO)

### 2.1 Create Project
- [ ] Visit [Google Cloud Console](https://console.cloud.google.com)
- [ ] Click "Select a project" → "New Project"
- [ ] Enter project name: "CRM Contact Sync"
- [ ] Click "Create"
- [ ] Wait for project creation to complete

### 2.2 Enable Google People API
- [ ] In the Console, go to "APIs & Services" → "Library"
- [ ] Search for "Google People API"
- [ ] Click on it
- [ ] Click "Enable"
- [ ] Wait for API to be enabled (check green checkmark)

### 2.3 Configure OAuth Consent Screen
- [ ] Go to "APIs & Services" → "OAuth consent screen"
- [ ] Select user type:
  - [ ] "External" (for public apps)
  - [ ] OR "Internal" (for Google Workspace only)
- [ ] Click "Create"
- [ ] Fill in App Information:
  - [ ] App name: (Your CRM Name)
  - [ ] User support email: (Your email)
  - [ ] Developer contact email: (Your email)
- [ ] Click "Save and Continue"
- [ ] Add Scopes:
  - [ ] Click "Add or Remove Scopes"
  - [ ] Search and select: `https://www.googleapis.com/auth/contacts`
  - [ ] Search and select: `https://www.googleapis.com/auth/contacts.readonly`
  - [ ] Click "Update"
  - [ ] Click "Save and Continue"
- [ ] Add Test Users (for External apps):
  - [ ] Click "Add Users"
  - [ ] Enter your Google account email
  - [ ] Click "Add"
  - [ ] Click "Save and Continue"
- [ ] Review summary
- [ ] Click "Back to Dashboard"

### 2.4 Create OAuth 2.0 Credentials
- [ ] Go to "APIs & Services" → "Credentials"
- [ ] Click "Create Credentials" → "OAuth client ID"
- [ ] Select "Web application"
- [ ] Enter name: "CRM Contact Sync Web Client"
- [ ] Authorized JavaScript origins:
  - [ ] Click "Add URI"
  - [ ] Enter: `http://localhost:3000` (dev)
  - [ ] Click "Add URI" again
  - [ ] Enter: `https://yourdomain.com` (prod - if ready)
- [ ] Authorized redirect URIs:
  - [ ] Click "Add URI"
  - [ ] Enter: `http://localhost:3000/api/contact-sync/oauth/google/callback`
  - [ ] Click "Add URI" again (if prod ready)
  - [ ] Enter: `https://yourdomain.com/api/contact-sync/oauth/google/callback`
- [ ] Click "Create"
- [ ] **IMPORTANT:** Copy credentials:
  - [ ] Copy "Client ID" → Save to notes
  - [ ] Copy "Client Secret" → Save to notes
  - [ ] Keep this window open for next step

---

## ⚙️ Phase 3: Environment Configuration (TODO)

### 3.1 Update .env File
- [ ] Open your `.env` file
- [ ] Add the following lines:
  ```env
  GOOGLE_CLIENT_ID=paste-your-client-id-here
  GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
  GOOGLE_REDIRECT_URI=http://localhost:3000/api/contact-sync/oauth/google/callback
  ```
- [ ] Replace `paste-your-client-id-here` with actual Client ID
- [ ] Replace `paste-your-client-secret-here` with actual Client Secret
- [ ] Verify no extra spaces or quotes
- [ ] Save the file

### 3.2 Verify Configuration
- [ ] Create test file: `test-env.js`
  ```javascript
  require('dotenv').config();
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.log('Redirect URI:', process.env.GOOGLE_REDIRECT_URI || '✗ Missing');
  ```
- [ ] Run: `node test-env.js`
- [ ] Verify all three show "✓ Set"
- [ ] Delete test file

---

## 📦 Phase 4: Install Dependencies (TODO)

### 4.1 Install Required Packages
- [ ] Open terminal in project root
- [ ] Run: `npm install googleapis google-auth-library`
- [ ] Wait for installation to complete
- [ ] Verify no errors in output

### 4.2 Verify Installation
- [ ] Run: `npm list googleapis`
- [ ] Verify version shown (should be latest)
- [ ] Run: `npm list google-auth-library`
- [ ] Verify version shown (should be latest)

---

## 🗄️ Phase 5: Database Setup (TODO)

### 5.1 Verify Database Connection
- [ ] Start your database server (PostgreSQL/MySQL)
- [ ] Verify connection in `.env`:
  - [ ] DB_HOST is correct
  - [ ] DB_PORT is correct
  - [ ] DB_NAME is correct
  - [ ] DB_USER is correct
  - [ ] DB_PASSWORD is correct
- [ ] Test connection: `npm start` (check for connection success)

### 5.2 Create Tables
- [ ] Option A: Auto-sync with Sequelize
  - [ ] Ensure Sequelize sync is enabled in your app
  - [ ] Start application: `npm start`
  - [ ] Check logs for "Table created" messages
  - [ ] Verify 4 new tables created
- [ ] Option B: Manual SQL
  - [ ] Open SQL client
  - [ ] Run SQL from CONTACT_SYNC_SETUP_GUIDE.md
  - [ ] Verify 4 tables created:
    - [ ] contactSyncConfig
    - [ ] contactSyncHistory
    - [ ] contactChangeLog
    - [ ] contactSyncMapping

### 5.3 Verify Table Structure
- [ ] Query database:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name LIKE 'contact%';
  ```
- [ ] Should see 4 tables listed
- [ ] Check indexes:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename LIKE 'contact%';
  ```
- [ ] Should see multiple indexes

---

## 🧪 Phase 6: Testing (TODO)

### 6.1 Start Application
- [ ] Run: `npm start`
- [ ] Verify no errors in console
- [ ] Check application is listening on port
- [ ] Verify database connection successful

### 6.2 Test OAuth Flow
- [ ] Get JWT token for testing (login to your CRM)
- [ ] Save token to environment variable:
  ```bash
  export TOKEN="your-jwt-token-here"
  ```
- [ ] Get authorization URL:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/oauth/google/authorize
  ```
- [ ] Copy the `authUrl` from response
- [ ] Open URL in browser
- [ ] Sign in with Google account (should be in test users list)
- [ ] Click "Allow" to authorize
- [ ] Should redirect back to your callback URL
- [ ] Check for success message
- [ ] Verify sync config created:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/config
  ```
- [ ] Should see configuration with your Google email

### 6.3 Test Configuration Update
- [ ] Update sync settings:
  ```bash
  curl -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"syncMode":"bidirectional","conflictResolution":"newest_wins"}' \
    http://localhost:3000/api/contact-sync/config
  ```
- [ ] Verify success response
- [ ] Check settings were updated:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/config
  ```

### 6.4 Test Manual Sync
- [ ] Ensure you have contacts in Google or CRM
- [ ] Start sync:
  ```bash
  curl -X POST \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/start
  ```
- [ ] Should see "Contact sync started" message
- [ ] Wait 30-60 seconds for sync to complete
- [ ] Check sync statistics:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/stats
  ```
- [ ] Verify sync completed successfully
- [ ] Check counts: createdInCRM, updatedInCRM, etc.

### 6.5 Verify Sync Results
- [ ] Check sync history:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/history
  ```
- [ ] Should see recent sync with status "completed"
- [ ] Get sync details (replace 1 with actual syncHistoryId):
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/history/1
  ```
- [ ] Verify statistics are accurate

### 6.6 Check Change Logs
- [ ] Get change logs for sync (replace 1 with syncHistoryId):
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/history/1/changes
  ```
- [ ] Should see list of contact changes
- [ ] Verify operations: created_in_crm, updated_in_crm, etc.
- [ ] Check before/after states in logs

### 6.7 Verify Data Sync
- [ ] Check database for new contacts:
  ```sql
  SELECT * FROM persons ORDER BY createdAt DESC LIMIT 10;
  ```
- [ ] Check mappings were created:
  ```sql
  SELECT * FROM contactSyncMapping ORDER BY createdAt DESC LIMIT 10;
  ```
- [ ] Verify personId and googleContactId are linked
- [ ] Check Google Contacts web interface
- [ ] Verify CRM contacts appear in Google

### 6.8 Test Conflict Resolution
- [ ] Modify a contact in Google Contacts
- [ ] Modify the same contact in CRM (different field value)
- [ ] Trigger sync:
  ```bash
  curl -X POST \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/api/contact-sync/start
  ```
- [ ] Wait for completion
- [ ] Check change logs:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3000/api/contact-sync/history/2/changes?operation=conflict_resolved"
  ```
- [ ] Verify conflict was detected and resolved
- [ ] Check winning source matches strategy (newest_wins)

### 6.9 Test Deletion Sync
- [ ] Delete a contact in Google Contacts
- [ ] Trigger sync
- [ ] Check CRM - contact should be marked deleted (soft delete)
- [ ] Check mapping:
  ```sql
  SELECT * FROM contactSyncMapping WHERE isDeleted = true;
  ```
- [ ] Verify isDeleted = true

### 6.10 Test Error Handling
- [ ] Disconnect internet temporarily
- [ ] Trigger sync
- [ ] Should see error in history with status "failed"
- [ ] Reconnect internet
- [ ] Trigger sync again
- [ ] Should succeed

---

## 🎨 Phase 7: Frontend Integration (TODO)

### 7.1 Create OAuth Connection Page
- [ ] Create component: `GoogleContactSync.jsx`
- [ ] Add "Connect Google" button
- [ ] Implement OAuth flow:
  - [ ] Fetch auth URL from API
  - [ ] Open popup or redirect to Google
  - [ ] Handle callback redirect
  - [ ] Display success message
- [ ] Test connection flow end-to-end

### 7.2 Create Sync Configuration Form
- [ ] Create component: `SyncSettingsForm.jsx`
- [ ] Add form fields:
  - [ ] Sync Mode dropdown (bidirectional/one-way)
  - [ ] Conflict Resolution dropdown
  - [ ] Deletion Handling dropdown
  - [ ] Auto-sync toggle
  - [ ] Sync Frequency dropdown (if auto-sync enabled)
- [ ] Implement save functionality
- [ ] Load existing configuration on mount
- [ ] Show success/error messages

### 7.3 Create Sync Control Panel
- [ ] Create component: `SyncControlPanel.jsx`
- [ ] Add "Start Sync" button
- [ ] Show sync status (in progress/completed/failed)
- [ ] Display progress indicator during sync
- [ ] Poll for status updates every 5 seconds
- [ ] Show last sync time
- [ ] Display quick statistics (created/updated/deleted)

### 7.4 Create Sync History Page
- [ ] Create component: `SyncHistory.jsx`
- [ ] Display table of sync operations:
  - [ ] Sync date/time
  - [ ] Status (with colored badge)
  - [ ] Duration
  - [ ] Statistics summary
  - [ ] View details button
- [ ] Implement pagination
- [ ] Add filters (status, date range)
- [ ] Add refresh button

### 7.5 Create Change Logs Viewer
- [ ] Create component: `ChangeLogsViewer.jsx`
- [ ] Display table of contact changes:
  - [ ] Contact name
  - [ ] Operation type (created/updated/deleted)
  - [ ] Changed fields
  - [ ] Timestamp
  - [ ] View details button
- [ ] Implement modal for before/after comparison
- [ ] Add filters (operation type, date range)
- [ ] Implement pagination

### 7.6 Create Statistics Dashboard
- [ ] Create component: `SyncStatsDashboard.jsx`
- [ ] Display cards:
  - [ ] Total syncs
  - [ ] Success rate
  - [ ] Total contacts synced
  - [ ] Conflicts resolved
- [ ] Add charts (optional):
  - [ ] Sync operations over time (line chart)
  - [ ] Operations breakdown (pie chart)
  - [ ] Success vs failures (bar chart)

### 7.7 Add Navigation & Integration
- [ ] Add menu item: "Contact Sync" in settings
- [ ] Create route: `/settings/contact-sync`
- [ ] Create route: `/settings/contact-sync/history`
- [ ] Create route: `/settings/contact-sync/logs/:syncHistoryId`
- [ ] Test navigation between pages
- [ ] Add breadcrumbs for clarity

---

## 🚀 Phase 8: Production Deployment (TODO)

### 8.1 Update Google Cloud Console for Production
- [ ] Go to OAuth 2.0 Client credentials
- [ ] Add production redirect URI:
  - [ ] `https://yourdomain.com/api/contact-sync/oauth/google/callback`
- [ ] Add production JavaScript origin:
  - [ ] `https://yourdomain.com`
- [ ] Save changes
- [ ] Publish OAuth consent screen (if External):
  - [ ] Go to OAuth consent screen
  - [ ] Click "Publish App"
  - [ ] Confirm publishing

### 8.2 Update Production Environment Variables
- [ ] SSH into production server
- [ ] Edit `.env` file
- [ ] Update variables:
  ```env
  GOOGLE_CLIENT_ID=production-client-id
  GOOGLE_CLIENT_SECRET=production-client-secret
  GOOGLE_REDIRECT_URI=https://yourdomain.com/api/contact-sync/oauth/google/callback
  ```
- [ ] Verify HTTPS is enabled
- [ ] Save changes

### 8.3 Deploy Code
- [ ] Commit all changes to git
- [ ] Push to production branch
- [ ] Deploy using your deployment method:
  - [ ] PM2 restart
  - [ ] Docker rebuild
  - [ ] Kubernetes rollout
  - [ ] etc.
- [ ] Monitor deployment logs for errors

### 8.4 Run Database Migrations
- [ ] Connect to production database
- [ ] Run Sequelize sync or manual SQL
- [ ] Verify 4 tables created
- [ ] Check indexes created
- [ ] Verify foreign keys

### 8.5 Test Production OAuth
- [ ] Visit production CRM
- [ ] Navigate to Contact Sync settings
- [ ] Click "Connect Google Account"
- [ ] Authorize with Google
- [ ] Verify redirect back to CRM
- [ ] Check configuration saved
- [ ] Trigger test sync
- [ ] Verify sync completed successfully

### 8.6 Setup Monitoring
- [ ] Configure error logging (Sentry, LogRocket, etc.)
- [ ] Set up uptime monitoring
- [ ] Create alerts for:
  - [ ] Sync failures
  - [ ] API quota warnings
  - [ ] Token refresh failures
- [ ] Set up database backup schedule
- [ ] Configure log rotation

### 8.7 Performance Optimization
- [ ] Add database indexes if needed
- [ ] Enable query logging temporarily
- [ ] Identify slow queries
- [ ] Optimize N+1 queries
- [ ] Add caching where appropriate
- [ ] Test with large datasets (1000+ contacts)

---

## 🔄 Phase 9: Auto-Sync Setup (OPTIONAL)

### 9.1 Create Scheduler Script
- [ ] Create file: `utils/contactSyncScheduler.js`
- [ ] Implement cron job for hourly sync
- [ ] Add logic to fetch active sync configs
- [ ] Implement sync frequency check
- [ ] Add error handling and logging

### 9.2 Integrate Scheduler
- [ ] Import scheduler in `app.js`
- [ ] Initialize on app startup
- [ ] Test hourly trigger
- [ ] Monitor logs for scheduled syncs

### 9.3 Test Auto-Sync
- [ ] Enable auto-sync for test user
- [ ] Set frequency to "hourly"
- [ ] Wait for next hour
- [ ] Check logs for scheduled sync
- [ ] Verify sync completed
- [ ] Check sync history

---

## 📊 Phase 10: Monitoring & Maintenance (ONGOING)

### 10.1 Daily Checks
- [ ] Review error logs
- [ ] Check sync success rate
- [ ] Monitor Google API quota usage
- [ ] Review any reported issues

### 10.2 Weekly Reviews
- [ ] Analyze sync statistics
- [ ] Review conflict patterns
- [ ] Check for performance issues
- [ ] Review user feedback

### 10.3 Monthly Maintenance
- [ ] Archive old sync history (>90 days)
- [ ] Review and optimize database indexes
- [ ] Check for API updates from Google
- [ ] Update dependencies if needed
- [ ] Review security best practices

---

## 🎯 Success Criteria

### Minimum Viable Product (MVP)
- [ ] OAuth connection works
- [ ] Manual sync completes successfully
- [ ] Contacts created in both directions
- [ ] Updates sync correctly
- [ ] Conflicts resolved automatically
- [ ] Change logs tracked accurately
- [ ] Basic frontend UI functional

### Full Feature Set
- [ ] Auto-sync working on schedule
- [ ] All configuration options functional
- [ ] Comprehensive error handling
- [ ] Production monitoring in place
- [ ] Performance optimized for 1000+ contacts
- [ ] User documentation provided
- [ ] Support procedures documented

---

## 📝 Notes & Issues

Use this section to track any issues or notes during implementation:

```
Date: ___________
Issue: 
Solution:

Date: ___________
Issue:
Solution:

Date: ___________
Issue:
Solution:
```

---

## ✅ Final Sign-Off

- [ ] All phases completed
- [ ] Production deployment successful
- [ ] Testing completed with real data
- [ ] Documentation reviewed and accurate
- [ ] Team trained on system
- [ ] Support procedures in place
- [ ] Monitoring and alerts configured

**Implementation completed by:** ___________________

**Date:** ___________________

**Sign-off:** ___________________

---

## 📚 Reference Documents

- CONTACT_SYNC_API_DOCUMENTATION.md - Complete API reference
- CONTACT_SYNC_SETUP_GUIDE.md - Detailed setup instructions
- CONTACT_SYNC_IMPLEMENTATION_SUMMARY.md - Technical overview
- CONTACT_SYNC_QUICK_REFERENCE.md - Quick commands and tips

---

**Good luck with your implementation!** 🚀

If you encounter issues, refer to the troubleshooting sections in the documentation files.
