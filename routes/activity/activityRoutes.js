const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const activityController = require("../../controllers/activity/activityController");

router.post("/create-activity", verifyToken, activityController.createActivity);
router.get("/get-activities", verifyToken, activityController.getActivities);
router.get("/mark-as-done/:activityId", verifyToken, activityController.markActivityAsDone);
router.post("/update-activity/:activityId", verifyToken, activityController.updateActivity);







module.exports = router;