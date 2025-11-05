const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const validatePrivilege = require("../../middlewares/validatePrivilege");
const leadContactsController = require("../../controllers/leads/leadContactController");

router.post(
  "/create-organization",
  verifyToken,
  validatePrivilege(5, "create"),
  leadContactsController.createOrganization
);
router.post("/create-person", verifyToken, validatePrivilege(5, "create"), leadContactsController.createPerson);
router.get("/get-person/:personId", verifyToken, validatePrivilege(5, "view"), leadContactsController.getPerson);
router.get("/get-contact-timeline", validatePrivilege(5, "view"), leadContactsController.getContactTimeline);
router.get(
  "/get-person-timeline/:personId", verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.getPersonTimeline
);
router.get(
  "/get-organization-timeline/:organizationId", verifyToken,
  validatePrivilege(5, "view"),
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
  validatePrivilege(5, "edit"),
  leadContactsController.updatePerson
);
router.post(
  "/update-organization-fields/:leadOrganizationId",
  verifyToken,
  validatePrivilege(5, "edit"),
  leadContactsController.updateOrganization
);
router.post(
  "/link-person-organization",
  verifyToken,
  validatePrivilege(5, "create"),
  leadContactsController.linkPersonToOrganization
);
router.post(
  "/create-person-note/:personId",
  verifyToken,
  validatePrivilege(5, "create"),
  leadContactsController.addPersonNote
);
router.post(
  "/create-organization-note/:leadOrganizationId",
  verifyToken,
  validatePrivilege(5, "create"),
  leadContactsController.addOrganizationNote
);

// Get notes routes
router.get(
  "/get-person-notes/:personId",
  verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.getPersonNotes
);
router.get(
  "/get-organization-notes/:leadOrganizationId",
  verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.getOrganizationNotes
);

// Update notes routes
router.put(
  "/update-person-note/:personId/:noteId",
  verifyToken,
  validatePrivilege(5, "edit"),
  leadContactsController.updatePersonNote
);
router.put(
  "/update-organization-note/:leadOrganizationId/:noteId",
  verifyToken,
  validatePrivilege(5, "edit"),
  leadContactsController.updateOrganizationNote
);

// Delete notes routes
router.delete(
  "/delete-person-note/:personId/:noteId",
  verifyToken,
  validatePrivilege(5, "delete"),
  leadContactsController.deletePersonNote
);
router.delete(
  "/delete-organization-note/:leadOrganizationId/:noteId",
  verifyToken,
  validatePrivilege(5, "delete"),
  leadContactsController.deleteOrganizationNote
);
router.get("/get-all-Persons", verifyToken, validatePrivilege(5, "view"), leadContactsController.getAllContactPersons);
router.get(
  "/get-all-persons-by-organization/:leadOrganizationId", verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.getPersonsByOrganization
);
router.get(
  "/get-all-person-organizations",
  verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.getPersonsAndOrganizations
);
router.get("/get-organization",verifyToken, validatePrivilege(5, "view"), leadContactsController.getOrganizationsAndPersons)
router.post("/bulk-edit-persons", verifyToken, validatePrivilege(5, "edit"), leadContactsController.bulkUpdatePersons);
router.post("/bulk-edit-organizations", verifyToken, validatePrivilege(5, "edit"), leadContactsController.bulkUpdateOrganizations);
router.delete('/deleteorganization/:leadOrganizationId', verifyToken, leadContactsController.deleteOrganization);
router.delete('/deleteperson/:personId', verifyToken, leadContactsController.deletePerson);
router.post("/save-organization-fields", verifyToken, validatePrivilege(5, "create"), leadContactsController.saveAllOrganizationFieldsWithCheck);
router.get("/organization-check-columns", verifyToken, validatePrivilege(5, "view"), leadContactsController.getOrganizationColumnPreference);
router.post("/update-organization-columns", verifyToken, validatePrivilege(5, "edit"), leadContactsController.updateOrganizationColumnChecks);
router.post("/save-person-fields", verifyToken, validatePrivilege(5, "create"), leadContactsController.saveAllPersonFieldsWithCheck);
router.get("/person-check-columns", verifyToken, validatePrivilege(5, "view"), leadContactsController.getBothColumnPreferences);
router.post("/update-person-columns", verifyToken, validatePrivilege(5, "edit"), leadContactsController.updatePersonColumnChecks);
router.post("/update-person-owner", verifyToken, validatePrivilege(5, "edit"), leadContactsController.updatePersonOwner);
router.post("/update-organization-owner", verifyToken, validatePrivilege(5, "edit"), leadContactsController.updateOrganizationOwner);

// ===================================================================
// FILE MANAGEMENT ROUTES FOR PERSONS AND ORGANIZATIONS
// ===================================================================

// Person file management routes
router.post(
  "/upload-person-files/:personId",
  verifyToken,
  validatePrivilege(5, "create"),
  leadContactsController.uploadPersonFiles
);
router.get(
  "/get-person-files/:personId",
  verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.getPersonFiles
);
router.get(
  "/download-person-file/:personId/:fileId",
  verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.downloadPersonFile
);
router.delete(
  "/delete-person-file/:personId/:fileId",
  verifyToken,
  validatePrivilege(5, "delete"),
  leadContactsController.deletePersonFile
);

// Organization file management routes
router.post(
  "/upload-organization-files/:leadOrganizationId",
  verifyToken,
  validatePrivilege(5, "create"),
  leadContactsController.uploadOrganizationFiles
);
router.get(
  "/get-organization-files/:leadOrganizationId",
  verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.getOrganizationFiles
);
router.get(
  "/download-organization-file/:leadOrganizationId/:fileId",
  verifyToken,
  validatePrivilege(5, "view"),
  leadContactsController.downloadOrganizationFile
);
router.delete(
  "/delete-organization-file/:leadOrganizationId/:fileId",
  verifyToken,
  validatePrivilege(5, "delete"),
  leadContactsController.deleteOrganizationFile
);


module.exports = router
