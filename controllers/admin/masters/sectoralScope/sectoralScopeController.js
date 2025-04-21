const Joi = require("joi");
const { Op } = require("sequelize");
const Sectoralscope = require("../../../../models/admin/masters/sectoralScopeModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
// Validation schema for sectoralscope
const sectoralscopeSchema = Joi.object({
  sectoralscope_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "sectoralscope description cannot be empty",
    "any.required": "sectoralscope description is required",
  }),
});

// Add sectoralscope
exports.createsectoralscope = async (req, res) => {
  const { sectoralscope_desc } = req.body;

  // Validate the request body
  const { error } = sectoralscopeSchema.validate({ sectoralscope_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
      "CREATE_SECTORALSCOPE", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const sectoralscope = await Sectoralscope.create({
      sectoralscope_desc,
      createdBy: "admin",
      createdById: req.adminId,
      mode: "added"
    });

    res.status(201).json({
      message: "sectoralscope created successfully",
      sectoralscope: {
        sectoralscopeId: sectoralscope.sectoralscopeId, // Include sectoralscopeId in the response
        sectoralscope_desc: sectoralscope.sectoralscope_desc,
        createdBy: sectoralscope.createdBy,
        mode: sectoralscope.mode,
        createdAt: sectoralscope.createdAt,
        updatedAt: sectoralscope.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
      "CREATE_SECTORALSCOPE", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error creating sectoralscope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit sectoralscope
exports.editsectoralscope = async (req, res) => {
  const { sectoralscopeId } = req.params; // Use sectoralscopeId instead of id
  const { sectoralscope_desc } = req.body;

  // Validate the request body
  const { error } = sectoralscopeSchema.validate({ sectoralscope_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
      "EDIT_SECTORALSCOPE", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const sectoralscope = await Sectoralscope.findByPk(sectoralscopeId); // Find sectoralscope by sectoralscopeId
    if (!sectoralscope) {
      await logAuditTrail(
        PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
        "EDIT_SECTORALSCOPE", // Mode
         req.role, // Admin ID from the authenticated request
        "sectoralscope not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "sectoralscope not found" });
    }

    await sectoralscope.update({
      sectoralscope_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({
      message: "sectoralscope updated successfully",
      sectoralscope: {
        sectoralscopeId: sectoralscope.sectoralscopeId, // Include sectoralscopeId in the response
        sectoralscope_desc: sectoralscope.sectoralscope_desc,
        mode: sectoralscope.mode,
        createdAt: sectoralscope.createdAt,
        updatedAt: sectoralscope.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
      "EDIT_SECTORALSCOPE", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error updating sectoralscope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete sectoralscope
exports.deletesectoralscope = async (req, res) => {
  const { sectoralscopeId } = req.params; // Use sectoralscopeId instead of id

  try {
    const sectoralscope = await Sectoralscope.findByPk(sectoralscopeId); // Find sectoralscope by sectoralscopeId
    if (!sectoralscope) {
      await logAuditTrail(
        PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
        "DELETE_SECTORALSCOPE", // Mode
         req.role, // Admin ID from the authenticated request
        "sectoralscope not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "sectoralscope not found" });
    }

    // Update mode to "deleted" before deleting
    await sectoralscope.update({ mode: "deleted" });

    await sectoralscope.destroy();

    res.status(200).json({
      message: "sectoralscope deleted successfully",
      sectoralscopeId, // Include sectoralscopeId in the response
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
      "DELETE_SECTORALSCOPE", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error deleting sectoralscope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort sectoralscopes
exports.getsectoralscopes = async (req, res) => {
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
    sortBy: Joi.string().valid("creationDate", "sectoralscope_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
      "GET_SECTORALSCOPE", // Mode
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
        sectoralscope_desc: {
          [Op.like]: `%${search}%`, // Search by sectoralscope_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const sectoralscopes = await Sectoralscope.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: sectoralscopes.count,
      pages: Math.ceil(sectoralscopes.count / limit),
      currentPage: parseInt(page),
      sectoralscopes: sectoralscopes.rows.map((sectoralscope) => ({
        sectoralscopeId: sectoralscope.sectoralscopeId, // Include sectoralscopeId in the response
        sectoralscope_desc: sectoralscope.sectoralscope_desc,
        mode: sectoralscope.mode,
        createdBy: sectoralscope.createdBy,
        createdAt: sectoralscope.createdAt,
        updatedAt: sectoralscope.updatedAt,
      })),
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.SECTORAL_SCOPE_MASTER, // Program ID for sectoralscope management
      "GET_SECTORALSCOPE", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error fetching sectoralscopes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
