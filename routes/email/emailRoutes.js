const express = require("express");
const router = express.Router();
const emailController = require("../../controllers/email/emailController");
const { verifyToken } = require("../../middlewares/authMiddleware");
// Fetch inbox emails
router.post("/fetch-inbox", verifyToken,emailController.fetchInboxEmails);
router.get("/fetch-recent-email",verifyToken,emailController.fetchRecentEmail);
router.get("/fetch-drafts", emailController.fetchDraftEmails);
router.get("/fetch-archive", emailController.fetchArchiveEmails);
router.get("/get-emails", verifyToken,emailController.getEmails);
router.get("/fetch-sent", emailController.fetchSentEmails);
router.get("/getoneEmail/:emailId", verifyToken, emailController.getOneEmail);
router.post("/compose", verifyToken,emailController.composeEmail);
router.post("/create-template", verifyToken,emailController.createTemplate);
router.get("/get-templates", verifyToken,emailController.getTemplates);
router.get("/template/:templateID", verifyToken,emailController.getTemplateById)
router.get("/unread-counts",verifyToken, emailController.getUnreadCounts);
router.post("/add-credential", verifyToken,emailController.addUserCredential);
router.get("/get-credential", verifyToken,emailController.getUserCredential);
router.post("/delete-emails", verifyToken,emailController.deleteEmail);
router.post("/save-draft", verifyToken,emailController.saveDraft);
router.post("/schedule-email", verifyToken,emailController.scheduleEmail);
// router.post("/update-draft", verifyToken,emailController.updateDraft);



module.exports = router;