const Joi = require("joi");
const { Op } = require("sequelize");
const Organization = require("../../../../models/admin/masters/organizationModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
// Validation schema for organization
const organizationSchema = Joi.object({
  organization_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "organization description cannot be empty",
    "any.required": "organization description is required",
  }),
});

// Add organization
exports.createorganization = async (req, res) => {
  const { organization_desc } = req.body;

  // Validate the request body
  const { error } = organizationSchema.validate({ organization_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
      "CREATE_ORGANIZATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );

    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const organization = await Organization.create({
      organization_desc,
      createdBy: "admin",
      mode: "added"
    });

    res.status(201).json({
      message: "organization created successfully",
      organization: {
        organizationId: organization.organizationId, // Include organizationId in the response
        organization_desc: organization.organization_desc,
        createdBy: organization.createdBy,
        mode: organization.mode,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.ORGANIZATION_MASTER, // Program ID for designation management
      "CREATE_ORGANIZATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error creating organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit organization
exports.editorganization = async (req, res) => {
  const { organizationId } = req.params; // Use organizationId instead of id
  const { organization_desc } = req.body;

  // Validate the request body
  const { error } = organizationSchema.validate({ organization_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
      "EDIT_ORGANIZATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const organization = await Organization.findByPk(organizationId); // Find organization by organizationId
    if (!organization) {
      await logAuditTrail(
        PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
        "EDIT_ORGANIZATION", // Mode
         req.role, // Admin ID from the authenticated request
        "organization not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "organization not found" });
    }

    await organization.update({
      organization_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({
      message: "organization updated successfully",
      organization: {
        organizationId: organization.organizationId, // Include organizationId in the response
        organization_desc: organization.organization_desc,
        mode: organization.mode,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
      "EDIT_ORGANIZATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error updating organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete organization
exports.deleteorganization = async (req, res) => {
  const { organizationId } = req.params; // Use organizationId instead of id

  try {
    const organization = await Organization.findByPk(organizationId); // Find organization by organizationId
    if (!organization) {
      await logAuditTrail(
        PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
        "DELETE_ORGANIZATION", // Mode
         req.role, // Admin ID from the authenticated request
        "organization not found", // Error description
        req.adminId
      );

      return res.status(404).json({ message: "organization not found" });
    }

    // Update mode to "deleted" before deleting
    await organization.update({ mode: "deleted" });

    await organization.destroy();

    res.status(200).json({
      message: "organization deleted successfully",
      organizationId, // Include organizationId in the response
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
      "DELETE_ORGANIZATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error deleting organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort organizations
exports.getorganizations = async (req, res) => {
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
    sortBy: Joi.string().valid("creationDate", "organization_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
      "GET_ORGANIZATIONS", // Mode
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
        organization_desc: {
          [Op.like]: `%${search}%`, // Search by organization_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const organizations = await Organization.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: organizations.count,
      pages: Math.ceil(organizations.count / limit),
      currentPage: parseInt(page),
      organizations: organizations.rows.map((organization) => ({
        organizationId: organization.organizationId, // Include organizationId in the response
        organization_desc: organization.organization_desc,
        mode: organization.mode,
        createdBy: organization.createdBy,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      })),
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.ORGANIZATION_MASTER, // Program ID for organization management
      "GET_ORGANIZATION", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error fetching organizations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
