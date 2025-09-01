const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const { verifyToken } = require("../middlewares/authMiddleware");
const validatePrivilege = require("../middlewares/validatePrivilege");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Organization CRUD Routes
router.post("/", validatePrivilege(5, "create"), organizationController.createOrganization);
router.get("/", validatePrivilege(5, "view"), organizationController.getAllOrganizations);
router.get("/:organizationId", validatePrivilege(5, "view"), organizationController.getOrganizationById);
router.put("/:organizationId", validatePrivilege(5, "edit"), organizationController.updateOrganization);
router.delete("/:organizationId", validatePrivilege(5, "delete"), organizationController.deleteOrganization);

module.exports = router;
