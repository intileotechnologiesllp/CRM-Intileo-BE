# Contact Sync API Documentation

## Overview

The Contact Sync API provides comprehensive two-way synchronization between Google Contacts and your CRM. It supports multiple sync modes, conflict resolution strategies, and maintains complete audit trails of all sync operations.

## Features

- **Two-Way Sync**: Bidirectional synchronization between Google Contacts and CRM
- **One-Way Sync**: Google → CRM or CRM → Google
- **Conflict Resolution**: Automatic resolution using newest timestamp, Google wins, CRM wins, or manual
- **Change Tracking**: Complete audit trail with before/after states
- **Sync History**: Detailed history of all sync operations with statistics
- **OAuth2 Authentication**: Secure Google account connection
- **Auto-Sync**: Schedule automatic synchronization at specified intervals
- **Soft Delete Support**: Mark contacts as deleted without permanent removal

## Base URL

```
/api/contact-sync
```

## Authentication

All endpoints require authentication using JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## OAuth Endpoints

### 1. Get Google Authorization URL

**Endpoint:** `GET /oauth/google/authorize`

**Description:** Get the OAuth URL to authorize access to Google Contacts.

**Request:**
```http
GET /api/contact-sync/oauth/google/authorize
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "message": "Please visit this URL to authorize access to your Google Contacts"
}
```

**Usage Flow:**
1. Call this endpoint to get the authorization URL
2. Redirect user to the `authUrl`
3. User authorizes access
4. Google redirects back to your callback URL with authorization code

---

### 2. Handle OAuth Callback

**Endpoint:** `GET /oauth/google/callback`

**Description:** Exchange authorization code for access tokens and save sync configuration.

**Request:**
```http
GET /api/contact-sync/oauth/google/callback?code=<auth-code>
Authorization: Bearer <token>
```

**Query Parameters:**
- `code` (required): Authorization code from Google OAuth flow

**Response:**
```json
{
  "success": true,
  "message": "Google account connected successfully",
  "syncConfig": {
    "syncConfigId": 1,
    "googleEmail": "user@gmail.com",
    "syncMode": "bidirectional",
    "isActive": true
  }
}
```

---

## Configuration Endpoints

### 3. Get Sync Configuration

**Endpoint:** `GET /config`

**Description:** Get current sync configuration for the authenticated user.

**Request:**
```http
GET /api/contact-sync/config
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "syncConfig": {
    "syncConfigId": 1,
    "masterUserID": 123,
    "provider": "google",
    "googleEmail": "user@gmail.com",
    "isActive": true,
    "syncMode": "bidirectional",
    "syncDirection": "two_way",
    "autoSyncEnabled": false,
    "syncFrequency": null,
    "conflictResolution": "newest_wins",
    "deletionHandling": "soft_delete",
    "fieldMapping": null,
    "lastSyncAt": "2024-01-15T10:30:00Z",
    "nextSyncAt": null,
    "syncStats": {
      "totalSyncs": 5,
      "successfulSyncs": 4,
      "failedSyncs": 1
    }
  }
}
```

---

### 4. Create/Update Sync Configuration

**Endpoint:** `POST /config` or `PUT /config`

**Description:** Create or update sync configuration settings.

**Request:**
```http
POST /api/contact-sync/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "syncMode": "bidirectional",
  "syncDirection": "two_way",
  "autoSyncEnabled": true,
  "syncFrequency": "hourly",
  "conflictResolution": "newest_wins",
  "deletionHandling": "soft_delete",
  "fieldMapping": {
    "customField1": "googleField1"
  }
}
```

**Request Body Parameters:**
- `syncMode` (optional): "google_to_crm", "crm_to_google", or "bidirectional"
- `syncDirection` (optional): "one_way" or "two_way"
- `autoSyncEnabled` (optional): boolean - Enable automatic sync
- `syncFrequency` (optional): "hourly", "daily", "weekly", "monthly"
- `conflictResolution` (optional): "newest_wins", "google_wins", "crm_wins", "manual"
- `deletionHandling` (optional): "soft_delete", "hard_delete", "skip"
- `fieldMapping` (optional): JSON object mapping custom fields

**Response:**
```json
{
  "success": true,
  "message": "Sync configuration updated successfully",
  "syncConfig": {
    "syncConfigId": 1,
    "syncMode": "bidirectional",
    "autoSyncEnabled": true,
    "conflictResolution": "newest_wins"
  }
}
```

---

### 5. Disconnect Google Account

**Endpoint:** `DELETE /config/disconnect`

**Description:** Disconnect Google account and disable sync.

**Request:**
```http
DELETE /api/contact-sync/config/disconnect
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Google account disconnected successfully"
}
```

---

## Sync Operations

### 6. Start Manual Sync

**Endpoint:** `POST /start`

**Description:** Manually trigger a contact sync operation.

**Request:**
```http
POST /api/contact-sync/start
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Contact sync started. This may take a few minutes.",
  "syncConfigId": 1
}
```

**Note:** Sync runs in the background. Use the history endpoints to check progress and results.

---

### 7. Get Sync Statistics

**Endpoint:** `GET /stats`

**Description:** Get overview statistics of recent sync operations.

**Request:**
```http
GET /api/contact-sync/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "syncConfig": {
      "isActive": true,
      "autoSyncEnabled": false,
      "syncMode": "bidirectional",
      "lastSyncAt": "2024-01-15T10:30:00Z",
      "nextSyncAt": null
    },
    "overview": {
      "totalSyncs": 10,
      "completedSyncs": 8,
      "failedSyncs": 2,
      "successRate": 80
    },
    "operations": {
      "totalCreated": 25,
      "totalUpdated": 50,
      "totalDeleted": 5,
      "totalConflicts": 10
    },
    "recentSyncs": [
      {
        "syncHistoryId": 45,
        "status": "completed",
        "startedAt": "2024-01-15T10:30:00Z",
        "duration": 45000,
        "summary": "Created 5 in CRM, updated 10 in Google"
      }
    ]
  }
}
```

---

## History Endpoints

### 8. Get Sync History

**Endpoint:** `GET /history`

**Description:** Get paginated list of sync operations.

**Request:**
```http
GET /api/contact-sync/history?page=1&limit=20
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "syncHistoryId": 45,
      "syncConfigId": 1,
      "masterUserID": 123,
      "status": "completed",
      "startedAt": "2024-01-15T10:30:00Z",
      "completedAt": "2024-01-15T10:31:30Z",
      "duration": 90000,
      "createdInCRM": 5,
      "updatedInCRM": 10,
      "deletedInCRM": 0,
      "createdInGoogle": 3,
      "updatedInGoogle": 8,
      "deletedInGoogle": 0,
      "skipped": 2,
      "conflicts": 4,
      "errors": 0,
      "errorDetails": [],
      "summary": "Sync completed: Created 5 in CRM, updated 10 in CRM, created 3 in Google, updated 8 in Google. Conflicts resolved: 4"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### 9. Get Sync History Details

**Endpoint:** `GET /history/:syncHistoryId`

**Description:** Get detailed information about a specific sync operation.

**Request:**
```http
GET /api/contact-sync/history/45
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "history": {
    "syncHistoryId": 45,
    "syncConfigId": 1,
    "masterUserID": 123,
    "status": "completed",
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:31:30Z",
    "duration": 90000,
    "createdInCRM": 5,
    "updatedInCRM": 10,
    "deletedInCRM": 0,
    "createdInGoogle": 3,
    "updatedInGoogle": 8,
    "deletedInGoogle": 0,
    "skipped": 2,
    "conflicts": 4,
    "errors": 0,
    "errorDetails": [],
    "summary": "Sync completed successfully"
  }
}
```

---

## Change Log Endpoints

### 10. Get Change Logs for Sync

**Endpoint:** `GET /history/:syncHistoryId/changes`

**Description:** Get all contact changes for a specific sync operation.

**Request:**
```http
GET /api/contact-sync/history/45/changes?page=1&limit=50&operation=updated_in_crm
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50)
- `operation` (optional): Filter by operation type
- `changeType` (optional): Filter by change type

**Operation Types:**
- `created_in_crm`
- `updated_in_crm`
- `deleted_in_crm`
- `created_in_google`
- `updated_in_google`
- `deleted_in_google`
- `conflict_resolved`
- `skipped`
- `error`

**Response:**
```json
{
  "success": true,
  "changeLogs": [
    {
      "changeLogId": 123,
      "syncHistoryId": 45,
      "masterUserID": 123,
      "personId": 456,
      "googleContactId": "people/c789",
      "operation": "updated_in_crm",
      "changeType": "update",
      "direction": "google_to_crm",
      "fieldsBefore": {
        "contactPerson": "John Doe",
        "email": "john@example.com",
        "phone": "1234567890"
      },
      "fieldsAfter": {
        "contactPerson": "John Doe",
        "email": "john.doe@example.com",
        "phone": "1234567890"
      },
      "changedFields": ["email"],
      "conflictReason": "Both modified",
      "conflictResolution": "newest_wins",
      "winningSource": "google",
      "crmUpdatedAt": "2024-01-15T09:00:00Z",
      "googleUpdatedAt": "2024-01-15T10:00:00Z",
      "errorMessage": null,
      "createdAt": "2024-01-15T10:30:45Z"
    }
  ],
  "pagination": {
    "total": 28,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

---

### 11. Get Change Logs for Contact

**Endpoint:** `GET /contact/:personId/changes`

**Description:** Get all sync changes for a specific contact.

**Request:**
```http
GET /api/contact-sync/contact/456/changes?page=1&limit=20
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "changeLogs": [
    {
      "changeLogId": 123,
      "syncHistoryId": 45,
      "operation": "updated_in_crm",
      "changeType": "update",
      "direction": "google_to_crm",
      "changedFields": ["email"],
      "createdAt": "2024-01-15T10:30:45Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## Sync Configuration Options

### Sync Modes

- **`bidirectional`**: Full two-way sync between Google and CRM
- **`google_to_crm`**: One-way sync from Google to CRM only
- **`crm_to_google`**: One-way sync from CRM to Google only

### Conflict Resolution Strategies

- **`newest_wins`** (recommended): Uses the most recently updated contact
- **`google_wins`**: Always uses Google Contacts data
- **`crm_wins`**: Always uses CRM data
- **`manual`**: Marks conflicts for manual resolution

### Deletion Handling

- **`soft_delete`** (recommended): Marks as deleted (starred=false in Google)
- **`hard_delete`**: Permanently removes contacts
- **`skip`**: Ignores deletions, keeps contacts in both systems

### Sync Frequency

- **`hourly`**: Sync every hour
- **`daily`**: Sync once per day
- **`weekly`**: Sync once per week
- **`monthly`**: Sync once per month

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message"
}
```

---

## Setup Guide

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google People API**
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://yourdomain.com/api/contact-sync/oauth/google/callback`
5. Copy Client ID and Client Secret

### 2. Environment Variables

Add to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/contact-sync/oauth/google/callback
```

### 3. Database Migration

Run the following SQL files to create required tables:
- Contact Sync Config
- Contact Sync History
- Contact Change Log
- Contact Sync Mapping

### 4. Install Dependencies

```bash
npm install googleapis google-auth-library
```

---

## Usage Example (Frontend)

```javascript
// 1. Connect Google Account
const connectGoogle = async () => {
  const response = await fetch('/api/contact-sync/oauth/google/authorize', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { authUrl } = await response.json();
  window.location.href = authUrl; // Redirect to Google OAuth
};

// 2. Configure Sync (after OAuth callback)
const configureSyn = async () => {
  await fetch('/api/contact-sync/config', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      syncMode: 'bidirectional',
      autoSyncEnabled: true,
      syncFrequency: 'daily',
      conflictResolution: 'newest_wins',
      deletionHandling: 'soft_delete'
    })
  });
};

// 3. Start Manual Sync
const startSync = async () => {
  const response = await fetch('/api/contact-sync/start', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const result = await response.json();
  console.log(result.message); // "Contact sync started..."
};

// 4. Check Sync Status
const checkStatus = async () => {
  const response = await fetch('/api/contact-sync/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { stats } = await response.json();
  console.log(stats.overview); // Recent sync statistics
};

// 5. View Sync History
const viewHistory = async () => {
  const response = await fetch('/api/contact-sync/history?page=1&limit=10', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { history } = await response.json();
  console.log(history); // List of sync operations
};
```

---

## Best Practices

1. **Initial Sync**: Run first sync manually to review results before enabling auto-sync
2. **Conflict Resolution**: Use `newest_wins` for most cases, unless you have a specific preference
3. **Deletion Handling**: Use `soft_delete` to prevent accidental data loss
4. **Monitoring**: Regularly check sync history for errors or conflicts
5. **Field Mapping**: Map custom fields carefully to ensure data consistency
6. **Rate Limits**: Be aware of Google API quotas (default: 90 requests per minute)

---

## Troubleshooting

### Sync Not Starting
- Check OAuth tokens are valid
- Verify sync config is active
- Check Google API quota limits

### Contacts Not Syncing
- Verify field mappings are correct
- Check change logs for errors
- Ensure contacts meet sync criteria

### Conflicts Not Resolving
- Review conflict resolution strategy
- Check timestamps are accurate
- View change logs for conflict details

### Token Expired
- Refresh tokens are automatically renewed
- If still failing, reconnect Google account

---

## Support

For issues or questions:
- Check sync history and change logs for detailed error messages
- Review Google People API documentation
- Contact system administrator

---

## API Version

Current Version: **1.0.0**
Last Updated: **January 2024**
