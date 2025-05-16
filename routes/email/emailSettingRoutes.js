const express = require("express");
const router = express.Router();
const emailSettingsController = require("../../controllers/email/emailSettingController");
const { verifyToken } = require("../../middlewares/authMiddleware");
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



router.post("/create-default-email", verifyToken,emailSettingsController.createOrUpdateDefaultEmail);
router.get("/get-default-email",verifyToken,emailSettingsController.getDefaultEmail);
router.post("/update-default-email",verifyToken,emailSettingsController.updateDefaultEmail);
router.get("/archive-email/:emailId",verifyToken,emailSettingsController.archiveEmail);
router.get("/fetch-sync-email",verifyToken,emailSettingsController.fetchSyncEmails);
router.get("/fetch-sync-data",verifyToken,emailSettingsController.fetchsyncdata)
router.post("/restore-emails",verifyToken,emailSettingsController.restoreEmails);
router.post("/permanently-delete-emails",verifyToken,emailSettingsController.permanentlyDeleteEmails);
router.post("/mark-as-unread",verifyToken,emailSettingsController.markAsUnread);
router.post("/update-signature",verifyToken,upload.single("signatureImage"),emailSettingsController.updateSignature);
router.post("/bulk-archive", verifyToken, emailSettingsController.bulkArchiveEmails);
router.post("/mark-as-read", verifyToken, emailSettingsController.markAsRead);
router.post("/update-email-shared", verifyToken, emailSettingsController.updateEmailSharing);






module.exports = router;