// controllers/activityTypeController.js
const ActivityType  = require("../../models/activity/activityTypeModel");

// Create a new activity type
exports.createActivityType = async (req, res) => {
  const { ActivityType } = req.models;
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

// Optionally: get all activity types (for listing)
exports.getActivityTypes = async (req, res) => {
  const { ActivityType } = req.models;
  try {
    const activityTypes = await ActivityType.findAll();
    res.status(200).json({ activityTypes });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Optionally: update activity type (activate/deactivate, change icon/name)
exports.updateActivityType = async (req, res) => {
  const { ActivityType } = req.models;
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

// Optionally: delete activity type
exports.deleteActivityType = async (req, res) => {
  const { ActivityType } = req.models;
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
