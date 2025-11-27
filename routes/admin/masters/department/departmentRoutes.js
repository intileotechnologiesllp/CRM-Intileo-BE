const express = require("express");
const departmentController = require("../../../../controllers/admin/masters/department/departmentController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create", verifyToken,departmentController.createdepartment); // Add department
router.post("/edit/:departmentId",verifyToken, departmentController.editdepartment); // Edit department
router.post("/delete/:departmentId", verifyToken, departmentController.deletedepartment); // Delete department
router.get("/get", verifyToken, departmentController.getdepartments); // Get departments

module.exports = router;
