const express = require("express");
const router = express.Router();
const webFormPublicController = require("../../controllers/webForm/webFormPublicController");
const webFormEmbedController = require("../../controllers/webForm/webFormEmbedController");
const rateLimit = require("express-rate-limit");
const dbContextMiddleware = require("../../middlewares/dbContext");
// Rate limiting for public API
const formSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: "Too many form submissions from this IP, please try again later.",
});

// ====================================
// PUBLIC ROUTES (No Authentication)
// ====================================


router.use(dbContextMiddleware);


// Get embed script (external JS file - Zoho/HubSpot style)
router.get("/embed/:uniqueKey.js", webFormEmbedController.getEmbedScript);

// Render form as HTML (for iframe embedding)
router.get("/:uniqueKey/render", webFormEmbedController.renderFormPage);

// Get form configuration (JSON API)
router.get("/:uniqueKey", webFormPublicController.getPublicForm);

// Submit form
router.post("/:uniqueKey/submit", formSubmitLimiter, webFormPublicController.submitForm);

// Track form events (views, interactions, etc.)
router.post("/:uniqueKey/track", webFormPublicController.trackFormEvent);

module.exports = router;
