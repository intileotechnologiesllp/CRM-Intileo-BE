const express = require("express");
const designationController = require("../../../../controllers/admin/masters/designation/designationController"); // Import the controller

const router = express.Router();

router.post("/", designationController.createDesignation); // Add designation
router.put("/:id", designationController.editDesignation); // Edit designation
router.delete("/:id", designationController.deleteDesignation); // Delete designation
router.get("/", designationController.getDesignations); // Get designations (with search, pagination, and sorting)

module.exports = router;
