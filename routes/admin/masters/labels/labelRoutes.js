const express = require("express");
const labelController = require("../../../../controllers/admin/masters/labels/labelController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

// CRUD routes for labels
router.post("/create", verifyToken,labelController.createLabel); // Create label
router.post("/edit/:labelId", verifyToken,labelController.editLabel); // Edit label
router.post("/delete/:labelId", verifyToken, labelController.deleteLabel); // Delete label (soft delete)
router.get("/get", verifyToken, labelController.getLabels); // Get all labels
router.get("/get/:labelId", verifyToken, labelController.getLabelById); // Get label by ID

// Bulk operations
router.post("/bulk-update", verifyToken, labelController.bulkUpdateLabels); // Bulk update labels

module.exports = router;