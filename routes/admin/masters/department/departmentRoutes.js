const express = require("express");
const departmentController = require("../../../../controllers/admin/masters/department/departmentController");

const router = express.Router();

router.post("/create", departmentController.createDepartment); // Add department
router.put("/edit/:id", departmentController.editDepartment); // Edit department
router.delete("/delete/:id", departmentController.deleteDepartment); // Delete department
router.get("/get", departmentController.getDepartments); // Get departments

module.exports = router;
