const express = require("express");
const organizationController = require("../../../../controllers/admin/masters/organization/organizationController");

const router = express.Router();

router.post("/create", organizationController.createorganization); // Add organization
router.post("/edit/:organizationId", organizationController.editorganization); // Edit organization
router.post("/delete/:organizationId", organizationController.deleteorganization); // Delete organization
router.get("/get", organizationController.getorganizations); // Get organizations

module.exports = router;
