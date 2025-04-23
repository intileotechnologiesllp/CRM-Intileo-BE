const express = require("express");
const router = express.Router();
const masterUserController = require("../../controllers/auth/masterUserController");
// const { authenticate } = require("../../middlewares/authMiddleware");
const { verifyToken } = require("../../middlewares/authMiddleware");
console.log(masterUserController);
// Create a master user
router.post("/create", verifyToken, masterUserController.createMasterUser);

// Get all master users
router.get("/get", verifyToken, masterUserController.getMasterUsers);

// Update a master user
// router.post("/edit/:id", verifyToken, masterUserController.updateMasterUser);

// Delete a master user
router.post("/delete/:id", verifyToken, masterUserController.deleteMasterUser);
router.get("/reset-password", masterUserController.handleResetLink);
router.post("/reset-password", masterUserController.resetPassword);
router.get("/resend-reset-link", masterUserController.resendResetLink);

module.exports = router;
