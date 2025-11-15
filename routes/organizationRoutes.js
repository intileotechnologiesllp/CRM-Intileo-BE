const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const { verifyToken } = require("../middlewares/authMiddleware");
const validatePrivilege = require("../middlewares/validatePrivilege");

// Apply authentication middleware to all routes
// router.use(verifyToken);

// Organization CRUD Routes
router.post("/", verifyToken,organizationController.createOrganization);
router.get("/", verifyToken, organizationController.getAllOrganizations);
router.get("/:organizationId", verifyToken, organizationController.getOrganizationById);
router.put("/:organizationId", verifyToken, organizationController.updateOrganization);
router.delete("/:organizationId", verifyToken, organizationController.deleteOrganization);
module.exports = router;
