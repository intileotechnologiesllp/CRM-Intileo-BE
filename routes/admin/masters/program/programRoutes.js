const express = require("express");
const programController = require("../../../../controllers/admin/masters/program/programController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const router = express.Router();

router.post("/create", verifyToken,programController.createprogram); // Add program
router.post("/edit/:programId", verifyToken,programController.editprogram); // Edit program
router.post("/delete/:programId", verifyToken,programController.deleteprogram); // Delete program
router.get("/get",verifyToken, programController.getprograms); // Get programs

module.exports = router;
