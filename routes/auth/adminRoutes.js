const express = require("express");
const adminController = require("../../controllers/auth/adminController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  validateSignIn,
  validateCreateAdmin,
} = require("../../middlewares/adminValidation");
const { handleValidationErrors } = require("../../middlewares/errorMiddleware");
const { saveStartUpQuestions } = require("../../controllers/common/commonController");

const router = express.Router();

// Admin routes
router.post(
  "/signin",
  validateSignIn,
  handleValidationErrors,
  adminController.signIn
);
router.post(
  "/create",
  validateCreateAdmin,
  handleValidationErrors,
  adminController.createAdmin
);

// Forgot password route
router.post("/forgot-password", adminController.forgotPassword);
router.post("/verify-otp", adminController.verifyOtp);
router.post("/reset-password", adminController.resetPassword);

// Google OAuth routes
router.get("/google/login", adminController.googleAuthLogin);
router.post("/google/callback", adminController.googleAuthCallback);
router.get("/oauth2callback", adminController.googleAuthCallback); // Google redirect endpoint

// Debug route - Remove this after testing
router.get("/google/debug", (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID ? 'SET ✓' : 'NOT SET ✗',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET ✓' : 'NOT SET ✗',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'NOT SET ✗',
    fullUrl: process.env.GOOGLE_REDIRECT_URI
  });
});

// Master user routes

router.post("/logout", verifyToken,adminController.logout);
router.get("/login-history/:userId",adminController.getLoginHistory);
router.get("/login-history",adminController.getAllLoginHistory);
router.get("/getRecentLoginHistory",adminController.getRecentLoginHistory);
router.get("/get-miscsettings",adminController.getMiscSettings);
router.post("/update-miscsettings",adminController.updateMiscSettings);
router.post("/change-password", verifyToken,adminController.changePassword);
router.post("/validate-password", verifyToken,adminController.validatePassword);
router.post("/save-startup-question", saveStartUpQuestions);





module.exports = router;
