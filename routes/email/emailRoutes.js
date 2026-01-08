const express = require("express");
const router = express.Router();
const emailController = require("../../controllers/email/emailController");
const imapTestController = require("../../controllers/email/imapTestController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { createCampaign, editCampaign, getCampaign, deleteCampaign, getSingleCampaign } = require("../../controllers/email/campaignController");
// const validatePrivilege = require("../../middlewares/validatePrivilege");

// Fetch inbox emails
router.post("/fetch-inbox", verifyToken, emailController.queueFetchInboxEmails);
router.get(
  "/fetch-recent-email",
  verifyToken,
  emailController.fetchRecentEmail
);
router.get("/fetch-drafts", verifyToken, emailController.fetchDraftEmails);
router.get("/fetch-archive", verifyToken, emailController.fetchArchiveEmails);
// router.get("/get-emails", verifyToken, emailController.getEmails);
router.get("/get-email-labels", verifyToken, emailController.getEmailLabels);
router.get("/fetch-sent", verifyToken, emailController.fetchSentEmails);
router.get("/getoneEmail/:emailId", verifyToken, emailController.getOneEmail);
router.post("/compose", verifyToken, emailController.composeEmail);
router.post("/create-template", verifyToken, emailController.createTemplate);
router.get("/get-templates", verifyToken, emailController.getTemplates);
router.get(
  "/template/:templateID",
  verifyToken,
  emailController.getTemplateById
);
router.delete(
  "/template/:templateID",
  verifyToken,
  emailController.deleteTemplate
);
router.delete(
  "/templates/bulk",
  verifyToken,
  emailController.deleteBulkTemplates
);
router.get("/unread-counts", verifyToken, emailController.getUnreadCounts);
router.post("/add-credential", verifyToken, emailController.addUserCredential);
router.get("/get-credential", verifyToken, emailController.getUserCredential);
router.get("/delete-email/:emailId", verifyToken, emailController.deleteEmail);
router.post("/delete-emails", verifyToken, emailController.deletebulkEmails);
router.post("/save-draft", verifyToken, emailController.saveDraft);
router.post("/schedule-email", verifyToken, emailController.scheduleEmail);
router.get(
  "/delete-all-emails",
  verifyToken,
  emailController.deleteAllEmailsForUser
);

// Bulk email operations
router.post("/bulk-edit", verifyToken, emailController.bulkEditEmails);
router.post("/bulk-delete", verifyToken, emailController.bulkDeleteEmails);
router.post("/bulk-mark", verifyToken, emailController.bulkMarkEmails);
router.post("/bulk-move", verifyToken, emailController.bulkMoveEmails);

// Email visibility (shared/private)
router.post(
  "/visibility/:emailId",
  verifyToken,
  emailController.updateEmailVisibility
);

// router.post("/update-draft", verifyToken,emailController.updateDraft);

// Gmail IMAP test routes (no auth for testing)
router.get("/inbox-count", emailController.checkGmailInboxCount);

// IMAP sync test endpoints
router.get("/imap/health", verifyToken, imapTestController.testImapHealth);
router.post("/imap/test-sync", verifyToken, imapTestController.testImapSync);
router.get("/imap/stats", verifyToken, imapTestController.getImapStats);
router.post(
  "/update-default-email-visibility",
  verifyToken,
  emailController.updateDefaultEmailVisibility
); // Endpoint to trigger the update script
router.get(
  "/search-leads-deals",
  verifyToken,
  emailController.searchLeadsAndDeals
);

// Email entity linking
router.post("/link-to-entity", verifyToken, emailController.linkEmailToEntity);
router.post(
  "/unlink-from-entity",
  verifyToken,
  emailController.unlinkEmailFromEntity
);
router.post(
  "/link-labels",
  verifyToken,
  emailController.linkEmailToSaleInboxLabel
);
router.post(
  "/unlink-labels",
  verifyToken,
  emailController.unlinkEmailFromSaleInboxLabel
);

// 🚀 REAL-TIME EMAIL SYNC WITH IMAP IDLE - Bidirectional CRM ↔ Gmail/Yandex
router.get("/get-emails", verifyToken, emailController.getEmailsRealtime); // Enhanced getEmails with IMAP IDLE (temp: no auth)
router.patch(
  "/mark-read-realtime",
  verifyToken,
  emailController.markEmailReadRealtime
); // Mark read/unread with server sync (temp: no auth)
router.post(
  "/bulk-mark-realtime",
  verifyToken,
  emailController.bulkMarkEmailsRealtime
); // Bulk operations with server sync (temp: no auth)
router.post(
  "/start-realtime-sync",
  verifyToken,
  emailController.startRealtimeSync
); // Start IMAP IDLE monitoring (temp: no auth)
router.post(
  "/stop-realtime-sync",
  verifyToken,
  emailController.stopRealtimeSync
); // Stop IMAP IDLE monitoring (temp: no auth)
router.get("/realtime-status", verifyToken, emailController.getRealtimeStatus); // Check IDLE connection status (temp: no auth)
router.get(
  "/realtime-connections",
  verifyToken,
  emailController.getAllRealtimeConnections
); // Admin: view all connections (temp: no auth)
router.get(
  "/detailed-connection-status",
  verifyToken,
  emailController.getDetailedConnectionStatus
); // Detailed Redis locks and backoff status (temp: no auth)

router.post("/create-campaign-template", verifyToken, emailController.createEmailCampaignTemplate);
router.get("/get-campaign-template", verifyToken, emailController.getAllTemplates);
router.get("/get-campaign-template/:id", verifyToken, emailController.getCampaignTemplateById);
router.put("/update-campaign-template/:id", verifyToken, emailController.updateTemplate);
router.delete("/delete-campaign-template/:id", verifyToken, emailController.deleteCampaignTemplate);

router.post("/create-campaign", verifyToken, createCampaign);
router.put("/update-campaign/:id", verifyToken, editCampaign);
router.get("/get-campaign", verifyToken, getCampaign);
router.get("/get-campaign/:id", verifyToken, getSingleCampaign);
router.delete("/delete-campaign/:id", verifyToken, deleteCampaign);

router.post("/create-campaign-sender", verifyToken, emailController.createCampaignSender);
router.get("/get-campaign-sender", verifyToken, emailController.getAllCampaignSenders);
module.exports = router;
