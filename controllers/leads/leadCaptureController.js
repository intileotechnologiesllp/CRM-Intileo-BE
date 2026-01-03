
const { LeadCaptureAnalytics } = require("../../models");

/**
 * CREATE / UPDATE analytics event
 * (VIEW, INTERACT, SUBMIT, ERROR)
 */
exports.trackAnalytics = async (req, res) => {
  try {
    const {
      formId,
      sessionId,
      masterUserId,
      visitorEmail,
      status,
      errorMessage,
      deviceType,
      referrer,
    } = req.body;

    const userAgent = req.headers["user-agent"];
    const ipAddress =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    let analytics = await LeadCaptureAnalytics.findOne({
      where: { formId, sessionId },
    });

    // FIRST VIEW
    if (!analytics) {
      analytics = await LeadCaptureAnalytics.create({
        formId,
        sessionId,
        masterUserId,
        visitorEmail,
        viewedAt: new Date(),
        status: "VIEWED",
        userAgent,
        ipAddress,
        deviceType,
        referrer,
      });
    }

    // UPDATE BASED ON STATUS
    const updatePayload = {};

    if (status === "INTERACTED") {
      updatePayload.firstInteractedAt =
        analytics.firstInteractedAt || new Date();
      updatePayload.totalInteractions = analytics.totalInteractions + 1;
      updatePayload.status = "INTERACTED";
    }

    if (status === "SUBMITTED") {
      updatePayload.submittedAt = new Date();
      updatePayload.status = "SUBMITTED";
    }

    if (status === "ERROR") {
      updatePayload.hasError = true;
      updatePayload.lastErrorMessage = errorMessage;
      updatePayload.status = "ERROR";
    }

    await analytics.update(updatePayload);

    return res.status(200).json({
      success: true,
      message: "Analytics tracked successfully",
      data: analytics,
    });
  } catch (error) {
    console.error("Track Analytics Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to track analytics",
      error: error.message,
    });
  }
};

/**
 * GET analytics by formId
 */
exports.getAnalyticsByForm = async (req, res) => {
  try {
    const { formId } = req.params;

    const analytics = await LeadCaptureAnalytics.findAll({
      where: { formId },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET single session analytics
 */
exports.getAnalyticsBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const analytics = await LeadCaptureAnalytics.findOne({
      where: { sessionId },
    });

    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: "Analytics not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * DELETE analytics record (admin/debug use)
 */
exports.deleteAnalytics = async (req, res) => {
  try {
    const { analyticsId } = req.params;

    const deleted = await LeadCaptureAnalytics.destroy({
      where: { analyticsId },
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Analytics deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
