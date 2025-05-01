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
router.get("/getoneEmail/:emailId", emailController.getOneEmail);
router.post("/compose", emailController.composeEmail);
router.post("/create-template", emailController.createTemplate);
router.get("/get-templates", emailController.getTemplates);
router.get("/template/:templateID", emailController.getTemplateById)
router.get("/unread-counts", emailController.getUnreadCounts);



module.exports = router;