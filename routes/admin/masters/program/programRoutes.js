const express = require("express");
const programController = require("../../../../controllers/admin/masters/program/programController");

const router = express.Router();

router.post("/create", programController.createProgram); // Add program
router.put("/edit/:id", programController.editProgram); // Edit program
router.delete("/delete/:id", programController.deleteProgram); // Delete program
router.get("/get", programController.getPrograms); // Get programs

module.exports = router;
