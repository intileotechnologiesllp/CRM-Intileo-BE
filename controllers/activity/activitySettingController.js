// --- Activity Type CRUD (for activity type management UI) ---
const { ActivityType } = require("../../models/activity/activityTypeModel");

// Create a new activity type
exports.createActivityType = async (req, res) => {
  try {
    const { name, icon, isActive = true } = req.body;
    if (!name || !icon) {
      return res.status(400).json({ message: "Name and icon are required." });
    }
    // Check for duplicate name
    const existing = await ActivityType.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({ message: "Activity type already exists." });
    }
    const activityType = await ActivityType.create({ name, icon, isActive });
    res.status(201).json({ message: "Activity type created successfully.", activityType });
  } catch (error) {
    console.error("Error creating activity type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all activity types
exports.getActivityTypes = async (req, res) => {
  try {
    const activityTypes = await ActivityType.findAll();
    res.status(200).json({ activityTypes });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update activity type (activate/deactivate, change icon/name)
exports.updateActivityType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, isActive } = req.body;
    const activityType = await ActivityType.findByPk(id);
    if (!activityType) {
      return res.status(404).json({ message: "Activity type not found." });
    }
    if (name !== undefined) activityType.name = name;
    if (icon !== undefined) activityType.icon = icon;
    if (isActive !== undefined) activityType.isActive = isActive;
    await activityType.save();
    res.status(200).json({ message: "Activity type updated.", activityType });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete activity type
exports.deleteActivityType = async (req, res) => {
  try {
    const { id } = req.params;
    const activityType = await ActivityType.findByPk(id);
    if (!activityType) {
      return res.status(404).json({ message: "Activity type not found." });
    }
    await activityType.destroy();
    res.status(200).json({ message: "Activity type deleted." });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
// controllers/activitySettingController.js
const ActivitySetting = require('../../models/activity/activitySettingModel');

// Get activity settings for a company
exports.getActivitySettings = async (req, res) => {
  try {
    const masterUserID = req.masterUserID || req.adminId; // Use masterUserID for scoping
    let settings = await ActivitySetting.findOne({ where: { masterUserID } });
    if (!settings) {
      // Return default if not set
      settings = {
        showPopup: true,
        showType: 'always',
        pipelines: [],
        defaultActivityType: 'Task', // Default type
        followUpTime: 'in 3 months', // Default follow-up
        allowUserDisable: true, // Default allow
      };
    } else {
      // Ensure all new fields are present for backward compatibility
      if (settings.defaultActivityType === undefined) settings.defaultActivityType = 'Task';
      if (settings.followUpTime === undefined) settings.followUpTime = 'in 3 months';
      if (settings.allowUserDisable === undefined) settings.allowUserDisable = true;
    }
    res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error('Error fetching activity settings:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update activity settings for a company
exports.updateActivitySettings = async (req, res) => {
  try {
    const masterUserID = req.masterUserID || req.adminId; // Use masterUserID for scoping
    let { showPopup, showType, pipelines, defaultActivityType, followUpTime, allowUserDisable } = req.body;
    // If showType is 'always', pipelines should be empty
    if (showType === 'always') {
      pipelines = [];
    }
    let settings = await ActivitySetting.findOne({ where: { masterUserID } });
    if (settings) {
      settings.showPopup = showPopup;
      settings.showType = showType;
      settings.pipelines = pipelines;
      settings.defaultActivityType = defaultActivityType;
      settings.followUpTime = followUpTime;
      settings.allowUserDisable = allowUserDisable;
      await settings.save();
    } else {
      settings = await ActivitySetting.create({
        masterUserID,
        showPopup,
        showType,
        pipelines,
        defaultActivityType,
        followUpTime,
        allowUserDisable,
      });
    }
    res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error('Error updating activity settings:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
