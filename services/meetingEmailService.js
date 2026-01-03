// REFACTORED: Models now passed as parameters to support dynamic databases
const nodemailer = require("nodemailer");
const { generateICS, generateCancellationICS, generateUpdateICS } = require("../utils/icsGenerator");
const MeetingService = require("./meetingService");

class MeetingEmailService {
  /**
   * Send meeting invitation email with calendar attachment
   * @param {Object} options - Email options
   * @param {Object} options.activity - Activity instance
   * @param {Object} options.meeting - Meeting instance
   * @param {string} options.organizerEmail - Organizer email (for SMTP config)
   * @param {Array} options.attendees - Array of attendee objects {name, email}
   * @param {Object} options.UserCredential - UserCredential model
   * @returns {Promise<Object>} Send result
   */
  static async sendMeetingInvite(options) {
    const { activity, meeting, organizerEmail, attendees = [], UserCredential } = options;

    if (!activity || !meeting || !organizerEmail) {
      throw new Error("Activity, meeting, and organizer email are required");
    }

    // Generate ICS file
    const icsContent = generateICS({
      activity,
      meeting,
      organizerEmail,
      organizerName: meeting.organizerName || organizerEmail.split("@")[0],
      attendees,
      action: "REQUEST",
    });

    // Get SMTP configuration
    const transporter = await this.getTransporter(organizerEmail, UserCredential);

    const results = [];

    // Send to each attendee
    for (const attendee of attendees) {
      try {
        const mailOptions = {
          from: `"${meeting.organizerName}" <${organizerEmail}>`,
          to: attendee.email,
          subject: `Meeting Invitation: ${activity.subject}`,
          text: this.generateEmailText(activity, meeting, attendee, "invite"),
          html: this.generateEmailHTML(activity, meeting, attendee, "invite"),
          icalEvent: {
            filename: "meeting.ics",
            method: "REQUEST",
            content: icsContent,
          },
          attachments: [
            {
              filename: "meeting.ics",
              content: icsContent,
              contentType: "text/calendar; charset=UTF-8; method=REQUEST",
            },
          ],
        };

        const result = await transporter.sendMail(mailOptions);
        results.push({
          email: attendee.email,
          status: "sent",
          messageId: result.messageId,
        });
      } catch (error) {
        console.error(`Failed to send invite to ${attendee.email}:`, error);
        results.push({
          email: attendee.email,
          status: "failed",
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Send meeting update email
   * @param {Object} options - Email options
   * @param {Object} options.activity - Activity instance
   * @param {Object} options.meeting - Meeting instance
   * @param {string} options.organizerEmail - Organizer email
   * @param {Array} options.attendees - Array of attendee objects
   * @param {Object} options.UserCredential - UserCredential model
   * @returns {Promise<Object>} Send result
   */
  static async sendMeetingUpdate(options) {
    const { activity, meeting, organizerEmail, attendees = [], changes, UserCredential } = options;

    const icsContent = generateUpdateICS({
      activity,
      meeting,
      organizerEmail,
      organizerName: meeting.organizerName || organizerEmail.split("@")[0],
      attendees,
      action: "REQUEST",
    });

    const transporter = await this.getTransporter(organizerEmail, UserCredential);
    const results = [];

    for (const attendee of attendees) {
      try {
        const mailOptions = {
          from: `"${meeting.organizerName}" <${organizerEmail}>`,
          to: attendee.email,
          subject: `Updated: ${activity.subject}`,
          text: this.generateEmailText(activity, meeting, attendee, "update"),
          html: this.generateEmailHTML(activity, meeting, attendee, "update"),
          icalEvent: {
            filename: "meeting-update.ics",
            method: "REQUEST",
            content: icsContent,
          },
          attachments: [
            {
              filename: "meeting-update.ics",
              content: icsContent,
              contentType: "text/calendar; charset=UTF-8; method=REQUEST",
            },
          ],
        };

        const result = await transporter.sendMail(mailOptions);
        results.push({
          email: attendee.email,
          status: "sent",
          messageId: result.messageId,
        });
      } catch (error) {
        console.error(`Failed to send update to ${attendee.email}:`, error);
        results.push({
          email: attendee.email,
          status: "failed",
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Send meeting cancellation email
   * @param {Object} options - Email options
   * @param {Object} options.activity - Activity instance
   * @param {Object} options.meeting - Meeting instance
   * @param {string} options.organizerEmail - Organizer email
   * @param {Array} options.attendees - Array of attendee objects
   * @param {string} options.cancellationReason - Reason for cancellation
   * @param {Object} options.UserCredential - UserCredential model
   * @returns {Promise<Object>} Send result
   */
  static async sendMeetingCancellation(options) {
    const { activity, meeting, organizerEmail, attendees = [], reason, UserCredential } = options;

    const icsContent = generateCancellationICS({
      activity,
      meeting,
      organizerEmail,
      organizerName: meeting.organizerName || organizerEmail.split("@")[0],
      attendees,
      action: "CANCEL",
    });

    const transporter = await this.getTransporter(organizerEmail, UserCredential);
    const results = [];

    for (const attendee of attendees) {
      try {
        const mailOptions = {
          from: `"${meeting.organizerName}" <${organizerEmail}>`,
          to: attendee.email,
          subject: `Cancelled: ${activity.subject}`,
          text: this.generateEmailText(activity, meeting, attendee, "cancel", cancellationReason),
          html: this.generateEmailHTML(activity, meeting, attendee, "cancel", cancellationReason),
          icalEvent: {
            filename: "meeting-cancelled.ics",
            method: "CANCEL",
            content: icsContent,
          },
          attachments: [
            {
              filename: "meeting-cancelled.ics",
              content: icsContent,
              contentType: "text/calendar; charset=UTF-8; method=CANCEL",
            },
          ],
        };

        const result = await transporter.sendMail(mailOptions);
        results.push({
          email: attendee.email,
          status: "sent",
          messageId: result.messageId,
        });
      } catch (error) {
        console.error(`Failed to send cancellation to ${attendee.email}:`, error);
        results.push({
          email: attendee.email,
          status: "failed",
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Send meeting reminder email
   * @param {Object} options - Email options
   * @param {Object} options.activity - Activity instance
   * @param {Object} options.meeting - Meeting instance
   * @param {string} options.organizerEmail - Organizer email
   * @param {Array} options.attendees - Array of attendee objects
   * @param {Object} options.UserCredential - UserCredential model
   * @returns {Promise<Object>} Send result
   */
  static async sendMeetingReminder(options) {
    const { activity, meeting, organizerEmail, attendees = [], reminderMessage, UserCredential } = options;

    const transporter = await this.getTransporter(organizerEmail, UserCredential);
    const results = [];

    for (const attendee of attendees) {
      try {
        const mailOptions = {
          from: `"${meeting.organizerName}" <${organizerEmail}>`,
          to: attendee.email,
          subject: `Reminder: ${activity.subject}`,
          text: this.generateEmailText(activity, meeting, attendee, "reminder"),
          html: this.generateEmailHTML(activity, meeting, attendee, "reminder"),
        };

        const result = await transporter.sendMail(mailOptions);
        results.push({
          email: attendee.email,
          status: "sent",
          messageId: result.messageId,
        });
      } catch (error) {
        console.error(`Failed to send reminder to ${attendee.email}:`, error);
        results.push({
          email: attendee.email,
          status: "failed",
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get nodemailer transporter for organizer email
   * @param {string} organizerEmail - Organizer email
   * @param {Object} UserCredential - UserCredential model
   * @returns {Promise<Object>} Nodemailer transporter
   */
  static async getTransporter(organizerEmail, UserCredential) {
    const userCredential = await UserCredential.findOne({
      where: { email: organizerEmail },
    });

    if (!userCredential) {
      throw new Error(`UserCredential not found for: ${organizerEmail}`);
    }

    return nodemailer.createTransport({
      host: userCredential.smtpHost,
      port: userCredential.smtpPort,
      secure: !!userCredential.smtpSecure,
      auth: {
        user: userCredential.email,
        pass: userCredential.appPassword,
      },
    });
  }

  /**
   * Generate plain text email content
   * @param {Object} activity - Activity instance
   * @param {Object} meeting - Meeting instance
   * @param {Object} attendee - Attendee object
   * @param {string} type - Email type (invite, update, cancel, reminder)
   * @param {string} cancellationReason - Optional cancellation reason
   * @returns {string} Plain text email
   */
  static generateEmailText(activity, meeting, attendee, type, cancellationReason = null) {
    const timezone = meeting.timezone || "UTC";
    const startTime = MeetingService.formatMeetingTime(
      activity.startDateTime,
      timezone,
      "MMMM Do YYYY, h:mm A z"
    );
    const endTime = MeetingService.formatMeetingTime(
      activity.endDateTime || activity.startDateTime,
      timezone,
      "h:mm A z"
    );

    let subject = "";
    if (type === "invite") {
      subject = `You have been invited to a meeting: ${activity.subject}`;
    } else if (type === "update") {
      subject = `Meeting updated: ${activity.subject}`;
    } else if (type === "cancel") {
      subject = `Meeting cancelled: ${activity.subject}`;
    } else if (type === "reminder") {
      subject = `Reminder: ${activity.subject}`;
    }

    let body = `${subject}\n\n`;
    body += `Time: ${startTime} - ${endTime}\n`;
    if (activity.location) {
      body += `Location: ${activity.location}\n`;
    }
    if (meeting.meetingUrl) {
      body += `Meeting URL: ${meeting.meetingUrl}\n`;
    }
    if (activity.description) {
      body += `\nDescription:\n${activity.description}\n`;
    }

    if (type === "cancel" && cancellationReason) {
      body += `\nCancellation Reason: ${cancellationReason}\n`;
    }

    if (type === "invite" || type === "update") {
      body += `\nPlease check the attached calendar file to add this meeting to your calendar.\n`;
    }

    body += `\nOrganized by: ${meeting.organizerName} (${meeting.organizerEmail})\n`;

    return body;
  }

  /**
   * Generate HTML email content
   * @param {Object} activity - Activity instance
   * @param {Object} meeting - Meeting instance
   * @param {Object} attendee - Attendee object
   * @param {string} type - Email type
   * @param {string} cancellationReason - Optional cancellation reason
   * @returns {string} HTML email
   */
  static generateEmailHTML(activity, meeting, attendee, type, cancellationReason = null) {
    const timezone = meeting.timezone || "UTC";
    const startTime = MeetingService.formatMeetingTime(
      activity.startDateTime,
      timezone,
      "MMMM Do YYYY, h:mm A z"
    );
    const endTime = MeetingService.formatMeetingTime(
      activity.endDateTime || activity.startDateTime,
      timezone,
      "h:mm A z"
    );

    let title = "";
    let titleColor = "#4CAF50";
    if (type === "invite") {
      title = `You have been invited to a meeting`;
    } else if (type === "update") {
      title = `Meeting Updated`;
      titleColor = "#2196F3";
    } else if (type === "cancel") {
      title = `Meeting Cancelled`;
      titleColor = "#f44336";
    } else if (type === "reminder") {
      title = `Meeting Reminder`;
      titleColor = "#FF9800";
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${titleColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .details { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background-color: ${titleColor}; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${title}</h2>
          </div>
          <div class="content">
            <div class="details">
              <h3>${activity.subject}</h3>
              <div class="detail-row">
                <span class="label">Time:</span> ${startTime} - ${endTime}
              </div>
    `;

    if (activity.location) {
      html += `
              <div class="detail-row">
                <span class="label">Location:</span> ${activity.location}
              </div>
      `;
    }

    if (meeting.meetingUrl) {
      html += `
              <div class="detail-row">
                <span class="label">Meeting URL:</span> <a href="${meeting.meetingUrl}">${meeting.meetingUrl}</a>
              </div>
      `;
    }

    if (activity.description) {
      html += `
              <div class="detail-row">
                <span class="label">Description:</span><br>
                ${activity.description.replace(/\n/g, "<br>")}
              </div>
      `;
    }

    if (type === "cancel" && cancellationReason) {
      html += `
              <div class="detail-row" style="color: #f44336;">
                <span class="label">Cancellation Reason:</span> ${cancellationReason}
              </div>
      `;
    }

    if (meeting.meetingUrl && (type === "invite" || type === "update")) {
      html += `
              <a href="${meeting.meetingUrl}" class="button">Join Meeting</a>
      `;
    }

    html += `
            </div>
            <div class="footer">
              Organized by: ${meeting.organizerName} (${meeting.organizerEmail})
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }
}

module.exports = MeetingEmailService;

