const express = require("express");
const organizationController = require("../../../../controllers/admin/masters/organization/organizationController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create", verifyToken, validatePrivilege(10, "create"), organizationController.createorganization); // Add organization
router.post("/edit/:organizationId", verifyToken, validatePrivilege(10, "edit"), organizationController.editorganization); // Edit organization
router.post("/delete/:organizationId", verifyToken, validatePrivilege(10, "delete"), organizationController.deleteorganization); // Delete organization
router.get("/get", verifyToken, validatePrivilege(10, "view"), organizationController.getorganizations); // Get organizations

module.exports = router;
