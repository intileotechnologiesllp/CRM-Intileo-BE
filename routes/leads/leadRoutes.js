const express = require("express");
const router = express.Router();
const leadController = require("../../controllers/leads/leadController");
const { verifyToken } = require("../../middlewares/authMiddleware");

// Create a lead (Admin only)
router.post("/create", verifyToken, leadController.createLead);

// Archive a lead
router.post("/:leadId/archive", verifyToken, leadController.archiveLead);

// Unarchive a lead
router.post("/:leadId/unarchive", verifyToken, leadController.unarchiveLead);

// Update a lead
router.post("/edit/:leadId", verifyToken, leadController.updateLead);

// Delete a lead
router.post("/delete/:leadId", verifyToken, leadController.deleteLead);

router.get("/get", verifyToken, leadController.getLeads);

module.exports = router;
