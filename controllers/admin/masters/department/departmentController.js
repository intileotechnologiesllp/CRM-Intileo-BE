const Joi = require("joi");
const { Op } = require("sequelize");
const Department = require("../../../../models/admin/masters/departmentModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
// Validation schema for department
const departmentSchema = Joi.object({
  department_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "department description cannot be empty",
    "any.required": "department description is required",
  }),
});

// Add department
exports.createdepartment = async (req, res) => {
  const { department_desc } = req.body;

  // Validate the request body
  const { error } = departmentSchema.validate({ department_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.DEPARTMENT_MASTER, // Program ID for department management
      "CREATE_DEPARTMENT", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const department = await Department.create({
      department_desc,
      createdBy: "admin",
      createdById: req.adminId,
      mode: "added",
    });

    res.status(201).json({
      message: "department created successfully",
      department: {
        departmentId: department.departmentId, // Include departmentId in the response
        department_desc: department.department_desc,
        createdBy: department.createdBy,
        mode: department.mode,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating department:", error);
    await logAuditTrail(
      PROGRAMS.DEPARTMENT_MASTER, // Program ID for department management
      "CREATE_DEPARTMENT", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit department
exports.editdepartment = async (req, res) => {
  const { departmentId } = req.params; // Use departmentId instead of id
  const { department_desc } = req.body;

  // Validate the request body
  const { error } = departmentSchema.validate({ department_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.DEPARTMENT_MASTER, // Program ID for department management
      "EDIT_DEPARTMENT", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const department = await Department.findByPk(departmentId); // Find department by departmentId
    if (!department) {
      await logAuditTrail(
        PROGRAMS.DEPARTMENT_MASTER, // Program ID for department management
        "EDIT_DEPARTMENT", // Mode
         req.role, // Admin ID from the authenticated request
        "department not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "department not found" });
    }

    await department.update({
      department_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({
      message: "department updated successfully",
      department: {
        departmentId: department.departmentId, // Include departmentId in the response
        department_desc: department.department_desc,
        mode: department.mode,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating department:", error);
    await logAuditTrail(
      PROGRAMS.DEPARTMENT_MASTER, // Program ID for country management
      "EDIT_DEPARTMENT", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete department
exports.deletedepartment = async (req, res) => {
  const { departmentId } = req.params; // Use departmentId instead of id

  try {
    const department = await Department.findByPk(departmentId); // Find department by departmentId
    if (!department) {
      await logAuditTrail(
        PROGRAMS.DEPARTMENT_MASTER, // Program ID for department management
        "DELETE_DEPARTMENT", // Mode
         req.role, // Admin ID from the authenticated request
        "department not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "department not found" });
    }

    // Update mode to "deleted" before deleting
    await department.update({ mode: "deleted" });

    await department.destroy();

    res.status(200).json({
      message: "department deleted successfully",
      departmentId, // Include departmentId in the response
    });
  } catch (error) {
  
    console.error("Error deleting department:", error);
    await logAuditTrail(
      PROGRAMS.DEPARTMENT_MASTER, // Program ID for country management
      "DELETE_DEPARTMENT", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort departments
exports.getdepartments = async (req, res) => {
  const {
    search,
    createdBy,
    mode,
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;

  // Validate query parameters using Joi
  const querySchema = Joi.object({
    search: Joi.string().optional(),
    createdBy: Joi.string().optional(),
    mode: Joi.string().valid("added", "modified", "deleted").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    sortBy: Joi.string().valid("creationDate", "department_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      PROGRAMS.DEPARTMENT_MASTER, // Program ID for department management
      "GET_DEPARTMENTS", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );

    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

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
      departments: departments.rows.map((department) => ({
        departmentId: department.departmentId, // Include departmentId in the response
        department_desc: department.department_desc,
        mode: department.mode,
        createdBy: department.createdBy,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      })),
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.DEPARTMENT_MASTER, // Program ID for department management
      "GET_DEPARTMENTS", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
