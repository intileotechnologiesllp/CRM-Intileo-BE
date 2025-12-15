# Public Available Slots API Documentation

## Overview

The public available slots endpoint allows anyone (no authentication required) to view available time slots for a scheduling link. This is used by the booking page to display available meeting times.

## Endpoint

**GET** `/api/meetings/scheduling/:token/available-slots`

**Access:** Public (No authentication required)

## URL Parameters

- `token` (required) - Unique token of the scheduling link

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startDate` | ISO Date String | No | Today | Start date to check availability from |
| `endDate` | ISO Date String | No | Today + advanceBookingDays | End date to check availability until |
| `groupByDate` | Boolean/String | No | false | Group slots by date (returns `groupedByDate` object) |
| `timezone` | String | No | Link timezone | Timezone for date formatting |

## Request Examples

### Basic Request

```bash
GET /api/meetings/scheduling/abc123def456/available-slots
```

### With Date Range

```bash
GET /api/meetings/scheduling/abc123def456/available-slots?startDate=2024-03-15&endDate=2024-03-20
```

### Grouped by Date

```bash
GET /api/meetings/scheduling/abc123def456/available-slots?groupByDate=true
```

### Full Example

```bash
GET /api/meetings/scheduling/abc123def456/available-slots?startDate=2024-03-15T00:00:00Z&endDate=2024-03-20T23:59:59Z&groupByDate=true
```

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "link": {
    "title": "Schedule a Meeting with John",
    "durationMinutes": 60,
    "timezone": "America/New_York"
  },
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
  "count": 2,
  "source": "google_calendar",
  "metadata": {
    "timezone": "America/New_York",
    "durationMinutes": 60,
    "bufferTimeBefore": 15,
    "bufferTimeAfter": 15
  },
  "dateRange": {
    "earliest": "2024-03-15",
    "latest": "2024-03-15"
  }
}
```

### Response with Grouped Slots

When `groupByDate=true`:

```json
{
  "success": true,
  "link": {
    "title": "Schedule a Meeting with John",
    "durationMinutes": 60,
    "timezone": "America/New_York"
  },
  "slots": [
    {
      "start": "2024-03-15T09:00:00.000Z",
      "end": "2024-03-15T10:00:00.000Z",
      "startLocal": "2024-03-15 09:00",
      "endLocal": "2024-03-15 10:00",
      "durationMinutes": 60
    }
  ],
  "count": 5,
  "source": "google_calendar",
  "groupedByDate": {
    "2024-03-15": [
      {
        "start": "2024-03-15T09:00:00.000Z",
        "end": "2024-03-15T10:00:00.000Z",
        "startLocal": "2024-03-15 09:00",
        "endLocal": "2024-03-15 10:00",
        "time": "09:00",
        "durationMinutes": 60
      },
      {
        "start": "2024-03-15T14:00:00.000Z",
        "end": "2024-03-15T15:00:00.000Z",
        "startLocal": "2024-03-15 14:00",
        "endLocal": "2024-03-15 15:00",
        "time": "14:00",
        "durationMinutes": 60
      }
    ],
    "2024-03-16": [
      {
        "start": "2024-03-16T10:00:00.000Z",
        "end": "2024-03-16T11:00:00.000Z",
        "startLocal": "2024-03-16 10:00",
        "endLocal": "2024-03-16 11:00",
        "time": "10:00",
        "durationMinutes": 60
      }
    ]
  },
  "dates": ["2024-03-15", "2024-03-16"],
  "metadata": {
    "timezone": "America/New_York",
    "durationMinutes": 60,
    "bufferTimeBefore": 15,
    "bufferTimeAfter": 15
  },
  "dateRange": {
    "earliest": "2024-03-15",
    "latest": "2024-03-16"
  }
}
```

### Error Responses

#### Link Not Found (404)

```json
{
  "success": false,
  "message": "Scheduling link not found or inactive",
  "error": "Scheduling link not found or inactive"
}
```

#### Server Error (500)

```json
{
  "success": false,
  "message": "Failed to get available slots",
  "error": "Error details here"
}
```

## Response Fields

### Root Level

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Whether the request was successful |
| `link` | Object | Basic link information |
| `slots` | Array | Array of available time slots |
| `count` | Number | Total number of available slots |
| `source` | String | Source of availability: `"google_calendar"` or `"working_hours"` |
| `metadata` | Object | Additional metadata about the link |
| `dateRange` | Object | Earliest and latest dates with available slots |
| `groupedByDate` | Object | (Optional) Slots grouped by date |
| `dates` | Array | (Optional) Sorted array of dates with available slots |

### Slot Object

| Field | Type | Description |
|-------|------|-------------|
| `start` | ISO String | Slot start time in UTC (ISO 8601) |
| `end` | ISO String | Slot end time in UTC (ISO 8601) |
| `startLocal` | String | Slot start time in local timezone (YYYY-MM-DD HH:mm) |
| `endLocal` | String | Slot end time in local timezone (YYYY-MM-DD HH:mm) |
| `durationMinutes` | Number | Duration of the slot in minutes |

### Link Object

| Field | Type | Description |
|-------|------|-------------|
| `title` | String | Title of the scheduling link |
| `durationMinutes` | Number | Duration of meetings in minutes |
| `timezone` | String | Timezone for the link |

### Metadata Object

| Field | Type | Description |
|-------|------|-------------|
| `timezone` | String | Timezone used for the link |
| `durationMinutes` | Number | Meeting duration in minutes |
| `bufferTimeBefore` | Number | Buffer time before meetings (minutes) |
| `bufferTimeAfter` | Number | Buffer time after meetings (minutes) |

## Source Types

The `source` field indicates where the availability data comes from:

- **`google_calendar`**: Slots are pulled from Google Calendar (real-time availability)
- **`working_hours`**: Slots are generated from configured working hours (fallback)
- **`working_hours_fallback`**: Google Calendar was attempted but failed, using working hours

## Frontend Integration Examples

### JavaScript/Fetch

```javascript
async function getAvailableSlots(token, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  params.append('groupByDate', 'true');

  const response = await fetch(
    `/api/meetings/scheduling/${token}/available-slots?${params}`
  );
  
  const data = await response.json();
  
  if (data.success) {
    return data;
  } else {
    throw new Error(data.message);
  }
}

// Usage
const slots = await getAvailableSlots(
  'abc123def456',
  '2024-03-15',
  '2024-03-20'
);

// Display grouped slots
if (slots.groupedByDate) {
  Object.entries(slots.groupedByDate).forEach(([date, times]) => {
    console.log(`Date: ${date}`);
    times.forEach(slot => {
      console.log(`  - ${slot.time} (${slot.durationMinutes} min)`);
    });
  });
}
```

### React Component Example

```jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function AvailableSlots() {
  const { token } = useParams();
  const [slots, setSlots] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const today = new Date().toISOString();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        
        const response = await fetch(
          `/api/meetings/scheduling/${token}/available-slots?` +
          `startDate=${today}&` +
          `endDate=${endDate.toISOString()}&` +
          `groupByDate=true`
        );
        
        const data = await response.json();
        
        if (data.success) {
          setSlots(data);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [token]);

  if (loading) return <div>Loading available slots...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!slots || slots.count === 0) return <div>No available slots</div>;

  return (
    <div>
      <h2>{slots.link.title}</h2>
      <p>Duration: {slots.link.durationMinutes} minutes</p>
      <p>Source: {slots.source === 'google_calendar' ? 'Google Calendar' : 'Working Hours'}</p>
      
      {slots.groupedByDate && (
        <div>
          {slots.dates.map(date => (
            <div key={date}>
              <h3>{new Date(date).toLocaleDateString()}</h3>
              {slots.groupedByDate[date].map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSlotSelect(slot)}
                >
                  {slot.time} ({slot.durationMinutes} min)
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AvailableSlots;
```

### Calendar View Example

```javascript
// Display slots in a calendar grid
function displayCalendarView(slots) {
  if (!slots.groupedByDate) {
    // Group manually if not grouped
    const grouped = slots.slots.reduce((acc, slot) => {
      const date = slot.startLocal.split(' ')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(slot);
      return acc;
    }, {});
    
    slots.groupedByDate = grouped;
    slots.dates = Object.keys(grouped).sort();
  }

  // Render calendar
  slots.dates.forEach(date => {
    const daySlots = slots.groupedByDate[date];
    console.log(`\n${date}:`);
    daySlots.forEach(slot => {
      console.log(`  ${slot.time} - ${slot.endLocal.split(' ')[1]}`);
    });
  });
}
```

## Best Practices

1. **Cache Results**: Cache slot data for a few minutes to reduce API calls
2. **Handle Empty Results**: Show appropriate message when no slots available
3. **Date Range**: Request reasonable date ranges (e.g., 30 days)
4. **Error Handling**: Always handle errors gracefully
5. **Loading States**: Show loading indicators while fetching
6. **Timezone Awareness**: Use the timezone from response metadata
7. **Source Indicator**: Show users if slots are from Google Calendar (real-time) or working hours

## Rate Limiting

Consider implementing rate limiting for public endpoints to prevent abuse:

```javascript
// Example: Limit to 10 requests per minute per IP
const rateLimit = require('express-rate-limit');

const slotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message: 'Too many requests, please try again later'
});

app.get('/api/meetings/scheduling/:token/available-slots', 
  slotLimiter, 
  schedulingLinkController.getAvailableSlotsPublic
);
```

## CORS Configuration

Ensure CORS is properly configured for public endpoints if accessed from different domains:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
```

## Testing

### Test with cURL

```bash
# Basic request
curl "http://localhost:3056/api/meetings/scheduling/abc123/available-slots"

# With date range
curl "http://localhost:3056/api/meetings/scheduling/abc123/available-slots?startDate=2024-03-15&endDate=2024-03-20"

# Grouped by date
curl "http://localhost:3056/api/meetings/scheduling/abc123/available-slots?groupByDate=true"
```

### Test with Postman

1. Method: GET
2. URL: `{{baseUrl}}/api/meetings/scheduling/:token/available-slots`
3. Params:
   - `startDate`: 2024-03-15
   - `endDate`: 2024-03-20
   - `groupByDate`: true

## Notes

- No authentication required - this is a public endpoint
- Slots are filtered to exclude past times
- Slots respect working hours and buffer times
- Google Calendar integration provides real-time availability
- Response includes all necessary information for frontend rendering

