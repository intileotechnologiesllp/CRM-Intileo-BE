const express = require("express");
const designationController = require("../../../../controllers/admin/masters/designation/designationController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const dbContextMiddleware = require("../../../../middlewares/dbContext");
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();


router.use(dbContextMiddleware);

router.post("/create", verifyToken,designationController.createDesignation); // Add designation
router.post("/edit/:designationId",verifyToken, designationController.editDesignation); // Edit designation
router.post("/delete/:designationId",verifyToken, designationController.deleteDesignation); // Delete designation
router.get("/get",verifyToken, designationController.getDesignations); // Get designations

module.exports = router;
