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
router.post("/create", verifyToken, masterUserController.createMasterUser);

// Get all master users
router.get("/get", verifyToken, masterUserController.getMasterUsers);
// Toggle Master User Status (Activate/Deactivate)
router.post("/toggle-status/:masterUserID", verifyToken,masterUserController.toggleMasterUserStatus);


// Delete a master user
router.post("/delete/:id", verifyToken, masterUserController.deleteMasterUser);
router.get("/reset-password", masterUserController.handleResetLink);
router.post("/reset-password", masterUserController.resetPassword);
router.get("/resend-reset-link",masterUserController.resendResetLink);
router.post("/update/:masterUserID", verifyToken, masterUserController.updateMasterUser);
router.get("/profile", verifyToken,masterUserController.getProfile);

module.exports = router;
