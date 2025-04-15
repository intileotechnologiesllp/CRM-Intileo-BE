const express = require("express");
const departmentController = require("../../../../controllers/admin/masters/department/departmentController");

const router = express.Router();

router.post("/create", departmentController.createdepartment); // Add department
router.post("/edit/:departmentId", departmentController.editdepartment); // Edit department
router.post("/delete/:departmentId", departmentController.deletedepartment); // Delete department
router.get("/get", departmentController.getdepartments); // Get departments

module.exports = router;
