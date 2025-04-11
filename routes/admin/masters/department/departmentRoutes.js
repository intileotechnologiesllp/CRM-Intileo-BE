const express = require("express");
const departmentController = require("../../../../controllers/admin/masters/department/departmentController");

const router = express.Router();

router.post("/", departmentController.createDepartment); // Add department
router.put("/:id", departmentController.editDepartment); // Edit department
router.delete("/:id", departmentController.deleteDepartment); // Delete department
router.get("/", departmentController.getDepartments); // Get departments

module.exports = router;
