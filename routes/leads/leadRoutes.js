const express = require("express");
const router = express.Router();
const leadController = require("../../controllers/leads/leadController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const validatePrivilege = require("../../middlewares/validatePrivilege");

// Create a lead (Admin only)
router.post("/create", verifyToken, validatePrivilege(2, "create"), leadController.createLead);

// Get visibility options for lead creation/editing
router.get(
  "/visibility-options",
  verifyToken, 
  validatePrivilege(2, "view"),
  leadController.getLeadVisibilityOptions
);

// Archive a lead
router.post("/:leadId/archive", verifyToken, validatePrivilege(2, "create"), leadController.archiveLead);

// Unarchive a lead
router.post("/:leadId/unarchive", verifyToken, validatePrivilege(2, "create"), leadController.unarchiveLead);

// Update a lead
router.post("/edit/:leadId", verifyToken, validatePrivilege(2, "edit"), leadController.updateLead);

// Delete a lead
router.post("/delete/:leadId", verifyToken, validatePrivilege(2, "delete"), leadController.deleteLead);

router.get("/get", verifyToken,  validatePrivilege(2, "view"), leadController.getLeads);
router.post("/updateLables", verifyToken,  validatePrivilege(2, "update"), leadController.updateAllLabels);
router.put(
  "/update-custom-fields/:leadId",
  verifyToken,
  validatePrivilege(2, "update"),
  leadController.updateLeadCustomFields
);
router.get(
  "/get-general-users",
  verifyToken,
   validatePrivilege(2, "view"),
  leadController.getNonAdminMasterUserNames
);
router.post("/by-master-user", verifyToken, leadController.getLeadsByMasterUser);
router.get(
  "/get-All-lead-details/:leadId",
  verifyToken,
   validatePrivilege(2, "view"),
  leadController.getAllLeadDetails
);
router.post("/add-lead-note/:leadId", verifyToken,  validatePrivilege(2, "create"), leadController.addLeadNote);
router.get(
  "/delete-lead-note/:noteId",
  verifyToken,
  validatePrivilege(2, "delete"),
  leadController.deleteLeadNote
);
router.post(
  "/update-lead-note/:noteId",
  verifyToken,
   validatePrivilege(2, "update"),
  leadController.updateLeadNote
);
router.get("/get-persons", verifyToken,  validatePrivilege(2, "view"), leadController.getPersons);

// Bulk operations
router.post("/bulk-edit", verifyToken,  validatePrivilege(2, "edit"), leadController.bulkEditLeads);
router.post("/bulk-delete", verifyToken,  validatePrivilege(2, "delete"), leadController.bulkDeleteLeads);
router.post("/bulk-archive", verifyToken,  validatePrivilege(2, "create"), leadController.bulkArchiveLeads);
router.post("/bulk-unarchive", verifyToken,  validatePrivilege(2, "create"), leadController.bulkUnarchiveLeads);
router.post("/bulk-convert-to-deals", verifyToken, validatePrivilege(2, "create"), leadController.convertBulkLeadsToDeals);
// router.post('/bulk-import', verifyToken,upload.single('file'), leadController.bulkImportLeads);

// ===========================================
// LABEL MANAGEMENT ROUTES
// ===========================================

// Get all available labels for leads
router.get("/labels", verifyToken, validatePrivilege(2, "view"), leadController.getLeadLabels);

// Get all labels with usage statistics
router.get("/labels/stats", verifyToken, validatePrivilege(2, "view"), leadController.getLeadLabelsWithStats);

// Create a new label for leads
router.post("/labels/create", verifyToken, validatePrivilege(2, "create"), leadController.createLeadLabel);

// Edit/Update a particular label
router.post("/labels/edit/:labelId", verifyToken, validatePrivilege(2, "edit"), leadController.updateLeadLabel);

// Update labels for a specific lead
router.put("/labels/:leadId", verifyToken, validatePrivilege(2, "edit"), leadController.updateLeadLabels);

// Get leads filtered by specific labels
router.get("/labels/filter", verifyToken, validatePrivilege(2, "view"), leadController.getLeadsByLabels);

// Delete a label (soft delete)
router.delete("/labels/:labelId", verifyToken, validatePrivilege(2, "delete"), leadController.deleteLeadLabel);

// ===========================================
// EXCEL IMPORT ROUTES
// ===========================================

// Import leads from Excel file
router.post("/import/excel", verifyToken, validatePrivilege(2, "create"), leadController.importLeadsFromExcel);

// Download Excel import template
router.get("/import/template", verifyToken, validatePrivilege(2, "view"), leadController.getExcelImportTemplate);

module.exports = router;
