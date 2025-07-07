const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Organization CRUD Routes
router.post("/", organizationController.createOrganization);
router.get("/", organizationController.getAllOrganizations);
router.get("/:organizationId", organizationController.getOrganizationById);
router.put("/:organizationId", organizationController.updateOrganization);
router.delete("/:organizationId", organizationController.deleteOrganization);

module.exports = router;
