const express = require("express");
//const statusController = require("../../../controllers/admin/masters/status/statusController");
const statusController = require("../../../../controllers/admin/masters/status/statusController"); // Adjust the path as necessary
const router = express.Router();

router.post("/create", statusController.createStatus); // Add status
router.put("/edit/:id", statusController.editStatus); // Edit status
router.delete("/delete/:id", statusController.deleteStatus); // Delete status
router.get("/get", statusController.getStatuses); // Get statuses

module.exports = router;
