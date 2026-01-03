const express = require("express");
const router = express.Router();
const analyticsController = require("../../controllers/leads/leadCaptureController");

// Track view / interact / submit / error
router.post("/track", analyticsController.trackAnalytics);

// Get analytics by form
router.get("/form/:formId", analyticsController.getAnalyticsByForm);

// Get analytics by session
router.get("/session/:sessionId", analyticsController.getAnalyticsBySession);

// Delete analytics (admin)
router.delete("/:analyticsId", analyticsController.deleteAnalytics);

module.exports = router;
