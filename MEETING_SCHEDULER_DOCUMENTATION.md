# Meeting Scheduler API Documentation

## Overview

The Meeting Scheduler provides comprehensive meeting management functionality similar to Pipedrive's meeting scheduler. It includes:

- Complete meeting lifecycle management (create, update, cancel)
- Timezone handling
- Email notifications with calendar invites (ICS files)
- Conflict detection
- Recurrence support
- Integration with contacts, deals, and leads

## Table of Contents

1. [Database Setup](#database-setup)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Examples](#requestresponse-examples)
4. [Features](#features)
5. [Timezone Handling](#timezone-handling)
6. [Conflict Detection](#conflict-detection)
7. [Email Notifications](#email-notifications)

## Database Setup

First, run the migration to create the Meetings table:

```sql
-- Run the migration file
SOURCE migrations/create-meetings-table.sql;
```

Or execute the SQL directly in your MySQL client.

## API Endpoints

All endpoints are prefixed with `/api/meetings` and require authentication via JWT token.

### 1. Create Meeting

**POST** `/api/meetings`

Create a new meeting with optional email invitations.

**Request Body:**
```json
{
  "subject": "Project Review Meeting",
  "description": "Quarterly project review and planning",
  "startDateTime": "2024-03-15T14:00:00",
  "endDateTime": "2024-03-15T15:00:00",
  "location": "Conference Room A",
  "meetingUrl": "https://zoom.us/j/123456789",
  "timezone": "America/New_York",
  "personIds": [1, 2],
  "userIds": [5],
  "externalAttendees": [
    {"name": "John Doe", "email": "john@example.com"}
  ],
  "dealId": 123,
  "leadId": 456,
  "personId": 1,
  "leadOrganizationId": 10,
  "priority": "high",
  "reminderMinutes": [15, 60],
  "recurrenceRule": "FREQ=WEEKLY;INTERVAL=1;COUNT=5",
  "recurrenceEndDate": "2024-04-15T15:00:00",
  "sendInvites": true,
  "checkConflicts": true
}
```

**Response:**
```json
{
  "message": "Meeting created successfully",
  "meeting": {
    "meetingId": 1,
    "activityId": 100,
    "timezone": "America/New_York",
    "meetingStatus": "scheduled",
    "organizerEmail": "organizer@example.com",
    "organizerName": "John Organizer",
    "activity": {
      "subject": "Project Review Meeting",
      "startDateTime": "2024-03-15T18:00:00.000Z",
      "endDateTime": "2024-03-15T19:00:00.000Z"
    }
  },
  "emailResults": [
    {"email": "attendee@example.com", "status": "sent", "messageId": "..."}
  ]
}
```

### 2. Get All Meetings

**GET** `/api/meetings`

Get all meetings for the authenticated user with optional filtering.

**Query Parameters:**
- `status` - Filter by meeting status (scheduled, confirmed, cancelled, completed, no_show)
- `startDate` - Filter meetings starting from this date
- `endDate` - Filter meetings ending before this date
- `dealId` - Filter by deal ID
- `leadId` - Filter by lead ID
- `personId` - Filter by person ID
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Example:**
```
GET /api/meetings?status=scheduled&startDate=2024-03-01&page=1&limit=20
```

**Response:**
```json
{
  "meetings": [...],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### 3. Get Meeting by ID

**GET** `/api/meetings/:id`

Get detailed information about a specific meeting.

**Response:**
```json
{
  "meeting": {
    "meetingId": 1,
    "activityId": 100,
    "timezone": "America/New_York",
    "meetingStatus": "scheduled",
    "activity": {
      "subject": "Project Review Meeting",
      "description": "...",
      "startDateTime": "...",
      "endDateTime": "...",
      "ActivityPerson": {...},
      "ActivityDeal": {...}
    },
    "owner": {...}
  }
}
```

### 4. Update Meeting

**PUT** `/api/meetings/:id`

Update an existing meeting. Only provide fields that need to be updated.

**Request Body:**
```json
{
  "subject": "Updated Meeting Title",
  "startDateTime": "2024-03-15T15:00:00",
  "endDateTime": "2024-03-15T16:00:00",
  "timezone": "America/Los_Angeles",
  "sendUpdates": true,
  "checkConflicts": true
}
```

**Response:**
```json
{
  "message": "Meeting updated successfully",
  "meeting": {...},
  "emailResults": [...]
}
```

### 5. Cancel Meeting

**DELETE** `/api/meetings/:id`

Cancel a meeting and optionally send cancellation emails.

**Request Body:**
```json
{
  "cancellationReason": "Rescheduling due to conflict",
  "sendCancellation": true
}
```

**Response:**
```json
{
  "message": "Meeting cancelled successfully",
  "emailResults": [...]
}
```

### 6. Check Conflicts

**POST** `/api/meetings/check-conflicts`

Check for scheduling conflicts before creating/updating a meeting.

**Request Body:**
```json
{
  "startDateTime": "2024-03-15T14:00:00",
  "endDateTime": "2024-03-15T15:00:00",
  "userId": 5,
  "attendeeIds": [1, 2, 3],
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "hasConflicts": true,
  "userConflicts": [
    {
      "activityId": 99,
      "subject": "Existing Meeting",
      "startDateTime": "...",
      "endDateTime": "..."
    }
  ],
  "attendeeConflicts": [
    {
      "userId": 1,
      "conflicts": [...]
    }
  ]
}
```

### 7. Resend Invites

**POST** `/api/meetings/:id/resend-invites`

Resend meeting invitation emails to all attendees.

**Response:**
```json
{
  "message": "Invites resent successfully",
  "emailResults": [...]
}
```

## Features

### Timezone Handling

- All meetings support timezone specification (e.g., "America/New_York", "Asia/Kolkata", "Europe/London")
- Dates are stored in UTC in the database
- Dates are automatically converted based on the meeting's timezone
- Timezone validation ensures only valid timezones are accepted

### Conflict Detection

- Automatically checks for conflicts when creating/updating meetings
- Checks conflicts for the organizer and all attendees
- Returns detailed conflict information including conflicting meeting details
- Can be disabled by setting `checkConflicts: false`

### Email Notifications

- Sends calendar invites (ICS files) as email attachments
- Supports multiple email types:
  - **Invite** - Initial meeting invitation
  - **Update** - Meeting changes notification
  - **Cancellation** - Meeting cancellation notice
  - **Reminder** - Meeting reminders (requires separate implementation)
- HTML and plain text email formats
- Uses SMTP configuration from UserCredential model

### Recurrence Support

- Supports iCal RRULE format
- Common patterns:
  - `FREQ=DAILY;INTERVAL=1;COUNT=5` - Daily for 5 occurrences
  - `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR` - Weekly on Mon, Wed, Fri
  - `FREQ=MONTHLY;INTERVAL=1` - Monthly
- Recurrence end date can be specified separately

### Integration with CRM Entities

- Link meetings to **Deals**
- Link meetings to **Leads**
- Link meetings to **Persons** (contacts)
- Link meetings to **Organizations**
- Support for multiple attendees from different sources

### Reminders

- Configure multiple reminder times (in minutes before meeting)
- Example: `[15, 60]` sends reminders 15 minutes and 1 hour before
- Stored as JSON array in database

## Timezone Handling

### Supported Timezones

The system uses moment-timezone and supports all IANA timezone identifiers:

- `America/New_York` - Eastern Time
- `America/Los_Angeles` - Pacific Time
- `Europe/London` - UK Time
- `Asia/Kolkata` - India Standard Time
- `UTC` - Coordinated Universal Time
- And many more...

### Date Format

All dates should be sent in ISO 8601 format:
```
YYYY-MM-DDTHH:mm:ss
```

Example: `2024-03-15T14:00:00`

The timezone specified in the meeting will be used to interpret this date.

## Conflict Detection

Conflict detection checks if there are overlapping meetings for:
- The meeting organizer
- All internal attendees (users)
- All external attendees (if they have existing meetings in the system)

A conflict occurs when:
- Meeting starts during another meeting
- Meeting ends during another meeting
- Meeting completely overlaps another meeting

Only non-cancelled meetings are considered in conflict checks.

## Email Notifications

### ICS File Generation

- ICS files are generated automatically using RFC 5545 standard
- Includes all meeting details: time, location, description, attendees
- Supports timezone information
- Includes reminder settings
- Supports recurrence rules

### Email Templates

Emails include:
- Professional HTML formatting
- Plain text fallback
- Meeting details in organized layout
- Calendar attachment (ICS file)
- Join meeting link (if meeting URL provided)

### SMTP Configuration

The system uses SMTP credentials from the `UserCredential` model. Ensure:
- The organizer's email has valid SMTP credentials in the database
- SMTP settings (host, port, secure) are configured correctly
- App password is set if required by email provider

## Error Handling

Common error responses:

**400 Bad Request:**
```json
{
  "message": "Subject and startDateTime are required"
}
```

**401 Unauthorized:**
```json
{
  "message": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "message": "Access denied"
}
```

**404 Not Found:**
```json
{
  "message": "Meeting not found"
}
```

**409 Conflict:**
```json
{
  "message": "Meeting conflicts detected",
  "conflicts": {...}
}
```

**500 Internal Server Error:**
```json
{
  "message": "Failed to create meeting",
  "error": "Error details"
}
```

## Examples

### Example 1: Simple Meeting

```javascript
const response = await fetch('/api/meetings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    subject: 'Team Standup',
    startDateTime: '2024-03-15T09:00:00',
    endDateTime: '2024-03-15T09:30:00',
    timezone: 'America/New_York',
    personIds: [1, 2, 3],
    sendInvites: true
  })
});
```

### Example 2: Recurring Meeting

```javascript
const response = await fetch('/api/meetings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    subject: 'Weekly Team Meeting',
    startDateTime: '2024-03-15T10:00:00',
    endDateTime: '2024-03-15T11:00:00',
    timezone: 'America/New_York',
    recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR',
    recurrenceEndDate: '2024-06-15T11:00:00',
    reminderMinutes: [60, 1440], // 1 hour and 1 day before
    userIds: [1, 2, 3],
    sendInvites: true
  })
});
```

### Example 3: Check Conflicts Before Creating

```javascript
// First check for conflicts
const conflictCheck = await fetch('/api/meetings/check-conflicts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    startDateTime: '2024-03-15T14:00:00',
    endDateTime: '2024-03-15T15:00:00',
    userId: 5,
    attendeeIds: [1, 2],
    timezone: 'America/New_York'
  })
});

const conflicts = await conflictCheck.json();

if (!conflicts.hasConflicts) {
  // Proceed with meeting creation
  // ...
}
```

## Notes

- All dates are stored in UTC in the database
- The timezone field in the Meeting model determines how dates are displayed and interpreted
- Email invitations are sent asynchronously and failures don't prevent meeting creation
- Meeting cancellation marks the associated Activity as done
- External attendees are stored as JSON and don't require CRM contact records

## Future Enhancements

Potential improvements:
- RSVP tracking for attendees
- Meeting reminders via cron jobs
- Google Calendar two-way sync (update/cancel in Google Calendar)
- Microsoft Outlook calendar integration
- Meeting templates
- Availability checking based on working hours
- Meeting rooms/resources booking

