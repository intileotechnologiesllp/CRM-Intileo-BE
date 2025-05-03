const express = require("express");
const adminController = require("../../controllers/auth/adminController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  validateSignIn,
  validateCreateAdmin,
} = require("../../middlewares/adminValidation");
const { handleValidationErrors } = require("../../middlewares/errorMiddleware");

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

// Master user routes

router.post("/logout", verifyToken,adminController.logout);
router.get("/login-history", adminController.getLoginHistory);
router.get("/getRecentLoginHistory", adminController.getRecentLoginHistory);


module.exports = router;
