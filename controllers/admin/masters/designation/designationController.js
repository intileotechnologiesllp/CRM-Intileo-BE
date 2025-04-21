const Joi = require("joi");
const { Op } = require("sequelize");
const Designation = require("../../../../models/admin/masters/designationModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
// Validation schema for designation
const designationSchema = Joi.object({
  designation_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "Designation description cannot be empty",
    "any.required": "Designation description is required",
  }),
});

// Add Designation
exports.createDesignation = async (req, res) => {
  const { designation_desc } = req.body;
  
  // Validate the request body
  const { error } = designationSchema.validate({ designation_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.DESIGNATION_MASTER, // Program ID for designation management
      "CREATE_DESIGNATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const designation = await Designation.create({
     
      designation_desc,
      createdBy: "admin",
      createdById: req.adminId,
      mode: "added"
    });

    res.status(201).json({
      message: "Designation created successfully",
      designation: {
        designationId: designation.designationId, // Include designationId in the response
        designation_desc: designation.designation_desc,
        createdBy: designation.createdBy,
        mode: designation.mode,
        createdAt: designation.createdAt,
        updatedAt: designation.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.DESIGNATION_MASTER, // Program ID for department management
      "CREATE_DESIGNATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error creating designation:", error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Designation
exports.editDesignation = async (req, res) => {
  const { designationId } = req.params; // Use designationId instead of id
  const { designation_desc } = req.body;

  // Validate the request body
  const { error } = designationSchema.validate({ designation_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.DESIGNATION_MASTER, // Program ID for designation management
      "EDIT_DESIGNATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const designation = await Designation.findByPk(designationId); // Find designation by designationId
    if (!designation) {
      await logAuditTrail(
        PROGRAMS.DESIGNATION_MASTER, // Program ID for designation management
        "EDIT_DESIGNATION", // Mode
         req.role, // Admin ID from the authenticated request
        "Designation not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Designation not found" });
    }

    await designation.update({
      designation_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({
      message: "Designation updated successfully",
      designation: {
        designationId: designation.designationId, // Include designationId in the response
        designation_desc: designation.designation_desc,
        mode: designation.mode,
        createdAt: designation.createdAt,
        updatedAt: designation.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.DESIGNATION_MASTER, // Program ID for department management
      "EDIT_DESIGNATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error updating designation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Designation
exports.deleteDesignation = async (req, res) => {
  const { designationId } = req.params; // Use designationId instead of id

  try {
    const designation = await Designation.findByPk(designationId); // Find designation by designationId
    if (!designation) {
      await logAuditTrail(
        PROGRAMS.DESIGNATION_MASTER, // Program ID for designation management
        "DELETE_DESIGNATION", // Mode
         req.role, // Admin ID from the authenticated request
        "Designation not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Designation not found" });
    }

    // Update mode to "deleted" before deleting
    await designation.update({ mode: "deleted" });

    await designation.destroy();

    res.status(200).json({
      message: "Designation deleted successfully",
      designationId, // Include designationId in the response
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.DESIGNATION_MASTER, // Program ID for department management
      "DELETE_DESIGNATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error deleting designation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort designations
exports.getDesignations = async (req, res) => {
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
    sortBy: Joi.string().valid("creationDate", "designation_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      PROGRAMS.DESIGNATION_MASTER, // Program ID for designation management
      "GET_DESIGNATIONS", // Mode
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
        designation_desc: {
          [Op.like]: `%${search}%`, // Search by designation_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const designations = await Designation.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: designations.count,
      pages: Math.ceil(designations.count / limit),
      currentPage: parseInt(page),
      designations: designations.rows.map((designation) => ({
        designationId: designation.designationId, // Include designationId in the response
        designation_desc: designation.designation_desc,
        mode: designation.mode,
        createdBy: designation.createdBy,
        createdAt: designation.createdAt,
        updatedAt: designation.updatedAt,
      })),
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.DESIGNATION_MASTER, // Program ID for designation management
      "GET_DESIGNATIONS", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error fetching designations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
