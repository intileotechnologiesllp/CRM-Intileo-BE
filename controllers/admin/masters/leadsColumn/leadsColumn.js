const Joi = require("joi");
const { Op } = require("sequelize");
const leadColumn = require("../../../../models/admin/masters/leadColumnsModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
const historyLogger = require("../../../../utils/historyLogger").logHistory; // Import history logger
// Validation schema for leadColumn
const leadColumnSchema = Joi.object({
  leadColumn_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "leadColumn description cannot be empty",
    "any.required": "leadColumn description is required",
  }),
});

// Add leadColumn
exports.createleadColumn = async (req, res) => {
  const { History, AuditTrail, LeadColumn } = req.models;
  const { leadColumn_desc } = req.body;
  
  // Validate the request body
  const { error } = leadColumnSchema.validate({ leadColumn_desc });
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for leadColumn management
      "CREATE_leadColumn", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const leadColumn = await LeadColumn.create({
     
      leadColumn_desc,
      createdBy: "admin",
      createdById: req.adminId,
      mode: "added"
    });
    await historyLogger(
      History,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for department management
      "CREATE_leadColumn", // Mode
      leadColumn.createdById, // Created by (Admin ID)
      leadColumn.leadColumnId, // Record ID (Department ID) 
      null,
      `leadColumn "${leadColumn_desc}" created by "${req.role}"`, // Description
      { leadColumn_desc } // Changes logged as JSON
      );
    res.status(201).json({
      message: "leadColumn created successfully",
      leadColumn: {
        leadColumnId: leadColumn.leadColumnId, // Include leadColumnId in the response
        leadColumn_desc: leadColumn.leadColumn_desc,
        createdBy: leadColumn.createdBy,
        mode: leadColumn.mode,
        createdAt: leadColumn.createdAt,
        updatedAt: leadColumn.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for department management
      "CREATE_leadColumn", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error creating leadColumn:", error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit leadColumn
exports.editleadColumn = async (req, res) => {
  const { History, AuditTrail, LeadColumn } = req.models;
  const { leadColumnId } = req.params; // Use leadColumnId instead of id
  const { leadColumn_desc } = req.body;

  // Validate the request body
  const { error } = leadColumnSchema.validate({ leadColumn_desc });
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for leadColumn management
      "EDIT_leadColumn", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const leadColumn = await LeadColumn.findByPk(leadColumnId); // Find leadColumn by leadColumnId
    if (!leadColumn) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for leadColumn management
        "EDIT_leadColumn", // Mode
         req.role, // Admin ID from the authenticated request
        "leadColumn not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "leadColumn not found" });
    }
    const originalData = {
      leadColumn_desc: leadColumn.leadColumn_desc,
    }
    await leadColumn.update({
      leadColumn_desc,
      mode: "modified", // Set mode to "modified"
    });

    const updatedData = {
      leadColumn_desc,
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
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for currency management
      "EDIT_leadColumn", // Mode
      leadColumn.createdById, // Admin ID from the authenticated request
      leadColumnId, // Record ID (Currency ID)
      req.adminId,
      `leadColumn "${leadColumn_desc}" updated by "${req.role}"`, // Description
      changes // Changes logged as JSON
    );
    res.status(200).json({
      message: "leadColumn updated successfully",
      leadColumn: {
        leadColumnId: leadColumn.leadColumnId, // Include leadColumnId in the response
        leadColumn_desc: leadColumn.leadColumn_desc,
        mode: leadColumn.mode,
        createdAt: leadColumn.createdAt,
        updatedAt: leadColumn.updatedAt,
      },
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for department management
      "EDIT_leadColumn", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error updating leadColumn:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete leadColumn
exports.deleteleadColumn = async (req, res) => {
  const { leadColumnId } = req.params; // Use leadColumnId instead of id
  const { History, AuditTrail, LeadColumn } = req.models;

  try {
    const leadColumn = await LeadColumn.findByPk(leadColumnId); // Find leadColumn by leadColumnId
    if (!leadColumn) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for leadColumn management
        "DELETE_leadColumn", // Mode
         req.role, // Admin ID from the authenticated request
        "leadColumn not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "leadColumn not found" });
    }

    // Update mode to "deleted" before deleting
    await leadColumn.update({ mode: "deleted" });

    await leadColumn.destroy();
    await historyLogger(
      History,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for currency management
      "DELETE_leadColumn", // Mode
      leadColumn.createdById, // Admin ID from the authenticated request
      leadColumnId, // Record ID (Currency ID)
      req.adminId,
      `leadColumn "${leadColumn.leadColumn_desc}" deleted by "${req.role}"`, // Description
      null // No changes to log for deletion
    );
    res.status(200).json({
      message: "leadColumn deleted successfully",
      leadColumnId, // Include leadColumnId in the response
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for department management
      "DELETE_leadColumn", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error deleting leadColumn:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort leadColumns
exports.getleadColumns = async (req, res) => {
  const { AuditTrail, LeadColumn } = req.models;
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
    sortBy: Joi.string().valid("creationDate", "leadColumn_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for leadColumn management
      "GET_leadColumnS", // Mode
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
        leadColumn_desc: {
          [Op.like]: `%${search}%`, // Search by leadColumn_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const leadColumns = await LeadColumn.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: leadColumns.count,
      pages: Math.ceil(leadColumns.count / limit),
      currentPage: parseInt(page),
      leadColumns: leadColumns.rows.map((leadColumn) => ({
        leadColumnId: leadColumn.leadColumnId, // Include leadColumnId in the response
        leadColumn_desc: leadColumn.leadColumn_desc,
        mode: leadColumn.mode,
        createdBy: leadColumn.createdBy,
        createdAt: leadColumn.createdAt,
        updatedAt: leadColumn.updatedAt,
      })),
    });
  } catch (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_COLUMN_MASTER, // Program ID for leadColumn management
      "GET_leadColumnS", // Mode
       req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    console.error("Error fetching leadColumns:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
