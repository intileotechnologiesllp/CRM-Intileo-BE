// activitySettingsMiddleware.js
// Middleware to check company activity settings for scheduling popup after activity completion

const ActivitySetting = require('../models/activity/activitySettingModel'); // You will need to create this model

/**
 * Middleware to attach activity popup settings to the request
 * Usage: Add to routes where activity completion is handled
 */
module.exports = async function activitySettingsMiddleware(req, res, next) {
  const {ActivitySetting} = req.models
  try {
    // You may want to scope this by masterUserID or adminId
    const masterUserID = req.masterUserID || req.adminId; // Adjust as needed
    const settings = await ActivitySetting.findOne({ where: { masterUserID } });

    // Default settings if not found
    req.activityPopupSettings = {
      showPopup: true,
      showType: 'always', // 'always' or 'pipelines'
      pipelines: [],
      defaultActivityType: 'Task',
      followUpTime: 'in 3 months',
      allowUserDisable: true,
    };
    if (settings) {
      req.activityPopupSettings = {
        showPopup: settings.showPopup,
        showType: settings.showType, // 'always' or 'pipelines'
        pipelines: settings.pipelines || [],
        defaultActivityType: settings.defaultActivityType || 'Task',
        followUpTime: settings.followUpTime || 'in 3 months',
        allowUserDisable: typeof settings.allowUserDisable === 'boolean' ? settings.allowUserDisable : true,
      };
    }
    next();
  } catch (err) {
    console.error('Activity settings middleware error:', err);
    // Fallback to default
    req.activityPopupSettings = {
      showPopup: true,
      showType: 'always',
      pipelines: [],
      defaultActivityType: 'Task',
      followUpTime: 'in 3 months',
      allowUserDisable: true,
    };
    next();
  }
};
