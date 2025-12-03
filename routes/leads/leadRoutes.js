const express = require("express");
const router = express.Router();
const leadController = require("../../controllers/leads/leadController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const validatePrivilege = require("../../middlewares/validatePrivilege");
const Lead = require("../../models/leads/leadsModel");

// Create a lead (Admin only)
router.post("/create", verifyToken, validatePrivilege(7, "create"), leadController.createLead);

// Get visibility options for lead creation/editing
router.get(
  "/visibility-options",
  verifyToken,
  leadController.getLeadVisibilityOptions
);

// Archive a lead
router.post("/:leadId/archive", verifyToken, leadController.archiveLead);

// Unarchive a lead
router.post("/:leadId/unarchive", verifyToken, leadController.unarchiveLead);

// Update a lead
router.post("/edit/:leadId", verifyToken, validatePrivilege(8, "edit_others", { checkOwnership: true, ownershipModel: Lead }), leadController.updateLead);

// Delete a lead
router.post("/delete/:leadId", verifyToken, validatePrivilege(10, "delete", { checkOwnership: true, ownershipModel: Lead }), leadController.deleteLead);

router.get("/get", verifyToken, leadController.getLeads);
router.post("/updateLables", verifyToken, validatePrivilege(8, "edit_others", { checkOwnership: true, ownershipModel: Lead }), leadController.updateAllLabels);
router.put(
  "/update-custom-fields/:leadId",
  verifyToken,
  validatePrivilege(8, "edit_others", { checkOwnership: true, ownershipModel: Lead }),
  leadController.updateLeadCustomFields
);
router.get(
  "/get-general-users",
  verifyToken,
  leadController.getNonAdminMasterUserNames
);
router.post("/by-master-user", verifyToken, leadController.getLeadsByMasterUser);
router.get(
  "/get-All-lead-details/:leadId",
  verifyToken,
  leadController.getAllLeadDetails
);
// New lightweight endpoint: Get unified timeline (emails, notes, activities) for a lead
router.get(
  "/emails/:leadId",
  verifyToken,
  leadController.getLeadEmails
);
// Alternative route name for clarity
router.get(
  "/timeline/:leadId",
  verifyToken,
  leadController.getLeadEmails
);
router.post("/add-lead-note/:leadId", verifyToken, validatePrivilege(7, "create"), leadController.addLeadNote);
router.get(
  "/delete-lead-note/:noteId",
  verifyToken,
  validatePrivilege(10, "delete"),
  leadController.deleteLeadNote
);
router.post(
  "/update-lead-note/:noteId",
  verifyToken,
  validatePrivilege(8, "edit_others"),
  leadController.updateLeadNote
);
router.get("/get-persons", verifyToken, leadController.getPersons);

// Bulk operations
router.post("/bulk-edit", verifyToken, validatePrivilege(8, "edit_others", { checkOwnership: true, ownershipModel: Lead }), leadController.bulkEditLeads);
router.post("/bulk-delete", verifyToken, validatePrivilege(10, "delete", { checkOwnership: true, ownershipModel: Lead }), leadController.bulkDeleteLeads);
router.post("/bulk-archive", verifyToken, validatePrivilege(8, "edit_others", { checkOwnership: true, ownershipModel: Lead }), leadController.bulkArchiveLeads);
router.post("/bulk-unarchive", verifyToken, validatePrivilege(8, "edit_others", { checkOwnership: true, ownershipModel: Lead }), leadController.bulkUnarchiveLeads);
router.post("/bulk-convert-to-deals", verifyToken, validatePrivilege(7, "create"), leadController.convertBulkLeadsToDeals);
// router.post('/bulk-import', verifyToken,upload.single('file'), leadController.bulkImportLeads);

// ===========================================
// LABEL MANAGEMENT ROUTES
// ===========================================

// Get all available labels for leads
router.get("/labels", verifyToken, leadController.getLeadLabels);

// Get all labels with usage statistics
router.get("/labels/stats", verifyToken, leadController.getLeadLabelsWithStats);

// Create a new label for leads
router.post("/labels/create", verifyToken, validatePrivilege(7, "create"), leadController.createLeadLabel);

// Edit/Update a particular label
router.post("/labels/edit/:labelId", verifyToken, validatePrivilege(8, "edit_others"), leadController.updateLeadLabel);

// Update labels for a specific lead
router.put("/labels/:leadId", verifyToken, validatePrivilege(8, "edit_others", { checkOwnership: true, ownershipModel: Lead }), leadController.updateLeadLabels);

// Get leads filtered by specific labels
router.get("/labels/filter", verifyToken, leadController.getLeadsByLabels);

// Delete a label (soft delete)
router.delete("/labels/:labelId", verifyToken, validatePrivilege(10, "delete"), leadController.deleteLeadLabel);

// ===========================================
// EXCEL IMPORT ROUTES
// ===========================================

// Import leads from Excel file
router.post("/import/excel", verifyToken, validatePrivilege(7, "create"), leadController.importLeadsFromExcel);

// Download Excel import template
router.get("/import/template", verifyToken, leadController.getExcelImportTemplate);

module.exports = router;
