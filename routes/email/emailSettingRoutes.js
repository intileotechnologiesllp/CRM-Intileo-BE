const express = require("express");
const router = express.Router();
const emailSettingsController = require("../../controllers/email/emailSettingController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const validatePrivilege = require("../../middlewares/validatePrivilege");
const multer = require("multer");
const path = require("path");
// Configure storage for signature images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/signatures/"); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
const cleanEmailBody = (body) => {
  // Remove quoted replies (e.g., lines starting with ">")
  return body
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
};



router.post("/create-default-email", verifyToken, validatePrivilege(4, "create"), emailSettingsController.createOrUpdateDefaultEmail);
router.get("/get-default-email",verifyToken, validatePrivilege(4, "view"), emailSettingsController.getDefaultEmail);
router.post("/update-default-email",verifyToken, validatePrivilege(4, "edit"), emailSettingsController.updateDefaultEmail);
router.get("/archive-email/:emailId",verifyToken, validatePrivilege(4, "view"), emailSettingsController.archiveEmail);
router.post("/fetch-sync-email",verifyToken, validatePrivilege(4, "update"), emailSettingsController.queueSyncEmails);
router.get("/fetch-sync-data",verifyToken, validatePrivilege(4, "update"), emailSettingsController.fetchsyncdata)
router.post("/restore-emails",verifyToken, validatePrivilege(4, "update"), emailSettingsController.restoreEmails);
router.post("/permanently-delete-emails",verifyToken, validatePrivilege(4, "delete"), emailSettingsController.permanentlyDeleteEmails);
router.post("/mark-as-unread",verifyToken, validatePrivilege(4, "update"), emailSettingsController.markAsUnread);
router.post("/update-signature",verifyToken, validatePrivilege(4, "update"), upload.single("signatureImage"),emailSettingsController.updateSignature);
router.post("/bulk-archive", verifyToken, validatePrivilege(4, "update"), emailSettingsController.bulkArchiveEmails);
router.post("/mark-as-read", verifyToken, validatePrivilege(4, "update"), emailSettingsController.markAsRead);
router.post("/update-email-shared", verifyToken, validatePrivilege(4, "update"), emailSettingsController.updateEmailSharing);
router.post("/update-smart-bcc", verifyToken, validatePrivilege(4, "update"), emailSettingsController.setSmartBcc);
router.post("/update-blocked-email", verifyToken, validatePrivilege(4, "update"), emailSettingsController.updateBlockedAddress);
router.post("/remove-blocked-email", verifyToken, validatePrivilege(4, "update"), emailSettingsController.removeBlockedAddress);
router.get("/get-signature", verifyToken, validatePrivilege(4, "view"), emailSettingsController.getSignature);
router.get("/get-blocked-addresses", verifyToken, validatePrivilege(4, "view"), emailSettingsController.getBlockedAddress);
router.get("/get-smart-bcc", verifyToken, validatePrivilege(4, "view"), emailSettingsController.getSmartBcc);
router.get("/get-email-autopopulate",verifyToken, validatePrivilege(4, "view"), emailSettingsController.getEmailAutocomplete);
router.get("/download-attachment",verifyToken, validatePrivilege(4, "create"), emailSettingsController.downloadAttachment);
router.get("/mark-as-unraed-single/:emailID",verifyToken, validatePrivilege(4, "view"), emailSettingsController.markAsUnreadSingle);
router.get("/diagnoseAttachment", verifyToken, validatePrivilege(4, "view"), emailSettingsController.diagnoseAttachment);





module.exports = router;