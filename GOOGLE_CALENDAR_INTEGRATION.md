# Google Calendar Integration Guide

## Overview

The Meeting Scheduler now integrates with Google Calendar APIs, similar to Pipedrive's meeting scheduler. This allows users to:

- Schedule meetings directly in Google Calendar
- Get automatic Google Meet links
- Check available time slots from Google Calendar
- Sync meeting updates and cancellations
- Send calendar invites automatically through Google Calendar

## Prerequisites

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Calendar API
   - Google OAuth2 API

### 2. OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Choose **Web application**
4. Add authorized redirect URIs:
   - `http://localhost:3056/api/auth/google/callback` (for development)
   - Your production callback URL
5. Save the **Client ID** and **Client Secret**

### 3. Environment Variables

Add to your `.env` file:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3056/api/auth/google/callback
```

### 4. Required OAuth Scopes

The integration requires these scopes:
- `https://www.googleapis.com/auth/calendar` - Full calendar access
- `https://www.googleapis.com/auth/userinfo.email` - User email access

## Connecting Google Calendar

### Step 1: Initiate Connection

Users need to connect their Google Calendar. This is typically done through your authentication flow:

```javascript
// Get the authorization URL (example endpoint)
GET /api/auth/google/calendar/connect
```

This should redirect users to Google's OAuth consent screen.

### Step 2: Handle OAuth Callback

After user authorizes, Google redirects to your callback URL with an authorization code. The callback should:

1. Exchange code for tokens
2. Store tokens in `MasterUser.googleOAuthToken` field

Example (using existing code pattern):
```javascript
// In your OAuth callback handler
const { tokens } = await oauth2Client.getToken(code);
await MasterUser.update(
  { googleOAuthToken: JSON.stringify(tokens) },
  { where: { masterUserID: userId } }
);
```

## API Endpoints

### 1. Create Meeting with Google Calendar

**POST** `/api/meetings`

When creating a meeting, if the user has Google Calendar connected, the meeting is automatically:
- Created in Google Calendar
- Given a Google Meet link (if not provided)
- Synced with attendees

**Request Body:**
```json
{
  "subject": "Team Meeting",
  "description": "Weekly team sync",
  "startDateTime": "2024-03-15T14:00:00",
  "endDateTime": "2024-03-15T15:00:00",
  "timezone": "America/New_York",
  "personIds": [1, 2],
  "userIds": [3],
  "useGoogleCalendar": true  // Optional, defaults to true
}
```

**Response:**
```json
{
  "message": "Meeting created successfully",
  "meeting": { ... },
  "googleCalendar": {
    "eventId": "google_event_id_123",
    "htmlLink": "https://calendar.google.com/calendar/event?eid=...",
    "meetLink": "https://meet.google.com/abc-defg-hij"
  }
}
```

### 2. Get Available Time Slots

**GET** `/api/meetings/available-slots`

Get available time slots from Google Calendar (similar to Pipedrive's availability checker).

**Query Parameters:**
- `startDate` (required) - Start date to check from (ISO format)
- `endDate` (required) - End date to check until (ISO format)
- `durationMinutes` (optional) - Duration of meeting in minutes (default: 30)
- `timezone` (optional) - Timezone for dates (default: user's timezone)

**Example:**
```
GET /api/meetings/available-slots?startDate=2024-03-15T09:00:00&endDate=2024-03-15T17:00:00&durationMinutes=60&timezone=America/New_York
```

**Response:**
```json
{
  "slots": [
    {
      "start": "2024-03-15T09:00:00.000Z",
      "end": "2024-03-15T10:00:00.000Z",
      "startLocal": "2024-03-15 09:00",
      "endLocal": "2024-03-15 10:00",
      "durationMinutes": 60
    },
    {
      "start": "2024-03-15T14:00:00.000Z",
      "end": "2024-03-15T15:00:00.000Z",
      "startLocal": "2024-03-15 14:00",
      "endLocal": "2024-03-15 15:00",
      "durationMinutes": 60
    }
  ],
  "timezone": "America/New_York",
  "count": 2
}
```

### 3. Check Calendar Connection Status

**GET** `/api/meetings/calendar-status`

Check if user's Google Calendar is connected.

**Response:**
```json
{
  "connected": true,
  "message": "Google Calendar is connected"
}
```

### 4. Update Meeting (Syncs with Google Calendar)

**PUT** `/api/meetings/:id`

When updating a meeting that was created in Google Calendar:
- Updates are automatically synced to Google Calendar
- Google Meet link is preserved
- Attendees receive update notifications from Google

### 5. Cancel Meeting (Syncs with Google Calendar)

**DELETE** `/api/meetings/:id`

When cancelling a meeting:
- Removed from Google Calendar
- Cancellation emails sent to attendees via Google Calendar
- Local meeting marked as cancelled

**Request Body:**
```json
{
  "cancellationReason": "Rescheduled",
  "sendCancellation": true  // Google Calendar sends cancellation emails
}
```

## Features

### Automatic Google Meet Links

When creating a meeting with Google Calendar integration:
- If `meetingUrl` is not provided, a Google Meet link is automatically created
- The Meet link is saved in the meeting record
- Attendees can join directly from the calendar invite

### Availability Checking

The system uses Google Calendar's FreeBusy API to:
- Check user's existing calendar events
- Calculate available time slots
- Respect busy periods
- Generate slot suggestions in 30-minute intervals

### Two-Way Sync

- **Create**: Meeting created in CRM → Created in Google Calendar
- **Update**: Meeting updated in CRM → Updated in Google Calendar
- **Cancel**: Meeting cancelled in CRM → Deleted from Google Calendar

### Email Notifications

When using Google Calendar integration:
- Google Calendar automatically sends invites to attendees
- Update notifications are sent when meetings change
- Cancellation emails are sent when meetings are cancelled
- No need to send separate email invites (optional)

## Frontend Integration Example

### Check Availability Before Creating Meeting

```javascript
// Step 1: Check available slots
const checkAvailability = async () => {
  const response = await fetch(
    `/api/meetings/available-slots?` +
    `startDate=2024-03-15T09:00:00&` +
    `endDate=2024-03-15T17:00:00&` +
    `durationMinutes=60`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const { slots } = await response.json();
  // Display slots to user for selection
  return slots;
};

// Step 2: Create meeting using selected slot
const createMeeting = async (selectedSlot) => {
  const response = await fetch('/api/meetings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      subject: 'Team Meeting',
      startDateTime: selectedSlot.start,
      endDateTime: selectedSlot.end,
      timezone: 'America/New_York',
      useGoogleCalendar: true, // Use Google Calendar integration
      personIds: [1, 2]
    })
  });
  
  const result = await response.json();
  // Meeting created with Google Meet link
  console.log('Meet Link:', result.googleCalendar.meetLink);
};
```

### Display Calendar Connection Status

```javascript
const checkConnection = async () => {
  const response = await fetch('/api/meetings/calendar-status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const { connected } = await response.json();
  
  if (!connected) {
    // Show "Connect Google Calendar" button
    showConnectButton();
  } else {
    // Show calendar features
    showCalendarFeatures();
  }
};
```

## Error Handling

### Google Calendar Not Connected

If user tries to use Google Calendar features without connection:

```json
{
  "message": "Google Calendar is not connected. Please connect your Google Calendar first.",
  "status": 400
}
```

### Token Expired

The service automatically refreshes expired tokens. If refresh fails:

```json
{
  "message": "Failed to refresh Google OAuth token",
  "status": 500
}
```

## Best Practices

1. **Always Check Connection**: Before showing calendar features, check if user has connected their calendar
2. **Fallback to Manual**: If Google Calendar fails, fall back to regular meeting creation
3. **Handle Errors Gracefully**: Don't block meeting creation if Google Calendar sync fails
4. **Show Meet Links**: Display Google Meet links prominently in meeting details
5. **Availability First**: Use availability checker before scheduling to avoid conflicts

## Troubleshooting

### Meetings Not Appearing in Google Calendar

1. Check if user's OAuth token is valid
2. Verify token hasn't been revoked
3. Check Google Calendar API is enabled
4. Verify OAuth scopes include calendar access

### Available Slots Not Working

1. Ensure user has calendar events to check against
2. Verify date range is reasonable (not too far in future)
3. Check timezone is correctly specified
4. Ensure FreeBusy API has proper permissions

### Google Meet Links Not Generated

1. Verify `createMeetLink: true` is set
2. Check if user has Google Workspace (Meet requires Workspace for some features)
3. Ensure conferenceDataVersion is set to 1
4. Verify Google Meet API is enabled in Google Cloud Console

## Security Considerations

1. **Token Storage**: OAuth tokens are stored encrypted in the database
2. **Token Refresh**: Tokens are automatically refreshed when expired
3. **Scope Limitation**: Only request necessary OAuth scopes
4. **User Consent**: Always show users what permissions are being requested
5. **Revocation**: Allow users to disconnect Google Calendar at any time

## Future Enhancements

Potential improvements:
- Multi-user availability checking (find common free slots)
- Working hours configuration
- Automatic timezone detection
- Calendar event attendees sync
- RSVP tracking from Google Calendar
- Integration with other calendar providers (Outlook, etc.)

