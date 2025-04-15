const express = require("express");
const statusController = require("../../../../controllers/admin/masters/status/statusController");

const router = express.Router();

router.post("/create", statusController.createstatus); // Add status
router.post("/edit/:statusId", statusController.editstatus); // Edit status
router.post("/delete/:statusId", statusController.deletestatus); // Delete status
router.get("/get", statusController.getstatuss); // Get statuss

module.exports = router;
