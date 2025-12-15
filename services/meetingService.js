const moment = require("moment-timezone");
const { Op } = require("sequelize");
const Activity = require("../models/activity/activityModel");
const Meeting = require("../models/meeting/meetingModel");
const MasterUser = require("../models/master/masterUserModel");
const Person = require("../models/leads/leadPersonModel");
const CompanySettings = require("../models/company/companySettingsModel");

class MeetingService {
  /**
   * Check for scheduling conflicts for a user or attendees
   * @param {Object} options - Conflict check options
   * @param {Date} options.startDateTime - Meeting start time
   * @param {Date} options.endDateTime - Meeting end time
   * @param {number} options.userId - User ID to check conflicts for
   * @param {Array} options.attendeeIds - Array of attendee user IDs
   * @param {number} options.excludeMeetingId - Meeting ID to exclude from conflict check
   * @param {string} options.timezone - Timezone for the meeting
   * @returns {Promise<Object>} Conflict information
   */
  static async checkConflicts(options) {
    const {
      startDateTime,
      endDateTime,
      userId,
      attendeeIds = [],
      excludeMeetingId = null,
      timezone = "UTC",
    } = options;

    if (!startDateTime || !endDateTime) {
      throw new Error("Start and end dates are required");
    }

    // Convert to UTC for database comparison
    const startUTC = moment.tz(startDateTime, timezone).utc().toDate();
    const endUTC = moment.tz(endDateTime, timezone).utc().toDate();

    // Build conflict conditions
    const conflictConditions = {
      [Op.or]: [
        // Meeting starts during another meeting
        {
          startDateTime: { [Op.between]: [startUTC, endUTC] },
        },
        // Meeting ends during another meeting
        {
          endDateTime: { [Op.between]: [startUTC, endUTC] },
        },
        // Meeting completely overlaps another meeting
        {
          startDateTime: { [Op.lte]: startUTC },
          endDateTime: { [Op.gte]: endUTC },
        },
      ],
      type: "Meeting",
      isDone: false,
    };

    // Check for conflicts with user's existing meetings
    const userConflicts = [];
    if (userId) {
      const userActivities = await Activity.findAll({
        where: {
          ...conflictConditions,
          assignedTo: userId,
        },
        include: [
          {
            model: Meeting,
            as: "meeting",
            where: {
              meetingStatus: { [Op.ne]: "cancelled" },
            },
            required: false,
          },
        ],
      });

      if (excludeMeetingId) {
        const excludeActivity = await Activity.findByPk(excludeMeetingId, {
          include: [{ model: Meeting, as: "meeting" }],
        });
        if (excludeActivity) {
          const filtered = userActivities.filter(
            (a) => a.activityId !== excludeActivity.activityId
          );
          userConflicts.push(...filtered);
        }
      } else {
        userConflicts.push(...userActivities);
      }
    }

    // Check for conflicts with attendees
    const attendeeConflicts = {};
    for (const attendeeId of attendeeIds) {
      if (attendeeId === userId) continue; // Skip if same as user

      const attendeeActivities = await Activity.findAll({
        where: {
          ...conflictConditions,
          assignedTo: attendeeId,
        },
        include: [
          {
            model: Meeting,
            as: "meeting",
            where: {
              meetingStatus: { [Op.ne]: "cancelled" },
            },
            required: false,
          },
        ],
      });

      if (excludeMeetingId) {
        const filtered = attendeeActivities.filter(
          (a) => a.activityId !== excludeMeetingId
        );
        attendeeConflicts[attendeeId] = filtered;
      } else {
        attendeeConflicts[attendeeId] = attendeeActivities;
      }
    }

    const hasConflicts =
      userConflicts.length > 0 || Object.keys(attendeeConflicts).length > 0;

    return {
      hasConflicts,
      userConflicts: userConflicts.map((activity) => ({
        activityId: activity.activityId,
        subject: activity.subject,
        startDateTime: activity.startDateTime,
        endDateTime: activity.endDateTime,
      })),
      attendeeConflicts: Object.keys(attendeeConflicts).map((userId) => ({
        userId: parseInt(userId),
        conflicts: attendeeConflicts[userId].map((activity) => ({
          activityId: activity.activityId,
          subject: activity.subject,
          startDateTime: activity.startDateTime,
          endDateTime: activity.endDateTime,
        })),
      })),
    };
  }

  /**
   * Validate timezone string
   * @param {string} timezone - Timezone to validate
   * @returns {boolean} True if valid
   */
  static isValidTimezone(timezone) {
    try {
      return moment.tz.zone(timezone) !== null;
    } catch (e) {
      return false;
    }
  }

  /**
   * Convert date to specific timezone
   * @param {Date} date - Date to convert
   * @param {string} timezone - Target timezone
   * @returns {Date} Date in target timezone (as UTC)
   */
  static convertToTimezone(date, timezone) {
    return moment.tz(date, timezone).utc().toDate();
  }

  /**
   * Format meeting time for display
   * @param {Date} date - Date to format
   * @param {string} timezone - Timezone
   * @param {string} format - Moment format string
   * @returns {string} Formatted date string
   */
  static formatMeetingTime(date, timezone, format = "YYYY-MM-DD HH:mm") {
    return moment.tz(date, timezone).format(format);
  }

  /**
   * Get user's default timezone
   * @param {number} userId - User ID
   * @returns {Promise<string>} Default timezone
   */
  static async getUserTimezone(userId) {
    try {
      // Try to get from company settings first
      const user = await MasterUser.findByPk(userId);
      if (user && user.masterUserID) {
        // You can add timezone field to MasterUser model if needed
        // For now, defaulting to company timezone or UTC
        const companySettings = await CompanySettings.findOne({
          where: { masterUserID: userId },
        });
        if (companySettings && companySettings.timezone) {
          return companySettings.timezone;
        }
      }
      return "UTC";
    } catch (e) {
      return "UTC";
    }
  }

  /**
   * Parse recurrence rule and calculate next occurrences
   * @param {string} rrule - RRULE string
   * @param {Date} startDate - Start date for recurrence
   * @param {number} count - Number of occurrences to generate
   * @returns {Array<Date>} Array of occurrence dates
   */
  static parseRecurrence(rrule, startDate, count = 10) {
    // This is a simplified parser. For production, consider using a library like 'rrule'
    const occurrences = [];
    let currentDate = moment(startDate);

    // Simple FREQ parsing (DAILY, WEEKLY, MONTHLY, YEARLY)
    if (rrule.includes("FREQ=DAILY")) {
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

      for (let i = 0; i < count; i++) {
        occurrences.push(currentDate.toDate());
        currentDate.add(interval, "days");
      }
    } else if (rrule.includes("FREQ=WEEKLY")) {
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

      for (let i = 0; i < count; i++) {
        occurrences.push(currentDate.toDate());
        currentDate.add(interval, "weeks");
      }
    } else if (rrule.includes("FREQ=MONTHLY")) {
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

      for (let i = 0; i < count; i++) {
        occurrences.push(currentDate.toDate());
        currentDate.add(interval, "months");
      }
    }

    return occurrences;
  }

  /**
   * Prepare attendees list from various sources
   * @param {Object} options - Attendee options
   * @param {Array} options.personIds - Person IDs from CRM
   * @param {Array} options.userIds - User IDs (internal attendees)
   * @param {Array} options.externalEmails - External email addresses
   * @returns {Promise<Array>} Array of attendee objects {name, email, type}
   */
  static async prepareAttendees(options) {
    const { personIds = [], userIds = [], externalEmails = [] } = options;
    const attendees = [];

    // Get persons
    if (personIds.length > 0) {
      const persons = await Person.findAll({
        where: { personId: personIds },
      });
      persons.forEach((person) => {
        if (person.email) {
          attendees.push({
            name: person.contactPerson || person.email,
            email: person.email,
            type: "person",
            personId: person.personId,
          });
        }
      });
    }

    // Get users
    if (userIds.length > 0) {
      const users = await MasterUser.findAll({
        where: { masterUserID: userIds },
      });
      users.forEach((user) => {
        if (user.email) {
          attendees.push({
            name: user.name || user.email,
            email: user.email,
            type: "user",
            userId: user.masterUserID,
          });
        }
      });
    }

    // Add external emails
    externalEmails.forEach((emailObj) => {
      const email = typeof emailObj === "string" ? emailObj : emailObj.email;
      const name = typeof emailObj === "string" ? null : emailObj.name;
      if (email) {
        attendees.push({
          name: name || email.split("@")[0],
          email: email,
          type: "external",
        });
      }
    });

    return attendees;
  }

  /**
   * Calculate meeting duration in minutes
   * @param {Date} startDateTime - Start time
   * @param {Date} endDateTime - End time
   * @returns {number} Duration in minutes
   */
  static calculateDuration(startDateTime, endDateTime) {
    return moment(endDateTime).diff(moment(startDateTime), "minutes");
  }
}

module.exports = MeetingService;

