const express = require("express");
const organizationController = require("../../../../controllers/admin/masters/organization/organizationController");

const router = express.Router();

router.post("/", organizationController.createOrganizationType); // Add organization type
router.put("/:id", organizationController.editOrganizationType); // Edit organization type
router.delete("/:id", organizationController.deleteOrganizationType); // Delete organization type
router.get("/", organizationController.getOrganizationTypes); // Get organization types

module.exports = router;
