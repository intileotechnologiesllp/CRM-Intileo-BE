const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
const activityTypeController = require("../../controllers/activity/activityTypeController");


router.use(dbContextMiddleware);


router.post("/create-activity-type", verifyToken, activityTypeController.createActivityType);
router.get("/get-activity-types", verifyToken, activityTypeController.getActivityTypes);
router.post("/update-activity-type/:id", verifyToken, activityTypeController.updateActivityType);
router.delete("/delete-activity-type/:id", verifyToken, activityTypeController.deleteActivityType);

module.exports = router;