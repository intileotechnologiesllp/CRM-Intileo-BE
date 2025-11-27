const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const activitySettingController = require("../../controllers/activity/activitySettingController");

router.get("/get-activity-settings", verifyToken, activitySettingController.getActivitySettings);
router.post("/update-activity-settings", verifyToken, activitySettingController.updateActivitySettings);



module.exports = router;