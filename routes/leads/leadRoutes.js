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
router.post("/updateLables", verifyToken, leadController.updateAllLabels);
router.put("/update-custom-fields/:leadId", verifyToken, leadController.updateLeadCustomFields);
router.get("/get-general-users", verifyToken, leadController.getNonAdminMasterUserNames);
router.post("/by-master-user", leadController.getLeadsByMasterUser);
router.post("/get-conversation-with-client/:leadId", verifyToken, leadController.getConversationWithClient);
router.post("/add-lead-note/:leadId", verifyToken, leadController.addLeadNote);

module.exports = router;
