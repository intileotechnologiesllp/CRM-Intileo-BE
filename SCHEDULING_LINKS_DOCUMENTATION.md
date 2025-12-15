# Scheduling Links Feature Documentation

## Overview

Scheduling Links allow users to create public booking pages where external contacts can view available time slots and book meetings directly, similar to Pipedrive's scheduling links feature.

## Features

- **Public Booking Pages**: Generate unique links that can be shared with anyone
- **Available Slot Display**: Shows available time slots based on Google Calendar or working hours
- **One-Click Booking**: External users can book meetings without needing a CRM account
- **Automatic Contact Creation**: Creates or updates contacts when meetings are booked
- **Google Calendar Integration**: Uses Google Calendar to check availability
- **Customizable Settings**: Configure duration, working hours, required fields, etc.

## Database Setup

Run the migration to create the SchedulingLinks table:

```sql
SOURCE migrations/create-scheduling-links-table.sql;
```

## API Endpoints

### Private Endpoints (Require Authentication)

#### 1. Create Scheduling Link

**POST** `/api/meetings/scheduling-links`

Create a new scheduling link.

**Request Body:**
```json
{
  "title": "Schedule a Meeting with John",
  "description": "Book a time slot to discuss your project",
  "durationMinutes": 60,
  "timezone": "America/New_York",
  "bufferTimeBefore": 15,
  "bufferTimeAfter": 15,
  "advanceBookingDays": 60,
  "workingHours": {
    "1": {"start": "09:00", "end": "17:00"},
    "2": {"start": "09:00", "end": "17:00"},
    "3": {"start": "09:00", "end": "17:00"},
    "4": {"start": "09:00", "end": "17:00"},
    "5": {"start": "09:00", "end": "17:00"}
  },
  "meetingLocation": "Conference Room A or Google Meet",
  "requireEmail": true,
  "requireName": true,
  "requirePhone": false,
  "customFields": [
    {"name": "Company", "type": "text", "required": false},
    {"name": "Agenda", "type": "textarea", "required": false}
  ],
  "autoConfirm": true,
  "sendReminderEmail": true,
  "isActive": true
}
```

**Response:**
```json
{
  "message": "Scheduling link created successfully",
  "link": {
    "linkId": 1,
    "uniqueToken": "abc123def456...",
    "title": "Schedule a Meeting with John",
    "durationMinutes": 60,
    ...
  },
  "bookingUrl": "http://localhost:3000/book/abc123def456..."
}
```

#### 2. Get All Scheduling Links

**GET** `/api/meetings/scheduling-links`

Get all scheduling links for the authenticated user.

**Response:**
```json
{
  "links": [
    {
      "linkId": 1,
      "title": "Schedule a Meeting with John",
      "uniqueToken": "abc123...",
      "bookingUrl": "http://localhost:3000/book/abc123...",
      "bookingCount": 5,
      "lastUsedAt": "2024-03-15T10:00:00.000Z",
      "isActive": true
    }
  ],
  "count": 1
}
```

#### 3. Get Scheduling Link by ID

**GET** `/api/meetings/scheduling-links/:id`

Get details of a specific scheduling link.

#### 4. Update Scheduling Link

**PUT** `/api/meetings/scheduling-links/:id`

Update an existing scheduling link (same request body as create).

#### 5. Delete Scheduling Link

**DELETE** `/api/meetings/scheduling-links/:id`

Delete a scheduling link.

### Public Endpoints (No Authentication Required)

#### 1. Get Link Details

**GET** `/api/meetings/scheduling/:token`

Get public information about a scheduling link.

**Response:**
```json
{
  "title": "Schedule a Meeting with John",
  "description": "Book a time slot to discuss your project",
  "durationMinutes": 60,
  "timezone": "America/New_York",
  "requireEmail": true,
  "requireName": true,
  "requirePhone": false,
  "customFields": [...],
  "organizerName": "John Doe"
}
```

#### 2. Get Available Slots

**GET** `/api/meetings/scheduling/:token/available-slots?startDate=2024-03-15&endDate=2024-03-20`

Get available time slots for booking.

**Query Parameters:**
- `startDate` (optional) - Start date (default: today)
- `endDate` (optional) - End date (default: today + advanceBookingDays)

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
  "count": 2
}
```

#### 3. Book Meeting

**POST** `/api/meetings/scheduling/:token/book`

Book a meeting from a selected time slot.

**Request Body:**
```json
{
  "selectedSlotStart": "2024-03-15T09:00:00.000Z",
  "attendeeName": "Jane Smith",
  "attendeeEmail": "jane@example.com",
  "attendeePhone": "+1234567890",
  "customFields": {
    "Company": "Acme Corp",
    "Agenda": "Discuss project requirements"
  },
  "meetingTitle": "Project Discussion with Jane",
  "meetingDescription": "Initial meeting to discuss project scope"
}
```

**Response:**
```json
{
  "message": "Meeting booked and confirmed",
  "meeting": {
    "meetingId": 123,
    "subject": "Project Discussion with Jane",
    "startDateTime": "2024-03-15T09:00:00.000Z",
    "endDateTime": "2024-03-15T10:00:00.000Z",
    "meetingUrl": "https://meet.google.com/abc-defg-hij"
  },
  "success": true
}
```

## Frontend Integration

### Step 1: Create a Scheduling Link

```javascript
const createSchedulingLink = async () => {
  const response = await fetch('/api/meetings/scheduling-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: 'Schedule a Meeting',
      description: 'Book a time to discuss your project',
      durationMinutes: 60,
      timezone: 'America/New_York',
      workingHours: {
        1: { start: '09:00', end: '17:00' }, // Monday
        2: { start: '09:00', end: '17:00' }, // Tuesday
        3: { start: '09:00', end: '17:00' }, // Wednesday
        4: { start: '09:00', end: '17:00' }, // Thursday
        5: { start: '09:00', end: '17:00' }  // Friday
      },
      requireEmail: true,
      requireName: true
    })
  });

  const { link, bookingUrl } = await response.json();
  // Share bookingUrl with your contacts
  console.log('Share this link:', bookingUrl);
};
```

### Step 2: Public Booking Page (No Auth Required)

Create a public page at `/book/:token` that:

1. Fetches link details
2. Shows available slots
3. Allows slot selection
4. Collects attendee information
5. Books the meeting

**Example React Component:**

```javascript
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function BookingPage() {
  const { token } = useParams();
  const [linkDetails, setLinkDetails] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [formData, setFormData] = useState({
    attendeeName: '',
    attendeeEmail: '',
    attendeePhone: '',
    customFields: {}
  });

  // Fetch link details
  useEffect(() => {
    fetch(`/api/meetings/scheduling/${token}`)
      .then(res => res.json())
      .then(data => setLinkDetails(data));
  }, [token]);

  // Fetch available slots
  useEffect(() => {
    const today = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    fetch(`/api/meetings/scheduling/${token}/available-slots?startDate=${today}&endDate=${endDate.toISOString()}`)
      .then(res => res.json())
      .then(data => setSlots(data.slots));
  }, [token]);

  // Book meeting
  const handleBooking = async (e) => {
    e.preventDefault();
    
    const response = await fetch(`/api/meetings/scheduling/${token}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedSlotStart: selectedSlot.start,
        ...formData
      })
    });

    const result = await response.json();
    if (result.success) {
      alert('Meeting booked successfully! Check your email for confirmation.');
    }
  };

  return (
    <div className="booking-page">
      <h1>{linkDetails?.title}</h1>
      <p>{linkDetails?.description}</p>

      {/* Slot Selection */}
      <div className="slots-grid">
        {slots.map(slot => (
          <button
            key={slot.start}
            onClick={() => setSelectedSlot(slot)}
            className={selectedSlot?.start === slot.start ? 'selected' : ''}
          >
            {slot.startLocal}
          </button>
        ))}
      </div>

      {/* Booking Form */}
      {selectedSlot && (
        <form onSubmit={handleBooking}>
          <input
            type="text"
            placeholder="Your Name"
            value={formData.attendeeName}
            onChange={e => setFormData({...formData, attendeeName: e.target.value})}
            required={linkDetails?.requireName}
          />
          <input
            type="email"
            placeholder="Your Email"
            value={formData.attendeeEmail}
            onChange={e => setFormData({...formData, attendeeEmail: e.target.value})}
            required={linkDetails?.requireEmail}
          />
          {linkDetails?.requirePhone && (
            <input
              type="tel"
              placeholder="Your Phone"
              value={formData.attendeePhone}
              onChange={e => setFormData({...formData, attendeePhone: e.target.value})}
              required
            />
          )}
          <button type="submit">Book Meeting</button>
        </form>
      )}
    </div>
  );
}

export default BookingPage;
```

### Step 3: Share the Link

```javascript
// Copy link to clipboard
const copyLink = (bookingUrl) => {
  navigator.clipboard.writeText(bookingUrl);
  alert('Link copied to clipboard!');
};

// Or share via email
const shareViaEmail = (bookingUrl, contactEmail) => {
  window.location.href = `mailto:${contactEmail}?subject=Schedule a Meeting&body=Please use this link to book a time: ${bookingUrl}`;
};
```

## Working Hours Configuration

Working hours are specified as a JSON object with day of week (0-6, where 0 is Sunday) as keys:

```json
{
  "1": {"start": "09:00", "end": "17:00"},  // Monday
  "2": {"start": "09:00", "end": "17:00"},  // Tuesday
  "3": {"start": "09:00", "end": "17:00"},  // Wednesday
  "4": {"start": "09:00", "end": "17:00"},  // Thursday
  "5": {"start": "09:00", "end": "17:00"}   // Friday
}
```

## Custom Fields

Custom fields allow collecting additional information from attendees:

```json
[
  {
    "name": "Company",
    "type": "text",
    "required": false
  },
  {
    "name": "Agenda",
    "type": "textarea",
    "required": true
  },
  {
    "name": "Preferred Contact Method",
    "type": "select",
    "options": ["Email", "Phone", "Both"],
    "required": false
  }
]
```

## Integration with Google Calendar

- If user has Google Calendar connected, available slots are pulled from their actual calendar
- Busy times are automatically excluded
- Google Meet links are automatically generated for booked meetings
- Calendar invites are sent automatically

## Features

### Automatic Contact Creation

When someone books a meeting:
- If email exists in CRM, contact is updated
- If email is new, a new contact (Person) is created
- Contact is linked to the meeting organizer

### Email Confirmations

- Confirmation emails are sent automatically
- Include meeting details and Google Meet link
- Calendar invite (.ics file) attached

### Booking Statistics

- Track number of bookings per link
- Track last used date
- Monitor link usage

## Best Practices

1. **Set Realistic Working Hours**: Define clear working hours to avoid bookings outside available times
2. **Use Buffer Times**: Add buffer time before/after meetings to prevent back-to-back scheduling
3. **Clear Descriptions**: Provide clear descriptions so attendees know what to expect
4. **Require Essential Fields**: Only require fields that are truly necessary
5. **Active/Inactive Toggle**: Disable links when not accepting bookings
6. **Monitor Usage**: Regularly check booking statistics

## Environment Variables

Ensure these are set:

```env
FRONTEND_URL=http://localhost:3000  # Used to generate booking URLs
```

## Security Considerations

1. **Unique Tokens**: Each link has a cryptographically secure unique token
2. **Public Access**: Public endpoints don't require authentication but validate token
3. **Rate Limiting**: Consider adding rate limiting to public endpoints
4. **Input Validation**: All inputs are validated before processing
5. **Inactive Links**: Inactive links cannot be used for booking

## Troubleshooting

### No Available Slots Showing

1. Check if Google Calendar is connected
2. Verify working hours are configured correctly
3. Ensure date range is within advanceBookingDays
4. Check if timezone is correct

### Booking Fails

1. Verify all required fields are provided
2. Check if link is active
3. Ensure slot hasn't been booked by someone else
4. Verify email format is correct

### Google Meet Link Not Generated

1. Ensure Google Calendar is connected
2. Check if user has Google Workspace
3. Verify Google Meet API is enabled

