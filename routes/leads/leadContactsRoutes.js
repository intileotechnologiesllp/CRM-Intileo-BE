const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const leadContactsController = require("../../controllers/leads/leadContactController");


router.post("/create-organization", verifyToken, leadContactsController.createOrganization);
router.post("/create-person", verifyToken, leadContactsController.createPerson);
router.get("/get-contact-timeline", leadContactsController.getContactTimeline);
router.get("/get-person-timeline/:personId", leadContactsController.getPersonTimeline);
router.get("/get-organization-timeline/:organizationId", leadContactsController.getOrganizationTimeline);
router.get("/get-person-fields", leadContactsController.getPersonFields);
router.get("/get-organization-fields", leadContactsController.getOrganizationFields);





module.exports = router;