const express = require("express");
const programController = require("../../../../controllers/admin/masters/program/programController");

const router = express.Router();

router.post("/create", programController.createprogram); // Add program
router.post("/edit/:programId", programController.editprogram); // Edit program
router.post("/delete/:programId", programController.deleteprogram); // Delete program
router.get("/get", programController.getprograms); // Get programs

module.exports = router;
