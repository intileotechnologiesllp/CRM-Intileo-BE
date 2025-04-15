const express = require("express");
const designationController = require("../../../../controllers/admin/masters/designation/designationController");

const router = express.Router();

router.post("/create", designationController.createDesignation); // Add designation
router.post("/edit/:designationId", designationController.editDesignation); // Edit designation
router.post("/delete/:designationId", designationController.deleteDesignation); // Delete designation
router.get("/get", designationController.getDesignations); // Get designations

module.exports = router;
