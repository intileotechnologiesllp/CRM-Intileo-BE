const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
const activitySettingController = require("../../controllers/activity/activitySettingController");


router.use(dbContextMiddleware);

router.get("/get-activity-settings", verifyToken, activitySettingController.getActivitySettings);
router.post("/update-activity-settings", verifyToken, activitySettingController.updateActivitySettings);



module.exports = router;