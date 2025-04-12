const Joi = require("joi");
const Department = require("../../../../models/admin/masters/departmentModel");
const { Op } = require("sequelize");

// Validation schema for department
const departmentSchema = Joi.object({
  department_desc: Joi.string().min(3).max(100).required(), // Must be a string between 3 and 100 characters
});

// Add Department
exports.createDepartment = async (req, res) => {
  const { department_desc } = req.body;

  // Validate the request body
  const { error } = departmentSchema.validate({ department_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const newDepartment = await Department.create({
      department_desc,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
    });

    res.status(201).json({
      message: "Department created successfully",
      department: newDepartment,
    });
  } catch (error) {
    console.error("Error creating Department:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Department
exports.editDepartment = async (req, res) => {
  const { id } = req.params;
  const { department_desc } = req.body;

  // Validate the request body
  const { error } = departmentSchema.validate({ department_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const department = await Department.findByPk(id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    await department.update({
      department_desc,
      mode: "modified", // Set mode to "modified"
    });

    res
      .status(200)
      .json({ message: "Department updated successfully", department });
  } catch (error) {
    console.error("Error updating Department:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Department
exports.deleteDepartment = async (req, res) => {
  const { id } = req.params;

  try {
    const department = await Department.findByPk(id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Update mode to "deleted" before deleting
    await department.update({ mode: "deleted" });

    await department.destroy();

    res.status(200).json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("Error deleting Department:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Departments
exports.getDepartments = async (req, res) => {
  const {
    search,
    createdBy,
    mode,
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;

  try {
    // Build the whereClause with filters
    const whereClause = {
      ...(search && {
        department_desc: {
          [Op.like]: `%${search}%`, // Search by department_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const departments = await Department.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: departments.count,
      pages: Math.ceil(departments.count / limit),
      currentPage: parseInt(page),
      departments: departments.rows,
    });
  } catch (error) {
    console.error("Error fetching Departments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
