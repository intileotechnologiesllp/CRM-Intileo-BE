const express = require("express");
const programController = require("../../../../controllers/admin/masters/program/programController");

const router = express.Router();

router.post("/", programController.createProgram); // Add program
router.put("/:id", programController.editProgram); // Edit program
router.delete("/:id", programController.deleteProgram); // Delete program
router.get("/", programController.getPrograms); // Get programs

module.exports = router;
