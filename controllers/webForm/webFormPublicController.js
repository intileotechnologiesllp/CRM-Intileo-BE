const WebForm = require("../../models/webForm/webFormModel");
const WebFormField = require("../../models/webForm/webFormFieldModel");
const WebFormSubmission = require("../../models/webForm/webFormSubmissionModel");
const WebFormTracking = require("../../models/webForm/webFormTrackingModel");
const leadConversionService = require("../../services/leadConversionService");
const { getIO } = require("../../config/socket");
const { Op } = require("sequelize");
const { sanitizeFormData, isSpamDetected, checkRateLimit } = require("../../utils/sanitizer");

/**
 * Get form configuration by unique key (PUBLIC)
 * @route GET /api/public/webforms/:uniqueKey
 */
exports.getPublicForm = async (req, res) => {
  const {WebForm, WebFormField, WebFormSubmission, WebFormTracking, } = req.models;
  try {
    const { uniqueKey } = req.params;

    const form = await WebForm.findOne({
      where: { uniqueKey, status: "active" },
      include: [
        {
          model: WebFormField,
          as: "fields",
          order: [["fieldOrder", "ASC"]],
        },
      ],
      attributes: [
        "formId",
        "formName",
        "formTitle",
        "formDescription",
        "primaryColor",
        "buttonText",
        "successMessage",
        "redirectUrl",
        "gdprCompliant",
        "consentText",
        "privacyPolicyUrl",
      ],
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found or inactive",
      });
    }

    // Parse field options
    const formData = form.toJSON();
    if (formData.fields) {
      formData.fields = formData.fields.map((field) => {
        if (field.options) {
          try {
            field.options = JSON.parse(field.options);
          } catch (e) {
            field.options = [];
          }
        }
        return field;
      });
    }

    res.status(200).json({
      success: true,
      data: formData,
    });
  } catch (error) {
    console.error("Error fetching public form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch form",
      error: error.message,
    });
  }
};

/**
 * Submit form (PUBLIC)
 * @route POST /api/public/webforms/:uniqueKey/submit
 */
exports.submitForm = async (req, res) => {
  const {WebForm, WebFormField, WebFormSubmission, WebFormTracking, } = req.models;
  try {
    const { uniqueKey } = req.params;
    const {
      formData,
      sourceUrl,
      referrerUrl,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      consentGiven,
      sessionId,
      visitorId,
      timeToSubmit,
    } = req.body;

    // Get IP address for rate limiting
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.connection.remoteAddress;

    // 🔒 SPAM PROTECTION 1: Honeypot Detection
    if (isSpamDetected(formData, ['company', 'website', 'phone_number'])) {
      console.warn(`[SPAM DETECTED] Honeypot triggered from IP: ${ipAddress}`);
      // Return success to fool spambots
      return res.status(200).json({
        success: true,
        message: "Thank you for your submission!",
      });
    }

    // 🔒 SPAM PROTECTION 2: Rate Limiting (5 submissions per 15 minutes per IP)
    const rateLimitCheck = checkRateLimit(ipAddress, 5, 900000); // 15 minutes
    if (!rateLimitCheck.allowed) {
      console.warn(`[RATE LIMIT] IP ${ipAddress} exceeded submission limit`);
      return res.status(429).json({
        success: false,
        message: "Too many submissions. Please try again later.",
        retryAfter: rateLimitCheck.retryAfter,
      });
    }

    // 🔒 SPAM PROTECTION 3: Sanitize all form data to prevent XSS
    const sanitizedFormData = sanitizeFormData(formData);

    // Get form
    const form = await WebForm.findOne({
      where: { uniqueKey, status: "active" },
      include: [
        {
          model: WebFormField,
          as: "fields",
        },
      ],
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found or inactive",
      });
    }

    // Validate required fields
    const requiredFields = form.fields.filter((f) => f.isRequired);
    const missingFields = [];

    for (const field of requiredFields) {
      if (!sanitizedFormData[field.fieldName] || sanitizedFormData[field.fieldName].trim() === "") {
        missingFields.push(field.fieldLabel);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
        missingFields,
      });
    }

    // Check GDPR consent
    if (form.gdprCompliant && !consentGiven) {
      return res.status(400).json({
        success: false,
        message: "GDPR consent is required",
      });
    }

    // Get user agent
    const userAgent = req.headers["user-agent"];

    // Check for duplicate submissions (same email within 5 minutes)
    if (sanitizedFormData.email) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentSubmission = await WebFormSubmission.findOne({
        where: {
          formId: form.formId,
          formData: {
            [Op.like]: `%"email":"${sanitizedFormData.email}"%`,
          },
          submittedAt: {
            [Op.gte]: fiveMinutesAgo,
          },
        },
      });

      if (recentSubmission) {
        return res.status(400).json({
          success: false,
          message: "Duplicate submission detected. Please wait before submitting again.",
        });
      }
    }

    // Create submission with sanitized data
    const submission = await WebFormSubmission.create({
      formId: form.formId,
      formData: JSON.stringify(sanitizedFormData),
      sourceUrl,
      referrerUrl,
      userAgent,
      ipAddress,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      consentGiven,
      consentTimestamp: consentGiven ? new Date() : null,
      consentIp: consentGiven ? ipAddress : null,
      status: "pending",
    });

    // Track submission event
    await WebFormTracking.create({
      formId: form.formId,
      eventType: "submit_success",
      sessionId,
      visitorId,
      sourceUrl,
      referrerUrl,
      userAgent,
      ipAddress,
      timeToSubmit,
      utmSource,
      utmMedium,
      utmCampaign,
    });

    // Update form stats
    await form.increment("totalSubmissions");
    const updatedForm = await form.reload();
    const conversionRate = updatedForm.totalViews > 0 
      ? (updatedForm.totalSubmissions / updatedForm.totalViews) * 100 
      : 0;
    await form.update({ conversionRate });

    // Convert to lead asynchronously
    leadConversionService
      .convertSubmissionToLead(submission.submissionId, form)
      .then((result) => {
        console.log("Lead conversion result:", result);
        
        // Send socket notification to admin
        try {
          const io = getIO();
          io.to(`user_${form.masterUserID}`).emit("newFormSubmission", {
            formId: form.formId,
            formName: form.formName,
            submissionId: submission.submissionId,
            leadId: result.leadId,
          });
        } catch (error) {
          console.error("Error sending socket notification:", error);
        }
      })
      .catch((error) => {
        console.error("Error converting submission to lead:", error);
      });

    res.status(201).json({
      success: true,
      message: form.successMessage || "Thank you for your submission!",
      redirectUrl: form.redirectUrl,
      data: {
        submissionId: submission.submissionId,
      },
    });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit form",
      error: error.message,
    });
  }
};

/**
 * Track form events (PUBLIC)
 * @route POST /api/public/webforms/:uniqueKey/track
 */
exports.trackFormEvent = async (req, res) => {
  const {WebForm, WebFormField, WebFormSubmission, WebFormTracking, } = req.models;
  try {
    const { uniqueKey } = req.params;
    const {
      eventType,
      fieldName,
      sessionId,
      visitorId,
      sourceUrl,
      referrerUrl,
      timeOnForm,
      deviceType,
      browser,
      os,
      screenResolution,
      utmSource,
      utmMedium,
      utmCampaign,
      metadata,
    } = req.body;

    // Get form
    const form = await WebForm.findOne({
      where: { uniqueKey, status: "active" },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Create tracking event
    await WebFormTracking.create({
      formId: form.formId,
      eventType,
      fieldName,
      sessionId,
      visitorId,
      sourceUrl,
      referrerUrl,
      userAgent,
      ipAddress,
      deviceType,
      browser,
      os,
      screenResolution,
      timeOnForm,
      utmSource,
      utmMedium,
      utmCampaign,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    // Update form views count on 'view' event
    if (eventType === "view") {
      await form.increment("totalViews");
    }

    res.status(201).json({
      success: true,
      message: "Event tracked successfully",
    });
  } catch (error) {
    console.error("Error tracking event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track event",
      error: error.message,
    });
  }
};

/**
 * Mark submission as read
 * @route PUT /api/webforms/submissions/:submissionId/read
 */
exports.markAsRead = async (req, res) => {
  const {WebForm, WebFormField, WebFormSubmission, WebFormTracking, } = req.models;
  try {
    const { submissionId } = req.params;
    const masterUserID = req.adminId;

    const submission = await WebFormSubmission.findOne({
      where: { submissionId },
      include: [
        {
          model: WebForm,
          as: "form",
          where: { masterUserID },
        },
      ],
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    await submission.update({ isRead: true });

    res.status(200).json({
      success: true,
      message: "Submission marked as read",
    });
  } catch (error) {
    console.error("Error marking submission as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark submission as read",
      error: error.message,
    });
  }
};

/**
 * Update submission status
 * @route PUT /api/webforms/submissions/:submissionId/status
 */
exports.updateSubmissionStatus = async (req, res) => {
  const {WebForm, WebFormField, WebFormSubmission, WebFormTracking, } = req.models;
  try {
    const { submissionId } = req.params;
    const { status, notes } = req.body;
    const masterUserID = req.adminId;

    const submission = await WebFormSubmission.findOne({
      where: { submissionId },
      include: [
        {
          model: WebForm,
          as: "form",
          where: { masterUserID },
        },
      ],
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    await submission.update({
      status,
      notes,
      processedBy: masterUserID,
      processedAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Submission status updated",
      data: submission,
    });
  } catch (error) {
    console.error("Error updating submission status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update submission status",
      error: error.message,
    });
  }
};

