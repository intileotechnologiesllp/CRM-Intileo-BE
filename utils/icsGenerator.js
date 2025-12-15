const moment = require("moment-timezone");

/**
 * Generate an ICS (iCalendar) file content for meeting invites
 * @param {Object} meetingData - Meeting data object
 * @param {Object} meetingData.activity - Activity model instance
 * @param {Object} meetingData.meeting - Meeting model instance
 * @param {string} meetingData.organizerEmail - Organizer email
 * @param {string} meetingData.organizerName - Organizer name
 * @param {Array} meetingData.attendees - Array of attendee objects {name, email}
 * @param {string} meetingData.action - 'REQUEST', 'CANCEL', 'UPDATE'
 * @returns {string} ICS file content
 */
function generateICS(meetingData) {
  const {
    activity,
    meeting,
    organizerEmail,
    organizerName,
    attendees = [],
    action = "REQUEST",
  } = meetingData;

  if (!activity || !meeting) {
    throw new Error("Activity and Meeting data are required");
  }

  // Generate unique ID if not exists
  const uid = meeting.icsUid || `meeting-${activity.activityId}-${Date.now()}@${organizerEmail.split("@")[1]}`;

  // Format dates in UTC
  const timezone = meeting.timezone || "UTC";
  const startDate = moment.tz(activity.startDateTime, timezone);
  const endDate = moment.tz(activity.endDateTime || activity.startDateTime, timezone);

  // Format date for ICS (YYYYMMDDTHHmmssZ)
  const formatDate = (momentDate) => {
    return momentDate.utc().format("YYYYMMDDTHHmmss[Z]");
  };

  const now = moment().utc().format("YYYYMMDDTHHmmss[Z]");

  // Escape special characters in text fields
  const escapeText = (text) => {
    if (!text) return "";
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  // Build attendee list
  const attendeeLines = attendees
    .map((attendee) => {
      const email = attendee.email || attendee;
      const name = attendee.name || email.split("@")[0];
      const rsvp = attendee.rsvp !== false ? "RSVP=TRUE" : "";
      return `ATTENDEE;CN="${escapeText(name)}";${rsvp}:mailto:${email}`;
    })
    .join("\r\n");

  // Build ICS content
  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM Intileo//Meeting Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:" + action,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${timezone}:${startDate.format("YYYYMMDDTHHmmss")}`,
    `DTEND;TZID=${timezone}:${endDate.format("YYYYMMDDTHHmmss")}`,
    `SUMMARY:${escapeText(activity.subject)}`,
    `ORGANIZER;CN="${escapeText(organizerName)}":mailto:${organizerEmail}`,
  ];

  if (activity.description) {
    icsContent.push(`DESCRIPTION:${escapeText(activity.description)}`);
  }

  if (activity.location || meeting.meetingUrl) {
    icsContent.push(`LOCATION:${escapeText(activity.location || meeting.meetingUrl)}`);
  }

  if (meeting.meetingUrl) {
    icsContent.push(`URL:${meeting.meetingUrl}`);
    icsContent.push(`X-ALT-DESC;FMTTYPE=text/html:${escapeText(`<a href="${meeting.meetingUrl}">Join Meeting</a>`)}`);
  }

  if (attendeeLines) {
    icsContent.push(attendeeLines);
  }

  // Add status for cancelled meetings
  if (action === "CANCEL" || meeting.meetingStatus === "cancelled") {
    icsContent.push("STATUS:CANCELLED");
  } else {
    icsContent.push("STATUS:CONFIRMED");
  }

  // Add sequence number for updates (increment on updates)
  icsContent.push("SEQUENCE:0");

  // Add reminder if configured
  if (meeting.reminderMinutes) {
    try {
      const reminders = JSON.parse(meeting.reminderMinutes);
      reminders.forEach((minutes) => {
        icsContent.push(`BEGIN:VALARM`);
        icsContent.push(`TRIGGER:-PT${minutes}M`);
        icsContent.push(`ACTION:DISPLAY`);
        icsContent.push(`SUMMARY:${escapeText(activity.subject)}`);
        icsContent.push(`END:VALARM`);
      });
    } catch (e) {
      // Invalid reminder format, skip
    }
  }

  // Add recurrence rule if exists
  if (meeting.recurrenceRule) {
    icsContent.push(`RRULE:${meeting.recurrenceRule}`);
    if (meeting.recurrenceEndDate) {
      const endDate = moment.tz(meeting.recurrenceEndDate, timezone);
      icsContent.push(`DTEND;TZID=${timezone}:${endDate.format("YYYYMMDDTHHmmss")}`);
    }
  }

  // Add timezone definition
  if (timezone !== "UTC") {
    const tzData = moment.tz(timezone);
    const tzOffset = tzData.format("Z");
    const tzName = timezone.replace("/", "_");
    icsContent.push(
      `BEGIN:VTIMEZONE`,
      `TZID:${timezone}`,
      `BEGIN:STANDARD`,
      `DTSTART:19700101T000000`,
      `TZOFFSETFROM:${tzOffset}`,
      `TZOFFSETTO:${tzOffset}`,
      `TZNAME:${tzName}`,
      `END:STANDARD`,
      `END:VTIMEZONE`
    );
  }

  icsContent.push("END:VEVENT");
  icsContent.push("END:VCALENDAR");

  return icsContent.join("\r\n");
}

/**
 * Generate a cancellation ICS file
 */
function generateCancellationICS(meetingData) {
  return generateICS({ ...meetingData, action: "CANCEL" });
}

/**
 * Generate an update ICS file
 */
function generateUpdateICS(meetingData) {
  return generateICS({ ...meetingData, action: "REQUEST" });
}

module.exports = {
  generateICS,
  generateCancellationICS,
  generateUpdateICS,
};

