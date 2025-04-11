const express = require("express");
//const statusController = require("../../../controllers/admin/masters/status/statusController");
const statusController = require("../../../../controllers/admin/masters/status/statusController"); // Adjust the path as necessary
const router = express.Router();

router.post("/", statusController.createStatus); // Add status
router.put("/:id", statusController.editStatus); // Edit status
router.delete("/:id", statusController.deleteStatus); // Delete status
router.get("/", statusController.getStatuses); // Get statuses

module.exports = router;
