const UserInterfacePreference = require("../models/userInterfacePreferences");

// Get user interface preferences
exports.getInterfacePreferences = async (req, res) => {
   const {  MasterUser, AuditTrail, History, UserInterfacePreference,  } = req.models;
  try {
    const masterUserID = req.adminId;

    if (!masterUserID) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find or create preferences for the user
    let preferences = await UserInterfacePreference.findOne({
      where: { masterUserID },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await UserInterfacePreference.create({
        masterUserID,
        showAddActivityModalAfterWinning: true,
        openDetailsViewAfterCreating: false,
        openDetailsViewForLeadDeal: false,
        openDetailsViewForPerson: false,
        openDetailsViewForOrganization: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Interface preferences retrieved successfully",
      data: {
        preferenceId: preferences.preferenceId,
        showAddActivityModalAfterWinning: preferences.showAddActivityModalAfterWinning,
        openDetailsViewAfterCreating: preferences.openDetailsViewAfterCreating,
        openDetailsViewForLeadDeal: preferences.openDetailsViewForLeadDeal,
        openDetailsViewForPerson: preferences.openDetailsViewForPerson,
        openDetailsViewForOrganization: preferences.openDetailsViewForOrganization,
      },
    });
  } catch (error) {
    console.error("Error fetching interface preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch interface preferences",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update user interface preferences
exports.updateInterfacePreferences = async (req, res) => {
  const {  MasterUser, AuditTrail, History, UserInterfacePreference,  } = req.models;
  try {
    const masterUserID = req.adminId;
    const {
      showAddActivityModalAfterWinning,
      openDetailsViewAfterCreating,
      openDetailsViewForLeadDeal,
      openDetailsViewForPerson,
      openDetailsViewForOrganization,
    } = req.body;

    if (!masterUserID) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find or create preferences for the user
    let preferences = await UserInterfacePreference.findOne({
      where: { masterUserID },
    });

    if (!preferences) {
      // Create new preferences
      preferences = await UserInterfacePreference.create({
        masterUserID,
        showAddActivityModalAfterWinning: showAddActivityModalAfterWinning ?? true,
        openDetailsViewAfterCreating: openDetailsViewAfterCreating ?? false,
        openDetailsViewForLeadDeal: openDetailsViewForLeadDeal ?? false,
        openDetailsViewForPerson: openDetailsViewForPerson ?? false,
        openDetailsViewForOrganization: openDetailsViewForOrganization ?? false,
      });
    } else {
      // Update existing preferences
      const updateData = {};

      if (showAddActivityModalAfterWinning !== undefined) {
        updateData.showAddActivityModalAfterWinning = showAddActivityModalAfterWinning;
      }
      if (openDetailsViewAfterCreating !== undefined) {
        updateData.openDetailsViewAfterCreating = openDetailsViewAfterCreating;
      }
      if (openDetailsViewForLeadDeal !== undefined) {
        updateData.openDetailsViewForLeadDeal = openDetailsViewForLeadDeal;
      }
      if (openDetailsViewForPerson !== undefined) {
        updateData.openDetailsViewForPerson = openDetailsViewForPerson;
      }
      if (openDetailsViewForOrganization !== undefined) {
        updateData.openDetailsViewForOrganization = openDetailsViewForOrganization;
      }

      await preferences.update(updateData);
    }

    return res.status(200).json({
      success: true,
      message: "Interface preferences updated successfully",
      data: {
        preferenceId: preferences.preferenceId,
        showAddActivityModalAfterWinning: preferences.showAddActivityModalAfterWinning,
        openDetailsViewAfterCreating: preferences.openDetailsViewAfterCreating,
        openDetailsViewForLeadDeal: preferences.openDetailsViewForLeadDeal,
        openDetailsViewForPerson: preferences.openDetailsViewForPerson,
        openDetailsViewForOrganization: preferences.openDetailsViewForOrganization,
      },
    });
  } catch (error) {
    console.error("Error updating interface preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update interface preferences",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Reset user interface preferences to default
exports.resetInterfacePreferences = async (req, res) => {
  const {  MasterUser, AuditTrail, History, UserInterfacePreference,  } = req.models;
  try {
    const masterUserID = req.adminId;

    if (!masterUserID) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find preferences
    let preferences = await UserInterfacePreference.findOne({
      where: { masterUserID },
    });

    if (preferences) {
      // Reset to defaults
      await preferences.update({
        showAddActivityModalAfterWinning: true,
        openDetailsViewAfterCreating: false,
        openDetailsViewForLeadDeal: false,
        openDetailsViewForPerson: false,
        openDetailsViewForOrganization: false,
      });
    } else {
      // Create with defaults
      preferences = await UserInterfacePreference.create({
        masterUserID,
        showAddActivityModalAfterWinning: true,
        openDetailsViewAfterCreating: false,
        openDetailsViewForLeadDeal: false,
        openDetailsViewForPerson: false,
        openDetailsViewForOrganization: false,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Interface preferences reset to defaults successfully",
      data: {
        preferenceId: preferences.preferenceId,
        showAddActivityModalAfterWinning: preferences.showAddActivityModalAfterWinning,
        openDetailsViewAfterCreating: preferences.openDetailsViewAfterCreating,
        openDetailsViewForLeadDeal: preferences.openDetailsViewForLeadDeal,
        openDetailsViewForPerson: preferences.openDetailsViewForPerson,
        openDetailsViewForOrganization: preferences.openDetailsViewForOrganization,
      },
    });
  } catch (error) {
    console.error("Error resetting interface preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset interface preferences",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
