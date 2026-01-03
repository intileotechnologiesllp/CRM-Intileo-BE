const express = require("express");
const leadColumnController = require("../../../../controllers/admin/masters/leadsColumn/leadsColumn");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const dbContextMiddleware = require("../../../../middlewares/dbContext");
const router = express.Router();


router.use(dbContextMiddleware);


router.post("/create",verifyToken,leadColumnController.createleadColumn); // Add designation
router.post("/edit/:leadColumnId",verifyToken,leadColumnController.editleadColumn); // Edit designation
router.post("/delete/:leadColumnId",verifyToken,leadColumnController.deleteleadColumn); // Delete designation
router.get("/get",verifyToken,leadColumnController.getleadColumns); // Get designations

module.exports = router;
