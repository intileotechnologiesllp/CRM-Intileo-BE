const { google } = require('googleapis');
const MasterUser = require('../models/master/masterUserModel');
const moment = require('moment-timezone');

class GoogleCalendarService {
  /**
   * Get authenticated OAuth2 client for a user
   * @param {number} userId - Master user ID
   * @returns {Promise<Object>} OAuth2 client
   */
  async getOAuth2Client(userId) {
    const user = await MasterUser.findByPk(userId);
    if (!user || !user.googleOAuthToken) {
      throw new Error('Google Calendar not connected for this user');
    }

    let tokenObj;
    if (typeof user.googleOAuthToken === 'string') {
      try {
        tokenObj = JSON.parse(user.googleOAuthToken);
      } catch (e) {
        throw new Error('Invalid Google OAuth token format');
      }
    } else {
      tokenObj = user.googleOAuthToken;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials(tokenObj);

    // Refresh token if expired
    if (tokenObj.expiry_date && Date.now() >= tokenObj.expiry_date) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        // Update token in database
        await MasterUser.update(
          { googleOAuthToken: JSON.stringify(credentials) },
          { where: { masterUserID: userId } }
        );
      } catch (error) {
        throw new Error('Failed to refresh Google OAuth token');
      }
    }

    return oauth2Client;
  }

  /**
   * Create a calendar event in Google Calendar
   * @param {Object} options - Event options
   * @param {number} options.userId - User ID
   * @param {string} options.summary - Event title
   * @param {string} options.description - Event description
   * @param {Date|string} options.startDateTime - Start date/time
   * @param {Date|string} options.endDateTime - End date/time
   * @param {string} options.timezone - Timezone (e.g., 'America/New_York')
   * @param {string} options.location - Location
   * @param {Array} options.attendees - Array of email addresses
   * @param {boolean} options.createMeetLink - Whether to create Google Meet link
   * @param {string} options.calendarId - Calendar ID (default: 'primary')
   * @returns {Promise<Object>} Created event with meet link
   */
  async createEvent(options) {
    const {
      userId,
      summary,
      description,
      startDateTime,
      endDateTime,
      timezone = 'UTC',
      location,
      attendees = [],
      createMeetLink = true,
      calendarId = 'primary',
    } = options;

    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Format dates for Google Calendar API
    const start = moment.tz(startDateTime, timezone);
    const end = moment.tz(endDateTime, timezone);

    const event = {
      summary,
      description,
      start: {
        dateTime: start.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: timezone,
      },
      attendees: attendees.map(email => ({ email })),
      location,
    };

    // Add Google Meet link if requested
    if (createMeetLink) {
      event.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    try {
      const response = await calendar.events.insert({
        calendarId,
        resource: event,
        conferenceDataVersion: createMeetLink ? 1 : 0,
        sendUpdates: 'all', // Send email notifications to attendees
      });

      const createdEvent = response.data;
      
      return {
        eventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        meetLink: createdEvent.conferenceData?.entryPoints?.find(
          ep => ep.entryPointType === 'video'
        )?.uri || null,
        hangoutLink: createdEvent.hangoutLink || null,
        event: createdEvent,
      };
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  /**
   * Update a calendar event in Google Calendar
   * @param {Object} options - Update options
   * @param {number} options.userId - User ID
   * @param {string} options.eventId - Google Calendar event ID
   * @param {Object} options.updates - Fields to update
   * @returns {Promise<Object>} Updated event
   */
  async updateEvent(options) {
    const {
      userId,
      eventId,
      updates,
      calendarId = 'primary',
    } = options;

    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      // Get existing event first
      const existingEvent = await calendar.events.get({
        calendarId,
        eventId,
      });

      // Merge updates
      const updatedEvent = {
        ...existingEvent.data,
      };

      // Update summary/description/location
      if (updates.summary) updatedEvent.summary = updates.summary;
      if (updates.description !== undefined) updatedEvent.description = updates.description;
      if (updates.location !== undefined) updatedEvent.location = updates.location;

      // Format dates if provided
      if (updates.startDateTime && updates.timezone) {
        updatedEvent.start = {
          dateTime: moment.tz(updates.startDateTime, updates.timezone).toISOString(),
          timeZone: updates.timezone,
        };
      } else if (updates.startDateTime) {
        // Use existing timezone if not provided
        updatedEvent.start = {
          dateTime: moment(updates.startDateTime).toISOString(),
          timeZone: existingEvent.data.start.timeZone || 'UTC',
        };
      }

      if (updates.endDateTime && updates.timezone) {
        updatedEvent.end = {
          dateTime: moment.tz(updates.endDateTime, updates.timezone).toISOString(),
          timeZone: updates.timezone,
        };
      } else if (updates.endDateTime) {
        // Use existing timezone if not provided
        updatedEvent.end = {
          dateTime: moment(updates.endDateTime).toISOString(),
          timeZone: existingEvent.data.end.timeZone || 'UTC',
        };
      }

      // Update attendees if provided
      if (updates.attendees) {
        updatedEvent.attendees = updates.attendees.map(email => ({ email }));
      }

      const response = await calendar.events.update({
        calendarId,
        eventId,
        resource: updatedEvent,
        conferenceDataVersion: updatedEvent.conferenceData ? 1 : 0,
        sendUpdates: 'all',
      });

      const event = response.data;
      
      return {
        eventId: event.id,
        htmlLink: event.htmlLink,
        meetLink: event.conferenceData?.entryPoints?.find(
          ep => ep.entryPointType === 'video'
        )?.uri || event.hangoutLink || null,
        event,
      };
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      throw new Error(`Failed to update calendar event: ${error.message}`);
    }
  }

  /**
   * Delete a calendar event
   * @param {Object} options - Delete options
   * @param {number} options.userId - User ID
   * @param {string} options.eventId - Google Calendar event ID
   * @param {string} options.calendarId - Calendar ID (default: 'primary')
   * @param {boolean} options.sendUpdates - Send cancellation emails (default: true)
   * @returns {Promise<void>}
   */
  async deleteEvent(options) {
    const {
      userId,
      eventId,
      calendarId = 'primary',
      sendUpdates = true,
    } = options;

    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: sendUpdates ? 'all' : 'none',
      });
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      throw new Error(`Failed to delete calendar event: ${error.message}`);
    }
  }

  /**
   * Get available time slots for scheduling
   * @param {Object} options - Availability options
   * @param {number} options.userId - User ID to check availability for
   * @param {Date|string} options.startDate - Start date to check from
   * @param {Date|string} options.endDate - End date to check until
   * @param {number} options.durationMinutes - Duration of the meeting in minutes
   * @param {string} options.timezone - Timezone (default: 'UTC')
   * @param {Array} options.busyTimes - Additional busy times to consider
   * @returns {Promise<Array>} Array of available time slots
   */
  async getAvailableSlots(options) {
    const {
      userId,
      startDate,
      endDate,
      durationMinutes = 30,
      timezone = 'UTC',
      busyTimes = [],
    } = options;

    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get user's email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    try {
      // Query freebusy to get busy periods
      const freebusyResponse = await calendar.freebusy.query({
        resource: {
          timeMin: moment(startDate).toISOString(),
          timeMax: moment(endDate).toISOString(),
          timeZone: timezone,
          items: [{ id: 'primary' }],
        },
      });

      const busyPeriods = freebusyResponse.data.calendars?.primary?.busy || [];
      
      // Add custom busy times
      if (busyTimes.length > 0) {
        busyPeriods.push(...busyTimes);
      }

      // Generate available slots
      const availableSlots = this.generateAvailableSlots({
        startDate,
        endDate,
        durationMinutes,
        busyPeriods,
        timezone,
      });

      return availableSlots;
    } catch (error) {
      console.error('Error getting available slots:', error);
      throw new Error(`Failed to get available slots: ${error.message}`);
    }
  }

  /**
   * Generate available time slots from busy periods
   * @param {Object} options - Slot generation options
   * @returns {Array} Array of available time slots
   */
  generateAvailableSlots(options) {
    const {
      startDate,
      endDate,
      durationMinutes,
      busyPeriods = [],
      timezone,
    } = options;

    const slots = [];
    let currentTime = moment.tz(startDate, timezone);
    const endTime = moment.tz(endDate, timezone);

    while (currentTime.isBefore(endTime)) {
      const slotEnd = currentTime.clone().add(durationMinutes, 'minutes');
      
      if (slotEnd.isAfter(endTime)) {
        break;
      }

      // Check if this slot conflicts with any busy period
      const isBusy = busyPeriods.some(busy => {
        const busyStart = moment(busy.start);
        const busyEnd = moment(busy.end);
        
        // Check for overlap
        return (
          (currentTime.isSameOrAfter(busyStart) && currentTime.isBefore(busyEnd)) ||
          (slotEnd.isAfter(busyStart) && slotEnd.isSameOrBefore(busyEnd)) ||
          (currentTime.isBefore(busyStart) && slotEnd.isAfter(busyEnd))
        );
      });

      if (!isBusy) {
        slots.push({
          start: currentTime.toISOString(),
          end: slotEnd.toISOString(),
          startLocal: currentTime.format('YYYY-MM-DD HH:mm'),
          endLocal: slotEnd.format('YYYY-MM-DD HH:mm'),
          durationMinutes,
        });
      }

      // Move to next potential slot (30-minute intervals)
      currentTime.add(30, 'minutes');
    }

    return slots;
  }

  /**
   * Get calendar events for a date range
   * @param {Object} options - Query options
   * @param {number} options.userId - User ID
   * @param {Date|string} options.startDate - Start date
   * @param {Date|string} options.endDate - End date
   * @param {string} options.calendarId - Calendar ID (default: 'primary')
   * @returns {Promise<Array>} Array of events
   */
  async getEvents(options) {
    const {
      userId,
      startDate,
      endDate,
      calendarId = 'primary',
    } = options;

    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: moment(startDate).toISOString(),
        timeMax: moment(endDate).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error getting calendar events:', error);
      throw new Error(`Failed to get calendar events: ${error.message}`);
    }
  }

  /**
   * Check if user has Google Calendar connected
   * @param {number} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isConnected(userId) {
    try {
      const user = await MasterUser.findByPk(userId);
      return !!(user && user.googleOAuthToken);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get working hours for availability checking (can be extended)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Working hours config
   */
  async getWorkingHours(userId) {
    // Default working hours (9 AM - 5 PM)
    // Can be extended to fetch from user settings
    return {
      start: '09:00',
      end: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    };
  }
}

module.exports = new GoogleCalendarService();

