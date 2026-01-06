const Campaigns = require("../../models/email/campaignsModel");

// Manual flag sync trigger for specific user
exports.createCampaign = async (req, res) => {
  try {
    const {
      receivers,
      sender,
      subject,
      emailContent,
      sendingTime,
      engagement,
      campaignName,
      createdBy,
    } = req.body;

    await Campaigns.create({
      campaignName,
      receivers,
      sender,
      subject,
      emailContent,
      sendingTime,
      engagement,
      createdBy,
    });

    res.status(200).json({
      success: true,
      message: `Manual flag sync queued for user`,
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

exports.editCampaign = async (req, res) => {
  try {
    const {
      receivers,
      sender,
      subject,
      emailContent,
      sendingTime,
      engagement,
      campaignName,
      createdBy,
    } = req.body;

    const [updatedRows] = await Campaigns.update(
      {
        campaignName,
        receivers,
        sender,
        subject,
        emailContent,
        sendingTime,
        engagement,
        createdBy,
      },
      {
        where: {
          campaignId: req.params.id,
        },
      }
    );

    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found or no changes made",
      });
    }

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
    });
  } catch (error) {
    console.error("Edit campaign error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update campaign",
      error: error.message,
    });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const campaign = await Campaigns.findAll({});

    res.status(200).json({
      success: true,
      message: `fetch successfully`,
      data:campaign
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

exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaigns.destroy({
      where: {
        campaignId: req.params.id,
      },
    });

    res.status(200).json({
      success: true,
      message: `Manual flag sync queued for user`,
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
