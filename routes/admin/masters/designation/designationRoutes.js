const express = require("express");
const designationController = require("../../../../controllers/admin/masters/designation/designationController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create", verifyToken, validatePrivilege(7, "create"), designationController.createDesignation); // Add designation
router.post("/edit/:designationId",verifyToken, validatePrivilege(7, "edit"), designationController.editDesignation); // Edit designation
router.post("/delete/:designationId",verifyToken, validatePrivilege(7, "delete"), designationController.deleteDesignation); // Delete designation
router.get("/get",verifyToken, validatePrivilege(7, "view"), designationController.getDesignations); // Get designations

module.exports = router;
