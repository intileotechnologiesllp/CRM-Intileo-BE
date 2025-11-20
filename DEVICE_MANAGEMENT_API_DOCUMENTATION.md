# Device Management & Remote Logout - API Documentation

## Overview
This feature allows users to view all devices where they are logged in and remotely logout from any device. Similar to Pipedrive, Google, or Facebook's device management.

---

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## API Endpoints

### 1. Get Active Sessions (Devices)
**Endpoint:** `GET /api/user-sessions/active`

**Description:** Get all active login sessions for the current user across all devices.

**Response:**
```json
{
  "success": true,
  "message": "Active sessions retrieved successfully",
  "data": {
    "totalActiveSessions": 2,
    "sessions": [
      {
        "sessionId": 123,
        "device": "Chrome, Windows",
        "location": "Gurugram, India",
        "ipAddress": "122.176.136.58",
        "loginTime": "2025-11-20T09:39:00.000Z",
        "loginTimeFormatted": "November 20, 2025 9:39 AM",
        "isCurrentDevice": true,
        "loginVia": "password"
      },
      {
        "sessionId": 124,
        "device": "Chrome, Windows",
        "location": "Agra, India",
        "ipAddress": "122.176.136.59",
        "loginTime": "2025-11-20T09:40:00.000Z",
        "loginTimeFormatted": "November 20, 2025 9:40 AM",
        "isCurrentDevice": false,
        "loginVia": "password"
      }
    ]
  }
}
```

**Usage:**
```bash
curl -X GET http://localhost:3000/api/user-sessions/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2. Get Device History (Last 60 Days)
**Endpoint:** `GET /api/user-sessions/history`

**Description:** Get login history for the last 60 days with pagination.

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 50) - Results per page

**Response:**
```json
{
  "success": true,
  "message": "Session history retrieved successfully",
  "data": {
    "totalSessions": 150,
    "currentPage": 1,
    "totalPages": 3,
    "sessionsPerPage": 50,
    "sessions": [
      {
        "sessionId": 122,
        "device": "Chrome, Windows",
        "location": "Gurugram, India",
        "ipAddress": "122.176.136.58",
        "loginTime": "2025-11-19T18:12:00.000Z",
        "loginTimeFormatted": "November 19, 2025 6:12 PM",
        "logoutTime": "2025-11-20T06:12:00.000Z",
        "logoutTimeFormatted": "November 20, 2025 6:12 AM",
        "duration": "12 hours 0 minutes",
        "loginVia": "password",
        "logoutReason": "login expired after 12 hours",
        "isActive": false
      }
    ]
  }
}
```

**Usage:**
```bash
curl -X GET "http://localhost:3000/api/user-sessions/history?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. Logout from Specific Device
**Endpoint:** `POST /api/user-sessions/logout/:sessionId`

**Description:** Logout from a specific device/session. Cannot logout from current device.

**URL Parameters:**
- `sessionId` (required) - The session ID to logout

**Response:**
```json
{
  "success": true,
  "message": "Session logged out successfully",
  "data": {
    "sessionId": 124,
    "device": "Chrome, Windows",
    "location": "Agra, India",
    "loggedOutAt": "2025-11-20 15:30:45"
  }
}
```

**Error Response (trying to logout current session):**
```json
{
  "success": false,
  "message": "Cannot logout current session. Use the regular logout endpoint instead."
}
```

**Usage:**
```bash
curl -X POST http://localhost:3000/api/user-sessions/logout/124 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Logout from All Other Devices
**Endpoint:** `POST /api/user-sessions/logout-all-others`

**Description:** Logout from all devices except the current one.

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out from 3 other device(s)",
  "data": {
    "loggedOutSessions": 3,
    "currentSessionId": 123,
    "loggedOutAt": "2025-11-20 15:35:20"
  }
}
```

**Usage:**
```bash
curl -X POST http://localhost:3000/api/user-sessions/logout-all-others \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Export Session History to CSV
**Endpoint:** `GET /api/user-sessions/export`

**Description:** Export device login history (last 60 days) as CSV file.

**Response:** CSV file download with columns:
- Device
- Location
- IP Address
- Login Time
- Logout Time
- Duration
- Status

**Usage:**
```bash
curl -X GET http://localhost:3000/api/user-sessions/export \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o session-history.csv
```

---

## How It Works

### 1. Login Flow
When a user logs in:
1. A new `LoginHistory` record is created with `isActive: true`
2. Device info (browser, OS), location (city, country), and IP address are captured
3. JWT token includes the `sessionId` (LoginHistory.id)
4. Token is sent to the client

### 2. Session Validation (Middleware)
On every authenticated API call:
1. JWT token is decoded to extract `sessionId`
2. Database is checked to verify session is still active
3. If `isActive = false` or `logoutTime` exists, request is rejected with 401
4. User sees: "Your session has been logged out from another device"

### 3. Remote Logout
When user clicks "Log out" on another device:
1. API finds that specific session by `sessionId`
2. Updates: `isActive = false`, `logoutTime = NOW()`, calculates `duration`
3. Next time that device makes an API call, middleware rejects it (401)
4. User is automatically logged out on that device

### 4. Regular Logout
When user clicks logout on current device:
1. Uses existing `/api/logout` endpoint
2. Updates current session: `isActive = false`, `logoutTime = NOW()`
3. Token becomes invalid

---

## Frontend Integration Guide

### Active Devices Page
```javascript
// Fetch active sessions
const response = await fetch('/api/user-sessions/active', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

// Display sessions
data.data.sessions.forEach(session => {
  if (session.isCurrentDevice) {
    // Show "THIS DEVICE" badge
  }
  // Add "Log out" button for other devices
});
```

### Logout from Device
```javascript
async function logoutDevice(sessionId) {
  const response = await fetch(`/api/user-sessions/logout/${sessionId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.ok) {
    // Refresh active sessions list
    alert('Device logged out successfully');
  }
}
```

### Logout from All Others
```javascript
async function logoutAllOthers() {
  const response = await fetch('/api/user-sessions/logout-all-others', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const result = await response.json();
  alert(`Logged out from ${result.data.loggedOutSessions} device(s)`);
}
```

### Handle Session Expired
```javascript
// In your API interceptor
if (response.status === 401 && response.data.sessionExpired) {
  // Show message: "You've been logged out from another device"
  localStorage.removeItem('token');
  window.location.href = '/login';
}
```

---

## Testing Scenarios

### Test 1: View Active Sessions
1. Login from Chrome on Windows
2. Login from Firefox on same machine (different browser = different device)
3. Call `GET /api/user-sessions/active`
4. Verify 2 sessions appear

### Test 2: Remote Logout
1. Login from 2 devices (get both tokens)
2. From Device A, call `POST /api/user-sessions/logout/:sessionId` with Device B's sessionId
3. Try to make API call from Device B
4. Verify Device B gets 401 error

### Test 3: Logout All Others
1. Login from 3 devices
2. From Device A, call `POST /api/user-sessions/logout-all-others`
3. Verify only Device A session is active
4. Try API calls from Device B and C - should get 401

### Test 4: Device History
1. Login and logout multiple times
2. Call `GET /api/user-sessions/history`
3. Verify all sessions from last 60 days appear
4. Check pagination works

---

## Database Schema

### LoginHistory Table (Existing - Enhanced)
```sql
- id (Primary Key)
- userId (Foreign Key)
- device (e.g., "Chrome, Windows")
- location (e.g., "Gurugram, India")
- ipAddress
- loginTime
- logoutTime (nullable)
- duration (e.g., "12 hours 30 minutes")
- isActive (Boolean) -- Key field for device management
- username
- loginType
- totalSessionDuration
- longitude, latitude
```

---

## Security Considerations

1. **Session Validation:** Every API call checks if session is still active
2. **Backward Compatibility:** Old tokens without sessionId still work
3. **Cannot Self-Logout:** Users cannot logout their current session via remote logout endpoint
4. **Audit Trail:** All logins/logouts are logged in LoginHistory
5. **IP Tracking:** IP addresses recorded for security monitoring

---

## Future Enhancements

1. **Email Notifications:** Notify user on new device login
2. **Suspicious Login Detection:** Alert on login from new country/IP
3. **2FA for New Devices:** Require 2FA when logging in from unrecognized device
4. **Session Timeout:** Auto-expire sessions after X hours of inactivity
5. **Device Naming:** Allow users to name their devices ("My iPhone", "Office PC")
6. **OAuth Login Tracking:** Track which sessions used OAuth vs password

---

## Error Codes

| Status | Message | Cause |
|--------|---------|-------|
| 401 | Session not found | SessionId in JWT doesn't exist in DB |
| 401 | Session has been logged out from another device | isActive = false |
| 400 | Cannot logout current session | Trying to remote logout own session |
| 404 | Active session not found | SessionId doesn't exist or already logged out |

---

## Support

For issues or questions, contact the development team.
Last updated: November 20, 2025
