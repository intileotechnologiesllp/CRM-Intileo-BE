const SchedulingLink = require("../models/meeting/schedulingLinkModel");
const googleCalendarService = require("./googleCalendarService");
const MeetingService = require("./meetingService");
const moment = require("moment-timezone");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

class SchedulingLinkService {
  /**
   * Generate a unique token for scheduling link
   * @returns {string} Unique token
   */
  generateUniqueToken() {
    // Generate a URL-friendly token
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Create or update a scheduling link
   * @param {Object} options - Link options
   * @param {number} options.userId - User ID
   * @param {Object} options.linkData - Link configuration
   * @param {number} options.linkId - Optional link ID for update
   * @returns {Promise<Object>} Created/updated link
   */
  async createOrUpdateLink(options) {
    const { userId, linkData, linkId } = options;

    const linkConfig = {
      masterUserID: userId,
      uniqueToken: linkData.uniqueToken || this.generateUniqueToken(),
      title: linkData.title || "Schedule a Meeting",
      description: linkData.description,
      durationMinutes: linkData.durationMinutes || 30,
      timezone: linkData.timezone || "UTC",
      bufferTimeBefore: linkData.bufferTimeBefore || 0,
      bufferTimeAfter: linkData.bufferTimeAfter || 0,
      advanceBookingDays: linkData.advanceBookingDays || 30,
      workingHours: linkData.workingHours ? JSON.stringify(linkData.workingHours) : null,
      meetingLocation: linkData.meetingLocation,
      requireEmail: linkData.requireEmail !== undefined ? linkData.requireEmail : true,
      requireName: linkData.requireName !== undefined ? linkData.requireName : true,
      requirePhone: linkData.requirePhone || false,
      customFields: linkData.customFields ? JSON.stringify(linkData.customFields) : null,
      autoConfirm: linkData.autoConfirm !== undefined ? linkData.autoConfirm : true,
      sendReminderEmail: linkData.sendReminderEmail !== undefined ? linkData.sendReminderEmail : true,
      isActive: linkData.isActive !== undefined ? linkData.isActive : true,
    };

    let link;
    if (linkId) {
      link = await SchedulingLink.findByPk(linkId);
      if (!link || link.masterUserID !== userId) {
        throw new Error("Scheduling link not found or access denied");
      }
      await link.update(linkConfig);
    } else {
      link = await SchedulingLink.create(linkConfig);
    }

    return link;
  }

  /**
   * Get scheduling link by token (for public access)
   * @param {string} token - Unique token
   * @returns {Promise<Object>} Link configuration
   */
  async getLinkByToken(token) {
    const link = await SchedulingLink.findOne({
      where: { uniqueToken: token, isActive: true },
      include: [
        {
          model: require("../models/master/masterUserModel"),
          as: "owner",
          attributes: ["masterUserID", "name", "email"],
        },
      ],
    });

    if (!link) {
      throw new Error("Scheduling link not found or inactive");
    }

    return link;
  }

  /**
   * Get available slots for a scheduling link
   * @param {Object} options - Options
   * @param {string} options.token - Link token
   * @param {Date|string} options.startDate - Start date to check from
   * @param {Date|string} options.endDate - End date to check until
   * @returns {Promise<Array>} Available slots
   */
  async getAvailableSlotsForLink(options) {
    const { token, startDate, endDate } = options;

    const link = await this.getLinkByToken(token);
    const owner = link.owner;

    // Calculate date range
    const now = moment();
    const maxDate = moment(startDate || now).add(link.advanceBookingDays, "days");
    const searchEndDate = endDate || maxDate.toDate();
    const searchStartDate = startDate || now.toDate();

    // Check if Google Calendar is connected (primary source for availability)
    const isGoogleCalendarConnected = await googleCalendarService.isConnected(link.masterUserID);

    let slots = [];
    let source = 'working_hours'; // Track where slots came from

    if (isGoogleCalendarConnected) {
      try {
        // Get slots from Google Calendar (real-time availability)
        slots = await googleCalendarService.getAvailableSlots({
          userId: link.masterUserID,
          startDate: searchStartDate,
          endDate: searchEndDate,
          durationMinutes: link.durationMinutes + link.bufferTimeBefore + link.bufferTimeAfter,
          timezone: link.timezone,
        });
        source = 'google_calendar';
      } catch (error) {
        console.error("Failed to get slots from Google Calendar, falling back to working hours:", error);
        // Fallback to working hours if Google Calendar fails
        slots = this.generateSlotsFromWorkingHours({
          startDate: searchStartDate,
          endDate: searchEndDate,
          durationMinutes: link.durationMinutes,
          workingHours: link.workingHours ? JSON.parse(link.workingHours) : null,
          timezone: link.timezone,
        });
        source = 'working_hours_fallback';
      }
    } else {
      // Generate slots based on working hours (if no Google Calendar)
      slots = this.generateSlotsFromWorkingHours({
        startDate: searchStartDate,
        endDate: searchEndDate,
        durationMinutes: link.durationMinutes,
        workingHours: link.workingHours ? JSON.parse(link.workingHours) : null,
        timezone: link.timezone,
      });
      source = 'working_hours';
    }

    // Filter slots based on working hours if provided
    if (link.workingHours) {
      const workingHours = JSON.parse(link.workingHours);
      slots = this.filterSlotsByWorkingHours(slots, workingHours, link.timezone);
    }

    // Apply buffer times
    slots = slots.map(slot => ({
      ...slot,
      start: moment(slot.start).add(link.bufferTimeBefore, "minutes").toISOString(),
      end: moment(slot.end).subtract(link.bufferTimeAfter, "minutes").toISOString(),
      durationMinutes: link.durationMinutes,
    }));

    // Remove past slots
    slots = slots.filter(slot => moment(slot.start).isAfter(now));

    // Sort by start time
    slots.sort((a, b) => moment(a.start).diff(moment(b.start)));

    // Add source metadata to first slot (for debugging/logging)
    if (slots.length > 0) {
      slots[0]._source = source; // Metadata, can be removed in production
    }

    return slots;
  }

  /**
   * Generate slots from working hours (fallback when Google Calendar not connected)
   * @param {Object} options - Options
   * @returns {Array} Generated slots
   */
  generateSlotsFromWorkingHours(options) {
    const { startDate, endDate, durationMinutes, workingHours, timezone } = options;
    const slots = [];
    const now = moment.tz(timezone);

    // Default working hours (9 AM - 5 PM, Mon-Fri)
    const defaultHours = {
      1: { start: "09:00", end: "17:00" }, // Monday
      2: { start: "09:00", end: "17:00" }, // Tuesday
      3: { start: "09:00", end: "17:00" }, // Wednesday
      4: { start: "09:00", end: "17:00" }, // Thursday
      5: { start: "09:00", end: "17:00" }, // Friday
    };

    const hours = workingHours || defaultHours;

    let currentDate = moment.tz(startDate, timezone);
    const endMoment = moment.tz(endDate, timezone);

    while (currentDate.isBefore(endMoment)) {
      const dayOfWeek = currentDate.day();
      const dayHours = hours[dayOfWeek];

      if (dayHours && currentDate.isAfter(now)) {
        const dayStart = moment.tz(
          `${currentDate.format("YYYY-MM-DD")} ${dayHours.start}`,
          timezone
        );
        const dayEnd = moment.tz(
          `${currentDate.format("YYYY-MM-DD")} ${dayHours.end}`,
          timezone
        );

        let slotStart = dayStart;
        while (slotStart.clone().add(durationMinutes, "minutes").isBefore(dayEnd)) {
          const slotEnd = slotStart.clone().add(durationMinutes, "minutes");
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            startLocal: slotStart.format("YYYY-MM-DD HH:mm"),
            endLocal: slotEnd.format("YYYY-MM-DD HH:mm"),
            durationMinutes,
          });
          slotStart.add(30, "minutes"); // 30-minute intervals
        }
      }

      currentDate.add(1, "day");
    }

    return slots;
  }

  /**
   * Filter slots by working hours
   * @param {Array} slots - Slots to filter
   * @param {Object} workingHours - Working hours configuration
   * @param {string} timezone - Timezone
   * @returns {Array} Filtered slots
   */
  filterSlotsByWorkingHours(slots, workingHours, timezone) {
    return slots.filter(slot => {
      const slotMoment = moment.tz(slot.start, timezone);
      const dayOfWeek = slotMoment.day();
      const dayHours = workingHours[dayOfWeek];

      if (!dayHours) return false;

      const slotTime = slotMoment.format("HH:mm");
      return slotTime >= dayHours.start && slotTime <= dayHours.end;
    });
  }

  /**
   * Book a meeting from slot selection
   * @param {Object} options - Booking options
   * @param {string} options.token - Link token
   * @param {string} options.selectedSlotStart - Selected slot start time
   * @param {string} options.attendeeName - Attendee name
   * @param {string} options.attendeeEmail - Attendee email
   * @param {string} options.attendeePhone - Attendee phone (optional)
   * @param {Object} options.customFields - Custom field values (optional)
   * @param {string} options.meetingTitle - Custom meeting title (optional)
   * @param {string} options.meetingDescription - Custom meeting description (optional)
   * @returns {Promise<Object>} Created meeting
   */
  async bookMeetingFromSlot(options) {
    const {
      token,
      selectedSlotStart,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      customFields,
      meetingTitle,
      meetingDescription,
    } = options;

    // Get link configuration
    const link = await this.getLinkByToken(token);
    const owner = link.owner;

    // Validate required fields
    if (link.requireEmail && !attendeeEmail) {
      throw new Error("Email is required");
    }
    if (link.requireName && !attendeeName) {
      throw new Error("Name is required");
    }
    if (link.requirePhone && !attendeePhone) {
      throw new Error("Phone is required");
    }

    // Calculate meeting times
    const startMoment = moment(selectedSlotStart);
    const endMoment = startMoment.clone().add(link.durationMinutes, "minutes");

    // Create meeting subject
    const subject = meetingTitle || `${link.title} - ${attendeeName}`;

    // Create meeting description
    let description = meetingDescription || link.description || "";
    if (customFields && Object.keys(customFields).length > 0) {
      description += "\n\nAdditional Information:\n";
      Object.entries(customFields).forEach(([key, value]) => {
        description += `${key}: ${value}\n`;
      });
    }

    // Create or find person in CRM
    const Person = require("../models/leads/leadPersonModel");
    let person = await Person.findOne({ where: { email: attendeeEmail } });
    
    if (!person) {
      person = await Person.create({
        contactPerson: attendeeName,
        email: attendeeEmail,
        phone: attendeePhone || null,
        masterUserID: link.masterUserID,
      });
    } else {
      // Update person if needed
      const updates = {};
      if (!person.contactPerson) updates.contactPerson = attendeeName;
      if (!person.phone && attendeePhone) updates.phone = attendeePhone;
      if (Object.keys(updates).length > 0) {
        await person.update(updates);
      }
    }

    // Create Activity
    const Activity = require("../models/activity/activityModel");
    const activity = await Activity.create({
      type: "Meeting",
      subject,
      description,
      startDateTime: startMoment.utc().toDate(),
      endDateTime: endMoment.utc().toDate(),
      location: link.meetingLocation,
      assignedTo: link.masterUserID,
      personId: person.personId,
      masterUserID: link.masterUserID,
      isDone: false,
    });

    // Create Meeting with Google Calendar integration
    const Meeting = require("../models/meeting/meetingModel");
    const { v4: uuidv4 } = require("uuid");
    
    const icsUid = `${uuidv4()}@${owner.email.split("@")[1]}`;
    const meeting = await Meeting.create({
      activityId: activity.activityId,
      timezone: link.timezone,
      meetingStatus: link.autoConfirm ? "confirmed" : "scheduled",
      organizerEmail: owner.email,
      organizerName: owner.name || owner.email.split("@")[0],
      icsUid,
      sendInvites: true,
      masterUserID: link.masterUserID,
      externalAttendees: JSON.stringify([{ name: attendeeName, email: attendeeEmail }]),
    });

    // Create in Google Calendar and generate Google Meet link if connected
    let googleCalendarInfo = null;
    try {
      const isConnected = await googleCalendarService.isConnected(link.masterUserID);
      if (isConnected) {
        const googleEvent = await googleCalendarService.createEvent({
          userId: link.masterUserID,
          summary: subject,
          description,
          startDateTime: startMoment.toDate(),
          endDateTime: endMoment.toDate(),
          timezone: link.timezone,
          location: link.meetingLocation || 'Google Meet',
          attendees: [attendeeEmail],
          createMeetLink: true, // Always create Google Meet link when using Google Calendar
        });

        // Update meeting with Google Calendar info
        await activity.update({ calendar_event_id: googleEvent.eventId });
        
        // Save Google Meet link
        const meetLink = googleEvent.meetLink || googleEvent.hangoutLink;
        if (meetLink) {
          await meeting.update({ meetingUrl: meetLink });
        }

        googleCalendarInfo = {
          eventId: googleEvent.eventId,
          htmlLink: googleEvent.htmlLink,
          meetLink: meetLink,
          calendarAdded: true,
        };
      } else {
        googleCalendarInfo = {
          calendarAdded: false,
          message: 'Google Calendar not connected',
        };
      }
    } catch (error) {
      console.error("Failed to create Google Calendar event:", error);
      googleCalendarInfo = {
        calendarAdded: false,
        error: error.message,
      };
      // Continue without Google Calendar - meeting still created in CRM
    }

    // Update link statistics
    await link.update({
      bookingCount: link.bookingCount + 1,
      lastUsedAt: new Date(),
    });

    // Send confirmation email if enabled
    if (link.sendReminderEmail && attendeeEmail) {
      const MeetingEmailService = require("./meetingEmailService");
      try {
        await MeetingEmailService.sendMeetingInvite({
          activity,
          meeting,
          organizerEmail: owner.email,
          attendees: [{ name: attendeeName, email: attendeeEmail }],
        });
      } catch (error) {
        console.error("Failed to send confirmation email:", error);
      }
    }

    return {
      meeting,
      activity,
      person,
      googleCalendar: googleCalendarInfo,
      success: true,
      message: link.autoConfirm ? "Meeting booked and confirmed" : "Meeting booked successfully",
    };
  }

  /**
   * Get all scheduling links for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Scheduling links
   */
  async getUserLinks(userId) {
    return await SchedulingLink.findAll({
      where: { masterUserID: userId },
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Delete a scheduling link
   * @param {number} userId - User ID
   * @param {number} linkId - Link ID
   * @returns {Promise<void>}
   */
  async deleteLink(userId, linkId) {
    const link = await SchedulingLink.findByPk(linkId);
    if (!link || link.masterUserID !== userId) {
      throw new Error("Scheduling link not found or access denied");
    }
    await link.destroy();
  }
}

module.exports = new SchedulingLinkService();

