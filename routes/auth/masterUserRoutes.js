const express = require("express");
const router = express.Router();
const masterUserController = require("../../controllers/auth/masterUserController");
// const { authenticate } = require("../../middlewares/authMiddleware");
const { verifyToken } = require("../../middlewares/authMiddleware");
console.log(masterUserController);
// const rateLimit = require("express-rate-limit");

// Define rate-limiting middleware
// const resendResetLinkLimiter = rateLimit({
//   windowMs: 2 * 60 * 1000, // 15 minutes
//   max: 2, // Limit each IP to 5 requests per windowMs
//   message: {
//     message: "Too many reset link requests. Please try again later.",
//   },
// });
// Create a master user
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const uploadDir = path.join(__dirname, "../../uploads/profile-images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, path.join(__dirname, "../../uploads/profile-images"));
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + "-" + file.originalname);
//   },
// });
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  // ...
});
const upload = multer({ storage });

router.post("/create", verifyToken, masterUserController.createMasterUser);

// Get all master users
router.get("/get", verifyToken, masterUserController.getMasterUsers);

router.patch("/update-groupId", verifyToken, masterUserController.updateMasterGroupId);
// Toggle Master User Status (Activate/Deactivate)
router.post("/toggle-status/:masterUserID", verifyToken,masterUserController.toggleMasterUserStatus);


// Delete a master user
router.post("/delete/:id", verifyToken, masterUserController.deleteMasterUser);
router.get("/reset-password", masterUserController.handleResetLink);
router.post("/reset-password", masterUserController.resetPassword);
router.get("/resend-reset-link",masterUserController.resendResetLink);
router.post("/update/:masterUserID", verifyToken, masterUserController.updateMasterUser);
router.get("/profile", verifyToken,masterUserController.getProfile);
router.post("/update-profile", verifyToken,upload.single("profileImage"),masterUserController.updateProfile);
router.post("/start-google-oauth", verifyToken,masterUserController.startGoogleOAuth);
router.get("/oauth2callback", masterUserController.handleGoogleOAuthCallback);
router.post("/set-permission-sets", verifyToken,masterUserController.setMasterUserPermissions);

module.exports = router;
