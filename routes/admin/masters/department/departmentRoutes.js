const express = require("express");
const departmentController = require("../../../../controllers/admin/masters/department/departmentController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create", verifyToken, validatePrivilege(8, "create"), departmentController.createdepartment); // Add department
router.post("/edit/:departmentId",verifyToken, validatePrivilege(8, "create"), departmentController.editdepartment); // Edit department
router.post("/delete/:departmentId", verifyToken, validatePrivilege(8, "create"), departmentController.deletedepartment); // Delete department
router.get("/get", verifyToken, validatePrivilege(8, "create"), departmentController.getdepartments); // Get departments

module.exports = router;
