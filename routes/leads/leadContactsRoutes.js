const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const validatePrivilege = require("../../middlewares/validatePrivilege");
const leadContactsController = require("../../controllers/leads/leadContactController");

router.post(
  "/create-organization",
  verifyToken,
  validatePrivilege(26, "create_org"),
  leadContactsController.createOrganization
);
router.post("/create-person", verifyToken, validatePrivilege(23, "create"), leadContactsController.createPerson);
router.get("/get-person/:personId",leadContactsController.getPerson);
router.get("/get-contact-timeline",leadContactsController.getContactTimeline);
router.get("/get-person-timeline/:personId", verifyToken,
  leadContactsController.getPersonTimeline
);
router.get(
  "/get-organization-timeline/:organizationId", verifyToken,
  leadContactsController.getOrganizationTimeline
);
router.get("/get-person-fields", leadContactsController.getPersonFields);
router.get(
  "/get-organization-fields",
  leadContactsController.getOrganizationFields
);
router.post(
  "/update-person-fields/:personId",
  verifyToken,
  leadContactsController.updatePerson
);
router.post(
  "/update-organization-fields/:leadOrganizationId",
  verifyToken,
  leadContactsController.updateOrganization
);
router.post(
  "/link-person-organization",
  verifyToken,
  validatePrivilege(23, "create"),
  leadContactsController.linkPersonToOrganization
);
router.post(
  "/create-person-note/:personId",
  verifyToken,
  validatePrivilege(23, "create"),
  leadContactsController.addPersonNote
);
router.post(
  "/create-organization-note/:leadOrganizationId",
  verifyToken,
  validatePrivilege(26, "create_org"),
  leadContactsController.addOrganizationNote
);

// Get notes routes
router.get(
  "/get-person-notes/:personId",
  verifyToken,
  leadContactsController.getPersonNotes
);
router.get(
  "/get-organization-notes/:leadOrganizationId",
  verifyToken,
  leadContactsController.getOrganizationNotes
);

// Update notes routes
router.put(
  "/update-person-note/:personId/:noteId",
  verifyToken,
  leadContactsController.updatePersonNote
);
router.put(
  "/update-organization-note/:leadOrganizationId/:noteId",
  verifyToken,
  leadContactsController.updateOrganizationNote
);

// Delete notes routes
router.delete(
  "/delete-person-note/:personId/:noteId",
  verifyToken,
  validatePrivilege(25, "delete"),
  leadContactsController.deletePersonNote
);
router.delete(
  "/delete-organization-note/:leadOrganizationId/:noteId",
  verifyToken,
  validatePrivilege(28, "delete_org"),
  leadContactsController.deleteOrganizationNote
);
router.get("/get-all-Persons", verifyToken,leadContactsController.getAllContactPersons);
router.get(
  "/get-all-persons-by-organization/:leadOrganizationId", verifyToken,
  leadContactsController.getPersonsByOrganization
);
router.get(
  "/get-all-person-organizations",
  verifyToken,
  leadContactsController.getPersonsAndOrganizations
);
// router.get(
//   "/get-persons-by-ids",
//   verifyToken,
//   validatePrivilege(5, "view"),
//   leadContactsController.getPersonsByIds
// );
router.post(
  "/get-persons-by-ids",
  verifyToken,
  leadContactsController.getPersonsByIds
);
router.get(
  "/get-organizations-by-ids",
  verifyToken,
  leadContactsController.getOrganizationsByIds
);
router.post(
  "/get-organizations-by-ids",
  verifyToken,
  leadContactsController.getOrganizationsByIds
);
router.get("/get-organization",verifyToken, leadContactsController.getOrganizationsAndPersons)
router.post("/bulk-edit-persons", verifyToken, leadContactsController.bulkUpdatePersons);
router.post("/bulk-edit-organizations", verifyToken,leadContactsController.bulkUpdateOrganizations);
router.delete('/deleteorganization/:leadOrganizationId', verifyToken, validatePrivilege(28, "delete_org"), leadContactsController.deleteOrganization);
router.delete('/deleteperson/:personId', verifyToken, validatePrivilege(25, "delete"), leadContactsController.deletePerson);
router.post("/save-organization-fields", verifyToken, validatePrivilege(26, "create_org"), leadContactsController.saveAllOrganizationFieldsWithCheck);
router.get("/organization-check-columns", verifyToken,leadContactsController.getOrganizationColumnPreference);
router.post("/update-organization-columns", verifyToken,leadContactsController.updateOrganizationColumnChecks);
router.post("/save-person-fields", verifyToken, validatePrivilege(23, "create"), leadContactsController.saveAllPersonFieldsWithCheck);
router.get("/person-check-columns", verifyToken,leadContactsController.getBothColumnPreferences);
router.post("/update-person-columns", verifyToken,leadContactsController.updatePersonColumnChecks);
router.post("/update-person-owner", verifyToken, leadContactsController.updatePersonOwner);
router.post("/update-organization-owner", verifyToken, leadContactsController.updateOrganizationOwner);

// ===================================================================
// FILE MANAGEMENT ROUTES FOR PERSONS AND ORGANIZATIONS
// ===================================================================

// Person file management routes
router.post(
  "/upload-person-files/:personId",
  verifyToken,
  validatePrivilege(23, "create"),
  leadContactsController.uploadPersonFiles
);
router.get(
  "/get-person-files/:personId",
  verifyToken,
  leadContactsController.getPersonFiles
);
router.get(
  "/download-person-file/:personId/:fileId",
  verifyToken,
  leadContactsController.downloadPersonFile
);
router.delete(
  "/delete-person-file/:personId/:fileId",
  verifyToken,
  validatePrivilege(25, "delete"),
  leadContactsController.deletePersonFile
);

// Organization file management routes
router.post(
  "/upload-organization-files/:leadOrganizationId",
  verifyToken,
  validatePrivilege(26, "create_org"),
  leadContactsController.uploadOrganizationFiles
);
router.get(
  "/get-organization-files/:leadOrganizationId",
  verifyToken,
  leadContactsController.getOrganizationFiles
);
router.get(
  "/download-organization-file/:leadOrganizationId/:fileId",
  verifyToken,
  leadContactsController.downloadOrganizationFile
);
router.delete(
  "/delete-organization-file/:leadOrganizationId/:fileId",
  verifyToken,
  validatePrivilege(28, "delete_org"),
  leadContactsController.deleteOrganizationFile
);

// ===========================
// PERSON SIDEBAR MANAGEMENT ROUTES
// ===========================

// Get person sidebar preferences
router.get(
  "/person-sidebar-preferences",
  verifyToken,
  leadContactsController.getPersonSidebarPreferences
);

// Update person sidebar preferences
router.post(
  "/person-sidebar-preferences",
  verifyToken,
  leadContactsController.updatePersonSidebarPreferences
);

// Reset person sidebar preferences to default
router.post(
  "/person-sidebar-preferences/reset",
  verifyToken,
  leadContactsController.resetPersonSidebarPreferences
);

// Toggle specific sidebar section
router.post(
  "/person-sidebar-preferences/toggle",
  verifyToken,
  leadContactsController.togglePersonSidebarSection
);

// ===========================
// ORGANIZATION SIDEBAR MANAGEMENT ROUTES
// ===========================

// Get organization sidebar preferences
router.get(
  "/organization-sidebar-preferences",
  verifyToken,
  leadContactsController.getOrganizationSidebarPreferences
);

// Update organization sidebar preferences
router.post(
  "/organization-sidebar-preferences",
  verifyToken,
  leadContactsController.updateOrganizationSidebarPreferences
);

// Reset organization sidebar preferences to default
router.post(
  "/organization-sidebar-preferences/reset",
  verifyToken,
  leadContactsController.resetOrganizationSidebarPreferences
);

// Toggle specific organization sidebar section
router.post(
  "/organization-sidebar-preferences/toggle",
  verifyToken,
  leadContactsController.toggleOrganizationSidebarSection
);


module.exports = router
