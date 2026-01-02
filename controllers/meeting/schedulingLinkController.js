const schedulingLinkService = require("../../services/schedulingLinkService");
const SchedulingLink = require("../../models/meeting/schedulingLinkModel");
const MasterUser = require("../../models/master/masterUserModel");
const googleCalendarService = require("../../services/googleCalendarService");
const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Create or update a scheduling link
 * POST /api/meetings/scheduling-links
 * PUT /api/meetings/scheduling-links/:id
 */
exports.createOrUpdateLink = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;
    if (!masterUserID) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { linkId } = req.params;
    const linkData = req.body;

    const link = await schedulingLinkService.createOrUpdateLink({
      userId: masterUserID,
      linkData,
      linkId,
    });

    // Generate full booking URL
    const bookingUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/meeting-link/${link.uniqueToken}`;

    res.json({
      message: linkId
        ? "Scheduling link updated successfully"
        : "Scheduling link created successfully",
      link,
      bookingUrl,
    });
  } catch (error) {
    console.error("Error creating/updating scheduling link:", error);
    res.status(500).json({
      message: "Failed to create/update scheduling link",
      error: error.message,
    });
  }
};

/**
 * Get all scheduling links for user
 * GET /api/meetings/scheduling-links
 */
exports.getUserLinks = async (req, res) => {
  try {
    console.log("Fetching scheduling links for user");
    const masterUserID = req.adminId || req.user?.id;
    if (!masterUserID) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const links = await schedulingLinkService.getUserLinks(masterUserID);

    // Add booking URLs
    const linksWithUrls = links.map((link) => ({
      ...link.toJSON(),
      bookingUrl: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/book/${link.uniqueToken}`,
    }));

    res.json({
      links: linksWithUrls,
      count: links.length,
    });
  } catch (error) {
    console.error("Error fetching scheduling links:", error);
    res.status(500).json({
      message: "Failed to fetch scheduling links",
      error: error.message,
    });
  }
};

/**
 * Get scheduling link by ID
 * GET /api/meetings/scheduling-links/:id
 */
exports.getLinkById = async (req, res) => {
  try {
    const { id } = req.params;

    const link = await SchedulingLink.findOne({
      where: { uniqueToken: id },
      include: [
        {
          model: MasterUser,
          as: "owner",
          attributes: ["masterUserID", "name", "email"],
        },
      ],
    });

    if (!link) {
      return res.status(404).json({
        message: "Scheduling link not found",
      });
    }

    // Parse working hours safely
    let workingHours;
    try {
      workingHours =
        typeof link.workingHours === "string"
          ? JSON.parse(link.workingHours)
          : link.workingHours;
    } catch (err) {
      return res.status(500).json({
        message: "Invalid working hours format",
      });
    }

    const bookingUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/book/${link.uniqueToken}`;

    res.json({
      bookingUrl,
      owner: link.owner,
      dates: JSON.parse(JSON.parse(link.workingHours)),
    });
  } catch (error) {
    console.error("Error fetching scheduling link:", error);
    res.status(500).json({
      message: "Failed to fetch scheduling link",
      error: error.message,
    });
  }
};

/**
 * Delete a scheduling link
 * DELETE /api/meetings/scheduling-links/:id
 */
exports.deleteLink = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;
    if (!masterUserID) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    await schedulingLinkService.deleteLink(masterUserID, id);

    res.json({ message: "Scheduling link deleted successfully" });
  } catch (error) {
    console.error("Error deleting scheduling link:", error);
    res.status(500).json({
      message: "Failed to delete scheduling link",
      error: error.message,
    });
  }
};

/**
 * PUBLIC: Get available slots for a scheduling link (no auth required)
 * GET /api/meetings/scheduling/:token/available-slots
 *
 * Query Parameters:
 * - startDate (optional): Start date in ISO format (default: today)
 * - endDate (optional): End date in ISO format (default: today + advanceBookingDays)
 * - groupByDate (optional): Group slots by date (default: false)
 * - timezone (optional): Timezone for date formatting (default: link timezone)
 */
exports.getAvailableSlotsPublic = async (req, res) => {
  try {
    const { token } = req.params;
    const { startDate, endDate, groupByDate, timezone } = req.query;

    // Get link details first to include in response
    const link = await schedulingLinkService.getLinkByToken(token);

    // Get available slots
    const slots = await schedulingLinkService.getAvailableSlotsForLink({
      token,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // Format slots with additional information
    const formattedSlots = slots.map((slot) => ({
      start: slot.start,
      end: slot.end,
      startLocal: slot.startLocal,
      endLocal: slot.endLocal,
      durationMinutes: slot.durationMinutes,
      date: slot.startLocal.split(" ")[0], // Extract date part
      time: slot.startLocal.split(" ")[1], // Extract time part
    }));

    // Group by date if requested
    let groupedSlots = null;
    if (groupByDate === "true" || groupByDate === true) {
      groupedSlots = formattedSlots.reduce((acc, slot) => {
        const date = slot.date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push({
          start: slot.start,
          end: slot.end,
          startLocal: slot.startLocal,
          endLocal: slot.endLocal,
          time: slot.time,
          durationMinutes: slot.durationMinutes,
        });
        return acc;
      }, {});
    }

    // Determine source (Google Calendar or working hours)
    const source =
      slots.length > 0 && slots[0]._source
        ? slots[0]._source
        : (await googleCalendarService.isConnected(link.masterUserID))
        ? "google_calendar"
        : "working_hours";

    // Remove metadata from response
    const cleanSlots = formattedSlots.map(({ date, time, ...rest }) => rest);

    // Prepare response
    const response = {
      success: true,
      link: {
        title: link.title,
        durationMinutes: link.durationMinutes,
        timezone: link.timezone,
      },
      slots: cleanSlots,
      count: cleanSlots.length,
      source: source,
      metadata: {
        timezone: link.timezone,
        durationMinutes: link.durationMinutes,
        bufferTimeBefore: link.bufferTimeBefore,
        bufferTimeAfter: link.bufferTimeAfter,
      },
    };

    // Add grouped slots if requested
    if (groupedSlots) {
      response.groupedByDate = groupedSlots;
      response.dates = Object.keys(groupedSlots).sort();
    }

    // Add date range info
    if (cleanSlots.length > 0) {
      response.dateRange = {
        earliest: cleanSlots[0].startLocal.split(" ")[0],
        latest: cleanSlots[cleanSlots.length - 1].startLocal.split(" ")[0],
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Error getting available slots:", error);

    // Handle specific error cases
    if (
      error.message.includes("not found") ||
      error.message.includes("inactive")
    ) {
      return res.status(404).json({
        success: false,
        message: "Scheduling link not found or inactive",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to get available slots",
      error: error.message,
    });
  }
};

/**
 * PUBLIC: Get scheduling link details (no auth required)
 * GET /api/meetings/scheduling/:token
 */
exports.getLinkDetailsPublic = async (req, res) => {
  try {
    const { token } = req.params;

    const link = await schedulingLinkService.getLinkByToken(token);
    const owner = link.owner;

    // Return public-facing information only
    res.json({
      title: link.title,
      description: link.description,
      durationMinutes: link.durationMinutes,
      timezone: link.timezone,
      requireEmail: link.requireEmail,
      requireName: link.requireName,
      requirePhone: link.requirePhone,
      customFields: link.customFields ? JSON.parse(link.customFields) : null,
      organizerName: owner.name || owner.email,
    });
  } catch (error) {
    console.error("Error getting link details:", error);
    res.status(404).json({
      message: "Scheduling link not found or inactive",
      error: error.message,
    });
  }
};

/**
 * PUBLIC: Book a meeting from slot selection (no auth required)
 * POST /api/meetings/scheduling/:token/book
 */
exports.bookMeeting = async (req, res) => {
  try {
    const { token } = req.params;
    const {
      selectedSlotStart,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      customFields,
      meetingTitle,
      meetingDescription,
    } = req.body;

    if (!selectedSlotStart || !attendeeName || !attendeeEmail) {
      return res.status(400).json({
        message:
          "selectedSlotStart, attendeeName, and attendeeEmail are required",
      });
    }

    const result = await schedulingLinkService.bookMeetingFromSlot({
      token,
      selectedSlotStart,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      customFields,
      meetingTitle,
      meetingDescription,
    });

    res.status(201).json({
      message: result.message,
      meeting: {
        meetingId: result.meeting.meetingId,
        subject: result.activity.subject,
        startDateTime: result.activity.startDateTime,
        endDateTime: result.activity.endDateTime,
        meetingUrl: result.meeting.meetingUrl,
      },
      googleCalendar: result.googleCalendar,
      googleMeetLink:
        result.googleCalendar?.meetLink || result.meeting.meetingUrl,
      success: true,
    });
  } catch (error) {
    console.error("Error booking meeting:", error);
    res.status(500).json({
      message: "Failed to book meeting",
      error: error.message,
    });
  }
};

exports.bookGoogleMeet = async (req, res) => {
  try {
    const { masterUserId, summary, description, start, end, email,durationMinutes } = req.body;
    const user = await MasterUser.findByPk(masterUserId);
    if (!user || !user.googleOAuthToken) {
      return res.status(400).json({
        message: "User not connected to Google Calendar",
      });
    }

    await oauth2Client.setCredentials({
      refresh_token: user.googleOAuthToken,
    });

    const startDateTime = moment.tz(start, timezone);
    const endDateTime = startDateTime.clone().add(durationMinutes, "minutes");
    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });
    const event = {
      summary: summary,
      description,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: timezone,
      },
      attendees: email.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: "all",
    });

    return {
      eventId: response.data.id,
      meetLink: response.data.hangoutLink,
    };
  } catch (e) {
    console.error("Error booking Google Meet:", e);
    res.status(500).json({
      message: "Failed to book Google Meet",
      error: e.message,
    });
  }
};

exports.getTimeSlots = async (req, res) => {
  try {
    const { id, date } = req.query;

    const availableSlots = await SchedulingLink.findOne({
      where: { uniqueToken: id },
    });

    // console
    const workingHours = await JSON.parse(availableSlots.workingHours);

    const works = JSON.parse(workingHours);

    const slots = await works[date];
    res.status(200).json({
      message: "Time slots retrieved successfully",
      slots: slots,
    });
  } catch (error) {
    console.error("Error getting time slots:", error);
    res.status(500).json({
      message: "Failed to get time slots",
      error: error.message,
    });
  }
};
