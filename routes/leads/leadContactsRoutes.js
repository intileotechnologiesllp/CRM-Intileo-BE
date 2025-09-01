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
router.get("/get-contact-timeline", validatePrivilege(5, "view"), leadContactsController.getContactTimeline);
router.get(
  "/get-person-timeline/:personId",
  validatePrivilege(5, "view"),
  leadContactsController.getPersonTimeline
);
router.get(
  "/get-organization-timeline/:organizationId",
  validatePrivilege(5, "view"),
  leadContactsController.getOrganizationTimeline
);
router.get("/get-person-fields", validatePrivilege(5, "view"), leadContactsController.getPersonFields);
router.get(
  "/get-organization-fields",
  validatePrivilege(5, "view"),
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
router.get("/get-all-Persons", validatePrivilege(5, "view"), leadContactsController.getAllContactPersons);
router.get(
  "/get-all-persons-by-organization/:leadOrganizationId",
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
module.exports = router
