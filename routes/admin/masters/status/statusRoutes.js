const express = require("express");
const statusController = require("../../../../controllers/admin/masters/status/statusController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create", verifyToken, validatePrivilege(9, "create"), statusController.createstatus); // Add status
router.post("/edit/:statusId", verifyToken, validatePrivilege(9, "create"), statusController.editstatus); // Edit status
router.post("/delete/:statusId", verifyToken, validatePrivilege(9, "create"), statusController.deletestatus); // Delete status
router.get("/get", verifyToken, validatePrivilege(9, "create"), statusController.getstatuss); // Get statuss

module.exports = router;
