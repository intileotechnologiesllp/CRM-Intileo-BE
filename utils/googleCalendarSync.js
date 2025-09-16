const { google } = require('googleapis');

/**
 * Pushes an Activity instance to Google Calendar.
 * @param {Object} activity - Sequelize Activity instance
 * @param {string} oauthToken - User's Google OAuth2 access token
 * @returns {Promise<string>} - The created Google Calendar event ID
 */
async function syncActivityToGoogleCalendar(activity, oauthToken) {
  const calendar = google.calendar({ version: 'v3' });
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: oauthToken });

  // Prepare event data
  const event = {
    summary: activity.subject,
    description: activity.description,
    start: {
      dateTime: activity.startDateTime,
      timeZone: activity.timeZone || 'Asia/Kolkata', // Default or from user
    },
    end: {
      dateTime: activity.endDateTime,
      timeZone: activity.timeZone || 'Asia/Kolkata',
    },
    location: activity.location || undefined,
    attendees: Array.isArray(activity.guests)
      ? activity.guests.map(email => ({ email }))
      : (typeof activity.guests === 'string' && activity.guests.length > 0
        ? activity.guests.split(',').map(email => ({ email: email.trim() }))
        : []),
    // Set event status (free/busy)
    transparency: activity.status === 'busy' ? 'opaque' : 'transparent',
    // Add Google Meet link if requested
    conferenceData: activity.videoCallIntegration
      ? {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        }
      : undefined,
  };

  // Remove undefined fields
  Object.keys(event).forEach(key => event[key] === undefined && delete event[key]);

  // Insert event
  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: activity.videoCallIntegration ? 1 : 0,
    auth: oauth2Client,
  });

  return response.data.id;
}

module.exports = { syncActivityToGoogleCalendar };