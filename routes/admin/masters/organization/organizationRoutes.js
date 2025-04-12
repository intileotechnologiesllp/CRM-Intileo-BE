const express = require("express");
const organizationController = require("../../../../controllers/admin/masters/organization/organizationController");

const router = express.Router();

router.post("/create", organizationController.createOrganizationType); // Add organization type
router.put("/edit/:id", organizationController.editOrganizationType); // Edit organization type
router.delete("/delete/:id", organizationController.deleteOrganizationType); // Delete organization type
router.get("/get", organizationController.getOrganizationTypes); // Get organization types

module.exports = router;
