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

// Timeline Routes - Get unified timeline (emails, activities) for an organization
const leadController = require("../controllers/leads/leadController");

router.get(
  "/timeline/:organizationId",
  verifyToken,
  leadController.getOrganizationTimeline
);

router.get(
  "/emails/:organizationId",
  verifyToken,
  leadController.getOrganizationTimeline
);

module.exports = router;
