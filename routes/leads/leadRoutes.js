const express = require("express");
const router = express.Router();
const leadController = require("../../controllers/leads/leadController");
const { verifyToken } = require("../../middlewares/authMiddleware");

// Create a lead (Admin only)
router.post("/create", verifyToken, leadController.createLead);

module.exports = router;
