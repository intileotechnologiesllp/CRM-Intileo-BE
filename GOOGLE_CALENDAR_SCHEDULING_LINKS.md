# Google Calendar & Google Meet Integration with Scheduling Links

## Overview

The Scheduling Links feature is **fully integrated with Google Calendar and Google Meet**. When users connect their Google Calendar, the system automatically:

1. **Checks real-time availability** from Google Calendar
2. **Creates calendar events** when meetings are booked
3. **Generates Google Meet links** automatically
4. **Sends calendar invites** via Google Calendar

## How It Works

### Availability Checking (Google Calendar)

When someone visits a scheduling link:

1. **If Google Calendar is connected:**
   - System queries Google Calendar's FreeBusy API
   - Shows only **actually available** time slots
   - Excludes busy periods automatically
   - Respects existing calendar events

2. **If Google Calendar is NOT connected:**
   - Falls back to working hours configuration
   - Generates slots based on defined working hours
   - No conflict detection (recommend connecting Google Calendar)

### Booking Process (Google Calendar + Google Meet)

When someone books a meeting:

1. **Meeting Created in CRM** - Always created regardless of Google Calendar status

2. **If Google Calendar Connected:**
   - ✅ Event created in Google Calendar
   - ✅ Google Meet link automatically generated
   - ✅ Calendar invite sent to attendee
   - ✅ Event added to organizer's calendar
   - ✅ Google Calendar event ID saved for future updates/cancellations

3. **If Google Calendar NOT Connected:**
   - ⚠️ Meeting only in CRM
   - ⚠️ No Google Meet link
   - ⚠️ Email invite sent via SMTP (if configured)

## Setup Requirements

### 1. Connect Google Calendar

Users must connect their Google Calendar first:

```javascript
// User initiates Google OAuth flow
GET /api/auth/google/calendar/connect

// After authorization, tokens are stored in MasterUser.googleOAuthToken
```

### 2. Required OAuth Scopes

Ensure these scopes are requested:
- `https://www.googleapis.com/auth/calendar` - Full calendar access
- `https://www.googleapis.com/auth/userinfo.email` - User email

### 3. Verify Connection

Check if Google Calendar is connected:

```javascript
GET /api/meetings/calendar-status

// Response:
{
  "connected": true,
  "message": "Google Calendar is connected"
}
```

## Creating a Scheduling Link with Google Calendar

### Example: Create Link

```javascript
POST /api/meetings/scheduling-links

{
  "title": "Schedule a Meeting",
  "description": "Book a time to discuss your project",
  "durationMinutes": 60,
  "timezone": "America/New_York",
  "workingHours": {
    "1": {"start": "09:00", "end": "17:00"},  // Monday
    "2": {"start": "09:00", "end": "17:00"},  // Tuesday
    "3": {"start": "09:00", "end": "17:00"},  // Wednesday
    "4": {"start": "09:00", "end": "17:00"},  // Thursday
    "5": {"start": "09:00", "end": "17:00"}   // Friday
  }
}
```

**Note:** Even with Google Calendar connected, working hours serve as:
- Fallback if Google Calendar is unavailable
- Additional filter (slots are filtered by working hours after getting Google Calendar availability)

## Booking Flow with Google Calendar

### Step 1: Get Available Slots

```javascript
GET /api/meetings/scheduling/:token/available-slots

// Response includes slots from Google Calendar:
{
  "slots": [
    {
      "start": "2024-03-15T09:00:00.000Z",
      "end": "2024-03-15T10:00:00.000Z",
      "startLocal": "2024-03-15 09:00",
      "endLocal": "2024-03-15 10:00",
      "durationMinutes": 60,
      "_source": "google_calendar"  // Indicates source
    }
  ],
  "count": 5
}
```

### Step 2: Book Meeting

```javascript
POST /api/meetings/scheduling/:token/book

{
  "selectedSlotStart": "2024-03-15T09:00:00.000Z",
  "attendeeName": "Jane Smith",
  "attendeeEmail": "jane@example.com"
}
```

### Step 3: Response with Google Meet Link

```json
{
  "message": "Meeting booked and confirmed",
  "meeting": {
    "meetingId": 123,
    "subject": "Schedule a Meeting - Jane Smith",
    "startDateTime": "2024-03-15T09:00:00.000Z",
    "endDateTime": "2024-03-15T10:00:00.000Z",
    "meetingUrl": "https://meet.google.com/abc-defg-hij"
  },
  "googleCalendar": {
    "eventId": "google_event_id_123",
    "htmlLink": "https://calendar.google.com/calendar/event?eid=...",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "calendarAdded": true
  },
  "googleMeetLink": "https://meet.google.com/abc-defg-hij",
  "success": true
}
```

## Google Meet Link Features

### Automatic Generation

- **Always created** when Google Calendar is connected
- **Unique per meeting** - Each booking gets its own Meet link
- **Stored in CRM** - Saved in `meeting.meetingUrl`
- **Included in invites** - Both Google Calendar and email invites

### Meet Link Usage

The Google Meet link is:
- ✅ Included in the booking response
- ✅ Sent via Google Calendar invite (automatic)
- ✅ Sent via email invite (if email service configured)
- ✅ Available in meeting details in CRM
- ✅ Can be shared with additional attendees

## Availability Logic

### With Google Calendar (Recommended)

```
1. Check Google Calendar for busy periods
2. Generate potential slots based on working hours
3. Filter out slots that conflict with busy periods
4. Apply buffer times (before/after)
5. Return available slots
```

### Without Google Calendar (Fallback)

```
1. Generate slots based on working hours only
2. Apply buffer times
3. Remove past slots
4. Return available slots
```

**Important:** Without Google Calendar, there's no conflict detection. Users might book overlapping meetings.

## Benefits of Google Calendar Integration

### ✅ Real-Time Availability

- Shows actual free/busy times
- Excludes existing meetings
- Respects all calendar events
- No manual conflict management

### ✅ Automatic Calendar Sync

- Meetings appear in Google Calendar
- Updates sync automatically
- Cancellations remove from calendar
- Two-way visibility

### ✅ Google Meet Links

- Automatic generation
- No manual setup required
- Professional meeting links
- Integrated with calendar

### ✅ Better Email Experience

- Google Calendar sends invites
- Better deliverability
- Professional appearance
- Calendar integration for attendees

## Error Handling

### Google Calendar Not Connected

```json
{
  "googleCalendar": {
    "calendarAdded": false,
    "message": "Google Calendar not connected"
  },
  "meeting": {
    "meetingUrl": null
  }
}
```

**Action:** Meeting still created, but no calendar event or Meet link.

### Google Calendar Error

```json
{
  "googleCalendar": {
    "calendarAdded": false,
    "error": "Failed to create calendar event: ..."
  },
  "meeting": {
    "meetingUrl": null
  }
}
```

**Action:** Meeting created in CRM, but calendar sync failed. User can manually add to calendar.

## Best Practices

### 1. Always Connect Google Calendar

For best experience, users should connect Google Calendar to get:
- Real-time availability
- Automatic Google Meet links
- Calendar synchronization

### 2. Configure Working Hours

Even with Google Calendar, configure working hours as:
- Fallback if Google Calendar unavailable
- Additional filtering layer
- Boundary for slot generation

### 3. Use Buffer Times

Set buffer times to prevent back-to-back meetings:
```json
{
  "bufferTimeBefore": 15,  // 15 minutes before
  "bufferTimeAfter": 15    // 15 minutes after
}
```

### 4. Monitor Google Calendar Connection

Periodically check connection status and prompt users to reconnect if needed.

### 5. Handle Failures Gracefully

Always show meetings even if Google Calendar sync fails. Allow manual calendar addition.

## Troubleshooting

### No Available Slots Showing

**Possible causes:**
1. Google Calendar not connected
2. All slots already booked
3. Working hours too restrictive
4. Date range outside advanceBookingDays

**Solution:** Check calendar connection, expand working hours, or increase date range.

### Google Meet Link Not Generated

**Possible causes:**
1. Google Calendar not connected
2. User doesn't have Google Workspace
3. Meet API not enabled

**Solution:** 
- Connect Google Calendar
- Verify Google Workspace account
- Enable Google Meet API in Google Cloud Console

### Slots Don't Match Calendar

**Possible causes:**
1. Working hours filtering too aggressively
2. Timezone mismatch
3. Buffer times too large

**Solution:** 
- Review working hours configuration
- Verify timezone settings
- Adjust buffer times

## API Response Examples

### Successful Booking with Google Calendar

```json
{
  "message": "Meeting booked and confirmed",
  "meeting": {
    "meetingId": 123,
    "subject": "Schedule a Meeting - Jane Smith",
    "startDateTime": "2024-03-15T09:00:00.000Z",
    "endDateTime": "2024-03-15T10:00:00.000Z",
    "meetingUrl": "https://meet.google.com/abc-defg-hij"
  },
  "googleCalendar": {
    "eventId": "google_event_id_123abc",
    "htmlLink": "https://calendar.google.com/calendar/event?eid=...",
    "meetLink": "https://meet.google.com/abc-defg-hij",
    "calendarAdded": true
  },
  "googleMeetLink": "https://meet.google.com/abc-defg-hij",
  "success": true
}
```

### Booking Without Google Calendar

```json
{
  "message": "Meeting booked successfully",
  "meeting": {
    "meetingId": 124,
    "subject": "Schedule a Meeting - John Doe",
    "startDateTime": "2024-03-15T14:00:00.000Z",
    "endDateTime": "2024-03-15T15:00:00.000Z",
    "meetingUrl": null
  },
  "googleCalendar": {
    "calendarAdded": false,
    "message": "Google Calendar not connected"
  },
  "googleMeetLink": null,
  "success": true
}
```

## Summary

The Scheduling Links feature is **fully integrated with Google Calendar and Google Meet**:

- ✅ **Real-time availability** from Google Calendar
- ✅ **Automatic Google Meet links** for every booking
- ✅ **Calendar synchronization** for all meetings
- ✅ **Professional calendar invites** via Google
- ✅ **Graceful fallback** if Google Calendar not connected

For the best experience, users should connect their Google Calendar account. The system works without it but with reduced functionality.

