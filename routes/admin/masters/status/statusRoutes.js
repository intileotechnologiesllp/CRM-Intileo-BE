const express = require("express");
const statusController = require("../../../../controllers/admin/masters/status/statusController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create", verifyToken,statusController.createstatus); // Add status
router.post("/edit/:statusId", verifyToken, statusController.editstatus); // Edit status
router.post("/delete/:statusId", verifyToken, statusController.deletestatus); // Delete status
router.get("/get", verifyToken, statusController.getstatuss); // Get statuss

module.exports = router;
