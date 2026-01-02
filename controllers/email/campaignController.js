const Campaigns = require("../../models/email/campaignsModel");

// Manual flag sync trigger for specific user
exports.createCampaign = async (req, res) => {
  try {
    const { to, from, subject, templateId, sendingTime, engagement } = req.body;

    await Campaigns.create({
      to,
      from,
      subject,
      templateId,
      sendingTime,
      engagement,
    });

    res.status(200).json({
      success: true,
      message: `Manual flag sync queued for user ${userID}`,
    });
  } catch (error) {
    console.error("Manual flag sync error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to queue manual flag sync",
      error: error.message,
    });
  }
};

module.exports = exports;
