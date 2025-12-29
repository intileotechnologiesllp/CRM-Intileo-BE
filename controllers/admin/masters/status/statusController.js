const Joi = require("joi");
const { Op } = require("sequelize");
const Status = require("../../../../models/admin/masters/statusModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
const historyLogger = require("../../../../utils/historyLogger").logHistory; // Import history logger
// Validation schema for status
const statusSchema = Joi.object({
  status_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "status description cannot be empty",
    "any.required": "status description is required",
  }),
});

// Add status
exports.createstatus = async (req, res) => {
  const { History, AuditTrail, Status } = req.models;
  const { status_desc } = req.body;

  // Validate the request body
  const { error } = statusSchema.validate({ status_desc });
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.STATUS_MASTER, // Program ID for status management
      "CREATE_STATUS", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const status = await Status.create({
      status_desc,
      createdBy: "admin",
      createdById: req.adminId,
      mode: "added"
    });
    await historyLogger(
      History,
      PROGRAMS.STATUS_MASTER, // Program ID for currency management
      "CREATE_STATUS", // Mode
      status.createdById, // Created by (Admin ID)
      status.statusId, // Record ID (Country ID)
      null,
      `Status "${status_desc}" created by "${req.role}"`, // Description
      { status_desc } // Changes logged as JSON
      );
    res.status(201).json({
      message: "status created successfully",
      status: {
        statusId: status.statusId, // Include statusId in the response
        status_desc: status.status_desc,
        createdBy: status.createdBy,
        mode: status.mode,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.STATUS_MASTER, // Program ID for status management
      "CREATE_STATUS", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error creating status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit status
exports.editstatus = async (req, res) => {
  const { History, AuditTrail, Status } = req.models;
  const { statusId } = req.params; // Use statusId instead of id
  const { status_desc } = req.body;

  // Validate the request body
  const { error } = statusSchema.validate({ status_desc });
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.STATUS_MASTER, // Program ID for status management
      "EDIT_STATUS", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const status = await Status.findByPk(statusId); // Find status by statusId
    if (!status) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.STATUS_MASTER, // Program ID for status management
        "EDIT_STATUS", // Mode
         req.role, // Admin ID from the authenticated request
        "status not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "status not found" });
    }
    const originalData = {
      status_desc: status.status_desc,
    }

    await status.update({
      status_desc,
      mode: "modified", // Set mode to "modified"
    });
    const updatedData = {
      status_desc,
    };
    // Calculate the changes 
    const changes = {};
    for (const key in updatedData) {
      if (originalData[key] !== updatedData[key]) {
        changes[key] = { from: originalData[key], to: updatedData[key] };
      }
    }
    await historyLogger(
      History,
      PROGRAMS.STATUS_MASTER, // Program ID for currency management
      "EDIT_STATUS", // Mode
      status.createdById, // Admin ID from the authenticated request
      statusId, // Record ID (Currency ID)
      req.adminId,
      `Status "${status_desc}" updated by "${req.role}"`, // Description
      changes // Changes logged as JSON
    );
    res.status(200).json({
      message: "status updated successfully",
      status: {
        statusId: status.statusId, // Include statusId in the response
        status_desc: status.status_desc,
        mode: status.mode,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.STATUS_MASTER, // Program ID for status management
      "EDIT_STATUS", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error updating status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete status
exports.deletestatus = async (req, res) => {
  const { statusId } = req.params; // Use statusId instead of id
  const { History, AuditTrail, Status } = req.models;
  try {
    const status = await Status.findByPk(statusId); // Find status by statusId
    if (!status) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.STATUS_MASTER, // Program ID for status management
        "DELETE_STATUS", // Mode
         req.role, // Admin ID from the authenticated request
        "status not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "status not found" });
    }

    // Update mode to "deleted" before deleting
    await status.update({ mode: "deleted" });

    await status.destroy();
    await historyLogger(
      History,
      PROGRAMS.STATUS_MASTER, // Program ID for currency management
      "DELETE_STATUS", // Mode
      status.createdById, // Admin ID from the authenticated request
      statusId, // Record ID (Currency ID)
      req.adminId,
      `Status "${status.status_desc}" deleted by "${req.role}"`, // Description
      null // No changes to log for deletion
    );
    res.status(200).json({
      message: "status deleted successfully",
      statusId, // Include statusId in the response
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.STATUS_MASTER, // Program ID for status management
      "DELETE_STATUS", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error deleting status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort statuss
exports.getstatuss = async (req, res) => {
  const {
    search,
    createdBy,
    mode,
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;
  const { History, AuditTrail, Status } = req.models;
  // Validate query parameters using Joi
  const querySchema = Joi.object({
    search: Joi.string().optional(),
    createdBy: Joi.string().optional(),
    mode: Joi.string().valid("added", "modified", "deleted").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    sortBy: Joi.string().valid("creationDate", "status_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.STATUS_MASTER, // Program ID for status management
      "GET_STATUS", // Mode
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
        status_desc: {
          [Op.like]: `%${search}%`, // Search by status_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const statuss = await Status.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: statuss.count,
      pages: Math.ceil(statuss.count / limit),
      currentPage: parseInt(page),
      statuss: statuss.rows.map((status) => ({
        statusId: status.statusId, // Include statusId in the response
        status_desc: status.status_desc,
        mode: status.mode,
        createdBy: status.createdBy,
        createdAt: status.createdAt,
        updatedAt: status.updatedAt,
      })),
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.STATUS_MASTER, // Program ID for status management
      "GET_STATUS", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error fetching statuss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
