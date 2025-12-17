const Activity = require("../../models/activity/activityModel");
const Meeting = require("../../models/meeting/meetingModel");
const MasterUser = require("../../models/master/masterUserModel");
const Person = require("../../models/leads/leadPersonModel");
const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const MeetingService = require("../../services/meetingService");
const MeetingEmailService = require("../../services/meetingEmailService");
const googleCalendarService = require("../../services/googleCalendarService");
const { Op } = require("sequelize");
const moment = require("moment-timezone");
const { v4: uuidv4 } = require("uuid");

/**
 * Create a new meeting
 * POST /api/meetings
 */
exports.createMeeting = async (req, res) => {
  try {
    const {
      subject,
      description,
      startDateTime,
      endDateTime,
      location,
      meetingUrl,
      timezone,
      personIds,
      userIds,
      externalAttendees,
      dealId,
      leadId,
      personId,
      leadOrganizationId,
      priority,
      reminderMinutes,
      recurrenceRule,
      recurrenceEndDate,
      sendInvites = true,
      checkConflicts = true,
    } = req.body;

    const masterUserID = req.adminId || req.user?.id;
    if (!masterUserID) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Validation
    if (!subject || !startDateTime) {
      return res.status(400).json({
        message: "Subject and startDateTime are required",
      });
    }

    if (!endDateTime) {
      return res.status(400).json({
        message: "endDateTime is required for meetings",
      });
    }

    // Validate timezone
    const meetingTimezone = timezone || (await MeetingService.getUserTimezone(masterUserID));
    if (!MeetingService.isValidTimezone(meetingTimezone)) {
      return res.status(400).json({
        message: "Invalid timezone provided",
      });
    }

    // Get organizer info
    const organizer = await MasterUser.findByPk(masterUserID);
    if (!organizer || !organizer.email) {
      return res.status(400).json({
        message: "Organizer email not found",
      });
    }

    // Convert dates to UTC for storage
    const startUTC = MeetingService.convertToTimezone(startDateTime, meetingTimezone);
    const endUTC = MeetingService.convertToTimezone(endDateTime, meetingTimezone);

    // Check conflicts if requested
    if (checkConflicts) {
      const conflictCheck = await MeetingService.checkConflicts({
        startDateTime: startUTC,
        endDateTime: endUTC,
        userId: masterUserID,
        attendeeIds: userIds || [],
        timezone: meetingTimezone,
      });

      if (conflictCheck.hasConflicts) {
        return res.status(409).json({
          message: "Meeting conflicts detected",
          conflicts: conflictCheck,
        });
      }
    }

    // Prepare attendees
    const attendees = await MeetingService.prepareAttendees({
      personIds: personIds || (personId ? [personId] : []),
      userIds: userIds || [],
      externalEmails: externalAttendees || [],
    });

    // Create Activity first
    const activity = await Activity.create({
      type: "Meeting",
      subject,
      description,
      startDateTime: startUTC,
      endDateTime: endUTC,
      location,
      videoCallIntegration: meetingUrl,
      priority,
      assignedTo: masterUserID,
      dealId,
      leadId,
      personId,
      leadOrganizationId,
      masterUserID,
      isDone: false,
    });

    // Generate unique ICS UID
    const icsUid = `${uuidv4()}@${organizer.email.split("@")[1]}`;

    // Prepare attendee emails for Google Calendar
    const attendeeEmails = attendees.map(a => a.email);

    // Create event in Google Calendar if connected
    let googleCalendarEvent = null;
    let googleMeetLink = meetingUrl;
    let googleEventId = null;

    const useGoogleCalendar = req.body.useGoogleCalendar !== false; // Default to true
    if (useGoogleCalendar) {
      try {
        const isConnected = await googleCalendarService.isConnected(masterUserID);
        if (isConnected) {
          googleCalendarEvent = await googleCalendarService.createEvent({
            userId: masterUserID,
            summary: subject,
            description: description,
            startDateTime: startDateTime,
            endDateTime: endDateTime,
            timezone: meetingTimezone,
            location: location,
            attendees: attendeeEmails,
            createMeetLink: !meetingUrl, // Only create Meet link if URL not provided
          });

          googleMeetLink = googleCalendarEvent.meetLink || googleCalendarEvent.hangoutLink || meetingUrl;
          googleEventId = googleCalendarEvent.eventId;
        }
      } catch (googleError) {
        console.error("Failed to create Google Calendar event:", googleError);
        // Continue without Google Calendar if it fails
      }
    }

    // Create Meeting record
    const meeting = await Meeting.create({
      activityId: activity.activityId,
      timezone: meetingTimezone,
      meetingStatus: "scheduled",
      recurrenceRule,
      recurrenceEndDate: recurrenceEndDate ? MeetingService.convertToTimezone(recurrenceEndDate, meetingTimezone) : null,
      reminderMinutes: reminderMinutes ? JSON.stringify(reminderMinutes) : null,
      meetingUrl: googleMeetLink || meetingUrl,
      organizerEmail: organizer.email,
      organizerName: organizer.name || organizer.email.split("@")[0],
      icsUid,
      sendInvites: useGoogleCalendar && googleCalendarEvent ? false : sendInvites, // Don't send email invites if Google Calendar sends them
      masterUserID,
      externalAttendees: externalAttendees ? JSON.stringify(externalAttendees) : null,
    });

    // Update Activity with Google Calendar event ID
    if (googleEventId) {
      await activity.update({ calendar_event_id: googleEventId });
    }

    // Send invites if requested
    let emailResults = [];
    if (sendInvites && attendees.length > 0) {
      try {
        emailResults = await MeetingEmailService.sendMeetingInvite({
          activity,
          meeting,
          organizerEmail: organizer.email,
          attendees,
        });
        await meeting.update({ lastSentAt: new Date() });
      } catch (emailError) {
        console.error("Failed to send meeting invites:", emailError);
        // Don't fail the meeting creation if email fails
      }
    }

    // Fetch complete meeting with associations
    const createdMeeting = await Meeting.findByPk(meeting.meetingId, {
      include: [
        {
          model: Activity,
          as: "activity",
          include: [
            { model: Person, as: "ActivityPerson" },
            { model: Organization, as: "ActivityOrganization" },
            { model: Deal, as: "ActivityDeal" },
            { model: Lead, as: "ActivityLead" },
          ],
        },
        { model: MasterUser, as: "owner" },
      ],
    });

    res.status(201).json({
      message: "Meeting created successfully",
      meeting: createdMeeting,
      emailResults,
      googleCalendar: googleCalendarEvent ? {
        eventId: googleEventId,
        htmlLink: googleCalendarEvent.htmlLink,
        meetLink: googleMeetLink,
      } : null,
    });
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({
      message: "Failed to create meeting",
      error: error.message,
    });
  }
};

/**
 * Get all meetings for a user
 * GET /api/meetings
 */
exports.getMeetings = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;
    if (!masterUserID) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      status,
      startDate,
      endDate,
      dealId,
      leadId,
      personId,
      page = 1,
      limit = 50,
    } = req.query;

    const where = { masterUserID };

    if (status) {
      where.meetingStatus = status;
    }

    if (startDate || endDate) {
      const activityWhere = {};
      if (startDate) {
        activityWhere.startDateTime = { [Op.gte]: new Date(startDate) };
      }
      if (endDate) {
        activityWhere.endDateTime = { [Op.lte]: new Date(endDate) };
      }
    }

    const include = [
      {
        model: Activity,
        as: "activity",
        where: startDate || endDate
          ? {
              ...(startDate && { startDateTime: { [Op.gte]: new Date(startDate) } }),
              ...(endDate && { endDateTime: { [Op.lte]: new Date(endDate) } }),
              ...(dealId && { dealId }),
              ...(leadId && { leadId }),
              ...(personId && { personId }),
            }
          : {
              ...(dealId && { dealId }),
              ...(leadId && { leadId }),
              ...(personId && { personId }),
            },
        include: [
          { model: Person, as: "ActivityPerson" },
          { model: Organization, as: "ActivityOrganization" },
          { model: Deal, as: "ActivityDeal" },
          { model: Lead, as: "ActivityLead" },
          { model: MasterUser, as: "assignedUser" },
        ],
      },
      { model: MasterUser, as: "owner" },
    ];

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: meetings } = await Meeting.findAndCountAll({
      where,
      include,
      order: [["activity", "startDateTime", "ASC"]],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      meetings,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({
      message: "Failed to fetch meetings",
      error: error.message,
    });
  }
};

/**
 * Get a single meeting by ID
 * GET /api/meetings/:id
 */
exports.getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;
    const masterUserID = req.adminId || req.user?.id;

    const meeting = await Meeting.findByPk(id, {
      include: [
        {
          model: Activity,
          as: "activity",
          include: [
            { model: Person, as: "ActivityPerson" },
            { model: Organization, as: "ActivityOrganization" },
            { model: Deal, as: "ActivityDeal" },
            { model: Lead, as: "ActivityLead" },
            { model: MasterUser, as: "assignedUser" },
          ],
        },
        { model: MasterUser, as: "owner" },
        { model: MasterUser, as: "cancelledByUser" },
      ],
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check permissions (user should own the meeting or be assigned to it)
    if (
      meeting.masterUserID !== masterUserID &&
      meeting.activity.assignedTo !== masterUserID
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ meeting });
  } catch (error) {
    console.error("Error fetching meeting:", error);
    res.status(500).json({
      message: "Failed to fetch meeting",
      error: error.message,
    });
  }
};

/**
 * Update a meeting
 * PUT /api/meetings/:id
 */
exports.updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const masterUserID = req.adminId || req.user?.id;

    const meeting = await Meeting.findByPk(id, {
      include: [{ model: Activity, as: "activity" }],
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check permissions
    if (meeting.masterUserID !== masterUserID && meeting.activity.assignedTo !== masterUserID) {
      return res.status(403).json({ message: "Access denied" });
    }

    const {
      subject,
      description,
      startDateTime,
      endDateTime,
      location,
      meetingUrl,
      timezone,
      personIds,
      userIds,
      externalAttendees,
      priority,
      reminderMinutes,
      recurrenceRule,
      recurrenceEndDate,
      sendUpdates = false,
      checkConflicts = true,
    } = req.body;

    // Validate timezone if provided
    const meetingTimezone = timezone || meeting.timezone;
    if (timezone && !MeetingService.isValidTimezone(meetingTimezone)) {
      return res.status(400).json({
        message: "Invalid timezone provided",
      });
    }

    // Update Activity if fields provided
    const activityUpdates = {};
    if (subject) activityUpdates.subject = subject;
    if (description !== undefined) activityUpdates.description = description;
    if (location !== undefined) activityUpdates.location = location;
    if (priority !== undefined) activityUpdates.priority = priority;
    if (meetingUrl !== undefined) activityUpdates.videoCallIntegration = meetingUrl;

    if (startDateTime || endDateTime) {
      const start = startDateTime || meeting.activity.startDateTime;
      const end = endDateTime || meeting.activity.endDateTime;
      activityUpdates.startDateTime = MeetingService.convertToTimezone(start, meetingTimezone);
      activityUpdates.endDateTime = MeetingService.convertToTimezone(end, meetingTimezone);
    }

    // Check conflicts if time changed
    if ((startDateTime || endDateTime) && checkConflicts) {
      const startUTC = activityUpdates.startDateTime || meeting.activity.startDateTime;
      const endUTC = activityUpdates.endDateTime || meeting.activity.endDateTime;

      const conflictCheck = await MeetingService.checkConflicts({
        startDateTime: startUTC,
        endDateTime: endUTC,
        userId: masterUserID,
        attendeeIds: userIds || [],
        excludeMeetingId: meeting.activityId,
        timezone: meetingTimezone,
      });

      if (conflictCheck.hasConflicts) {
        return res.status(409).json({
          message: "Meeting conflicts detected",
          conflicts: conflictCheck,
        });
      }
    }

    // Update Google Calendar event if connected and event exists
    let googleCalendarUpdate = null;
    if (meeting.activity.calendar_event_id) {
      try {
        const isConnected = await googleCalendarService.isConnected(masterUserID);
        if (isConnected) {
          const calendarUpdates = {};
          if (subject) calendarUpdates.summary = subject;
          if (description !== undefined) calendarUpdates.description = description;
          if (location !== undefined) calendarUpdates.location = location;
          
          if (startDateTime || endDateTime) {
            calendarUpdates.startDateTime = startDateTime || meeting.activity.startDateTime;
            calendarUpdates.endDateTime = endDateTime || meeting.activity.endDateTime;
            calendarUpdates.timezone = meetingTimezone;
          }

          if (Object.keys(calendarUpdates).length > 0) {
            googleCalendarUpdate = await googleCalendarService.updateEvent({
              userId: masterUserID,
              eventId: meeting.activity.calendar_event_id,
              updates: calendarUpdates,
            });
          }
        }
      } catch (googleError) {
        console.error("Failed to update Google Calendar event:", googleError);
      }
    }

    // Update Meeting
    const meetingUpdates = {};

    // Update meeting URL if Google Meet link was updated
    if (googleCalendarUpdate && googleCalendarUpdate.meetLink) {
      meetingUpdates.meetingUrl = googleCalendarUpdate.meetLink;
    }
    if (timezone) meetingUpdates.timezone = timezone;
    if (meetingUrl !== undefined) meetingUpdates.meetingUrl = meetingUrl;
    if (reminderMinutes !== undefined) {
      meetingUpdates.reminderMinutes = reminderMinutes ? JSON.stringify(reminderMinutes) : null;
    }
    if (recurrenceRule !== undefined) meetingUpdates.recurrenceRule = recurrenceRule;
    if (recurrenceEndDate !== undefined) {
      meetingUpdates.recurrenceEndDate = recurrenceEndDate
        ? MeetingService.convertToTimezone(recurrenceEndDate, meetingTimezone)
        : null;
    }
    if (externalAttendees !== undefined) {
      meetingUpdates.externalAttendees = externalAttendees ? JSON.stringify(externalAttendees) : null;
    }

    if (Object.keys(meetingUpdates).length > 0) {
      await meeting.update(meetingUpdates);
    }

    // Prepare attendees for email update
    let attendees = [];
    if (sendUpdates) {
      attendees = await MeetingService.prepareAttendees({
        personIds: personIds || [],
        userIds: userIds || [],
        externalEmails: externalAttendees || (meeting.externalAttendees ? JSON.parse(meeting.externalAttendees) : []),
      });
    }

    // Send update emails if requested
    let emailResults = [];
    if (sendUpdates && attendees.length > 0) {
      try {
        emailResults = await MeetingEmailService.sendMeetingUpdate({
          activity: meeting.activity,
          meeting,
          organizerEmail: meeting.organizerEmail,
          attendees,
        });
        await meeting.update({ lastSentAt: new Date() });
      } catch (emailError) {
        console.error("Failed to send meeting updates:", emailError);
      }
    }

    // Fetch updated meeting
    const updatedMeeting = await Meeting.findByPk(id, {
      include: [
        {
          model: Activity,
          as: "activity",
          include: [
            { model: Person, as: "ActivityPerson" },
            { model: Organization, as: "ActivityOrganization" },
            { model: Deal, as: "ActivityDeal" },
            { model: Lead, as: "ActivityLead" },
          ],
        },
        { model: MasterUser, as: "owner" },
      ],
    });

    res.json({
      message: "Meeting updated successfully",
      meeting: updatedMeeting,
      emailResults,
    });
  } catch (error) {
    console.error("Error updating meeting:", error);
    res.status(500).json({
      message: "Failed to update meeting",
      error: error.message,
    });
  }
};

/**
 * Cancel a meeting
 * DELETE /api/meetings/:id
 */
exports.cancelMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason, sendCancellation = true } = req.body;
    const masterUserID = req.adminId || req.user?.id;

    const meeting = await Meeting.findByPk(id, {
      include: [{ model: Activity, as: "activity" }],
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check permissions
    if (meeting.masterUserID !== masterUserID && meeting.activity.assignedTo !== masterUserID) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Cancel in Google Calendar if event exists
    if (meeting.activity.calendar_event_id) {
      try {
        const isConnected = await googleCalendarService.isConnected(masterUserID);
        if (isConnected) {
          await googleCalendarService.deleteEvent({
            userId: masterUserID,
            eventId: meeting.activity.calendar_event_id,
            sendUpdates: sendCancellation, // Google Calendar will send cancellation emails
          });
        }
      } catch (googleError) {
        console.error("Failed to cancel Google Calendar event:", googleError);
      }
    }

    // Update meeting status
    await meeting.update({
      meetingStatus: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: masterUserID,
      cancellationReason,
    });

    // Mark activity as done
    await meeting.activity.update({ isDone: true });

    // Send cancellation emails
    let emailResults = [];
    if (sendCancellation) {
      try {
        // Get attendees
        const attendees = await MeetingService.prepareAttendees({
          personIds: meeting.activity.personId ? [meeting.activity.personId] : [],
          userIds: meeting.activity.assignedTo ? [meeting.activity.assignedTo] : [],
          externalEmails: meeting.externalAttendees ? JSON.parse(meeting.externalAttendees) : [],
        });

        emailResults = await MeetingEmailService.sendMeetingCancellation({
          activity: meeting.activity,
          meeting,
          organizerEmail: meeting.organizerEmail,
          attendees,
          cancellationReason,
        });
      } catch (emailError) {
        console.error("Failed to send cancellation emails:", emailError);
      }
    }

    res.json({
      message: "Meeting cancelled successfully",
      emailResults,
    });
  } catch (error) {
    console.error("Error cancelling meeting:", error);
    res.status(500).json({
      message: "Failed to cancel meeting",
      error: error.message,
    });
  }
};

/**
 * Check for conflicts
 * POST /api/meetings/check-conflicts
 */
exports.checkConflicts = async (req, res) => {
  try {
    const { startDateTime, endDateTime, userId, attendeeIds, timezone } = req.body;
    const masterUserID = req.adminId || req.user?.id;

    if (!startDateTime || !endDateTime) {
      return res.status(400).json({
        message: "startDateTime and endDateTime are required",
      });
    }

    const meetingTimezone = timezone || (await MeetingService.getUserTimezone(masterUserID));

    const conflicts = await MeetingService.checkConflicts({
      startDateTime,
      endDateTime,
      userId: userId || masterUserID,
      attendeeIds: attendeeIds || [],
      timezone: meetingTimezone,
    });

    res.json(conflicts);
  } catch (error) {
    console.error("Error checking conflicts:", error);
    res.status(500).json({
      message: "Failed to check conflicts",
      error: error.message,
    });
  }
};

/**
 * Get available time slots
 * GET /api/meetings/available-slots
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;
    if (!masterUserID) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      startDate,
      endDate,
      durationMinutes = 30,
      timezone,
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "startDate and endDate are required",
      });
    }

    const meetingTimezone = timezone || (await MeetingService.getUserTimezone(masterUserID));

    // Check if Google Calendar is connected
    const isConnected = await googleCalendarService.isConnected(masterUserID);
    if (!isConnected) {
      return res.status(400).json({
        message: "Google Calendar is not connected. Please connect your Google Calendar first.",
      });
    }

    // Get available slots from Google Calendar
    const slots = await googleCalendarService.getAvailableSlots({
      userId: masterUserID,
      startDate,
      endDate,
      durationMinutes: parseInt(durationMinutes),
      timezone: meetingTimezone,
    });

    res.json({
      slots,
      timezone: meetingTimezone,
      count: slots.length,
    });
  } catch (error) {
    console.error("Error getting available slots:", error);
    res.status(500).json({
      message: "Failed to get available slots",
      error: error.message,
    });
  }
};

/**
 * Check Google Calendar connection status
 * GET /api/meetings/calendar-status
 */
exports.getCalendarStatus = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;
    if (!masterUserID) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const isConnected = await googleCalendarService.isConnected(masterUserID);
    
    res.json({
      connected: isConnected,
      message: isConnected 
        ? "Google Calendar is connected" 
        : "Google Calendar is not connected",
    });
  } catch (error) {
    console.error("Error checking calendar status:", error);
    res.status(500).json({
      message: "Failed to check calendar status",
      error: error.message,
    });
  }
};

/**
 * Resend meeting invites
 * POST /api/meetings/:id/resend-invites
 */
exports.resendInvites = async (req, res) => {
  try {
    const { id } = req.params;
    const masterUserID = req.adminId || req.user?.id;

    const meeting = await Meeting.findByPk(id, {
      include: [{ model: Activity, as: "activity" }],
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check permissions
    if (meeting.masterUserID !== masterUserID) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get attendees
    const attendees = await MeetingService.prepareAttendees({
      personIds: meeting.activity.personId ? [meeting.activity.personId] : [],
      userIds: meeting.activity.assignedTo ? [meeting.activity.assignedTo] : [],
      externalEmails: meeting.externalAttendees ? JSON.parse(meeting.externalAttendees) : [],
    });

    // Send invites
    const emailResults = await MeetingEmailService.sendMeetingInvite({
      activity: meeting.activity,
      meeting,
      organizerEmail: meeting.organizerEmail,
      attendees,
    });

    await meeting.update({ lastSentAt: new Date() });

    res.json({
      message: "Invites resent successfully",
      emailResults,
    });
  } catch (error) {
    console.error("Error resending invites:", error);
    res.status(500).json({
      message: "Failed to resend invites",
      error: error.message,
    });
  }
};

