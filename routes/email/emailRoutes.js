const express = require("express");
const router = express.Router();
const emailController = require("../../controllers/email/emailController");

// Fetch inbox emails
router.get("/fetch-inbox", emailController.fetchInboxEmails);
router.get("/fetch-recent-email", emailController.fetchRecentEmail);
router.get("/fetch-drafts", emailController.fetchDraftEmails);
router.get("/fetch-archive", emailController.fetchArchiveEmails);
router.get("/get-emails", emailController.getEmails);
router.get("/fetch-sent", emailController.fetchSentEmails);



module.exports = router;