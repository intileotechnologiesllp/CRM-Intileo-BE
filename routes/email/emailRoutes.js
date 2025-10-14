const express = require("express");
const router = express.Router();
const emailController = require("../../controllers/email/emailController");
const imapTestController = require("../../controllers/email/imapTestController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const validatePrivilege = require("../../middlewares/validatePrivilege");

// Fetch inbox emails
router.post("/fetch-inbox", verifyToken, validatePrivilege(4, "create"), emailController.queueFetchInboxEmails);
router.get(
  "/fetch-recent-email",
  verifyToken,
  validatePrivilege(4, "view"),
  emailController.fetchRecentEmail
);
router.get("/fetch-drafts", verifyToken, validatePrivilege(4, "view"), emailController.fetchDraftEmails);
router.get("/fetch-archive", verifyToken, validatePrivilege(4, "view"), emailController.fetchArchiveEmails);
router.get("/get-emails", verifyToken, validatePrivilege(4, "view"), emailController.getEmails);
router.get("/fetch-sent", verifyToken, validatePrivilege(4, "view"), emailController.fetchSentEmails);
router.get("/getoneEmail/:emailId", verifyToken, validatePrivilege(4, "view"), emailController.getOneEmail);
router.post("/compose", verifyToken, validatePrivilege(4, "view"), emailController.composeEmail);
router.post("/create-template", verifyToken, validatePrivilege(4, "view"), emailController.createTemplate);
router.get("/get-templates", verifyToken, validatePrivilege(4, "view"), emailController.getTemplates);
router.get(
  "/template/:templateID",
  verifyToken,
  validatePrivilege(4, "view"),
  emailController.getTemplateById
);
router.delete(
  "/template/:templateID",
  verifyToken,
  validatePrivilege(4, "delete"),
  emailController.deleteTemplate
);
router.delete(
  "/templates/bulk",
  verifyToken,
  validatePrivilege(4, "delete"),
  emailController.deleteBulkTemplates
);
router.get("/unread-counts", verifyToken, validatePrivilege(4, "view"), emailController.getUnreadCounts);
router.post("/add-credential", verifyToken, validatePrivilege(4, "view"), emailController.addUserCredential);
router.get("/get-credential", verifyToken, validatePrivilege(4, "view"), emailController.getUserCredential);
router.get("/delete-email/:emailId", verifyToken, validatePrivilege(4, "delete"), emailController.deleteEmail);
router.post("/delete-emails", verifyToken, validatePrivilege(4, "delete"), emailController.deletebulkEmails);
router.post("/save-draft", verifyToken, validatePrivilege(4, "create"), emailController.saveDraft);
router.post("/schedule-email", verifyToken, validatePrivilege(4, "create"), emailController.scheduleEmail);
router.get(
  "/delete-all-emails",
  verifyToken,
  validatePrivilege(4, "delete"),
  emailController.deleteAllEmailsForUser
);

// Bulk email operations
router.post("/bulk-edit", verifyToken, validatePrivilege(4, "edit"), emailController.bulkEditEmails);
router.post("/bulk-delete", verifyToken, validatePrivilege(4, "delete"), emailController.bulkDeleteEmails);
router.post("/bulk-mark", verifyToken, validatePrivilege(4, "edit"), emailController.bulkMarkEmails);
router.post("/bulk-move", verifyToken, validatePrivilege(4, "edit"), emailController.bulkMoveEmails);

// Email visibility (shared/private)
router.post("/visibility/:emailId", verifyToken, validatePrivilege(4, "edit"), emailController.updateEmailVisibility);

// router.post("/update-draft", verifyToken,emailController.updateDraft);

// Gmail IMAP test routes (no auth for testing)
router.get("/inbox-count", emailController.checkGmailInboxCount);

// IMAP sync test endpoints
router.get("/imap/health", verifyToken, validatePrivilege(4, "view"), imapTestController.testImapHealth);
router.post("/imap/test-sync", verifyToken, validatePrivilege(4, "view"), imapTestController.testImapSync);
router.get("/imap/stats", verifyToken, validatePrivilege(4, "view"), imapTestController.getImapStats);

module.exports = router;
