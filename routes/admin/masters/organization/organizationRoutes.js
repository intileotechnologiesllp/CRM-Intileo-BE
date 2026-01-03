const express = require("express");
const organizationController = require("../../../../controllers/admin/masters/organization/organizationController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const dbContextMiddleware = require("../../../../middlewares/dbContext");
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.use(dbContextMiddleware);

router.post("/create", verifyToken,organizationController.createorganization); // Add organization
router.post("/edit/:organizationId", verifyToken, organizationController.editorganization); // Edit organization
router.post("/delete/:organizationId", verifyToken, organizationController.deleteorganization); // Delete organization
router.get("/get", verifyToken, organizationController.getorganizations); // Get organizations

module.exports = router;
