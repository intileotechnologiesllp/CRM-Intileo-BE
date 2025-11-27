const Joi = require("joi");
const { Op } = require("sequelize");
const Label = require("../../../../models/admin/masters/labelModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
const historyLogger = require("../../../../utils/historyLogger").logHistory; // Import history logger

// Validation schemas for labels
const labelSchema = Joi.object({
  labelName: Joi.string().min(2).max(100).required().messages({
    "string.empty": "Label name cannot be empty",
    "any.required": "Label name is required",
  }),
  labelColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional().messages({
    "string.pattern.base": "Label color must be a valid hex color code (e.g., #FF0000)",
  }),
  entityType: Joi.string().valid('lead', 'deal', 'person', 'organization', 'all').optional().messages({
    "any.only": "Entity type must be one of: lead, deal, person, organization, all",
  }),
  description: Joi.string().max(500).optional().allow(''),
  isActive: Joi.boolean().optional(),
});

const labelUpdateSchema = Joi.object({
  labelName: Joi.string().min(2).max(100).optional(),
  labelColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  entityType: Joi.string().valid('lead', 'deal', 'person', 'organization', 'all').optional(),
  description: Joi.string().max(500).optional().allow(''),
  isActive: Joi.boolean().optional(),
});

// Create label
exports.createLabel = async (req, res) => {
  const { labelName, labelColor, entityType, description, isActive } = req.body;

  // Validate the request body
  const { error } = labelSchema.validate(req.body);
  if (error) {
    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "CREATE_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    // Check if label name already exists for the same entity type
    const existingLabel = await Label.findOne({
      where: {
        labelName,
        entityType: entityType || 'all',
        isActive: true
      }
    });

    if (existingLabel) {
      return res.status(409).json({ 
        message: `Label "${labelName}" already exists for ${entityType || 'all'} entity type` 
      });
    }

    const label = await Label.create({
      labelName,
      labelColor: labelColor || '#007bff',
      entityType: entityType || 'all',
      description,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.role,
      createdById: req.adminId,
      mode: "added"
    });

    await historyLogger(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "CREATE_LABEL", // Mode
      label.createdById, // Created by (Admin ID)
      label.labelId, // Record ID (Label ID)
      null,
      `Label "${labelName}" created by "${req.role}"`, // Description
      { labelName, labelColor, entityType, description, isActive } // Changes logged as JSON
    );

    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "CREATE_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      `Label "${labelName}" created successfully`, // Success description
      req.adminId
    );

    res.status(201).json({
      message: "Label created successfully",
      label: {
        labelId: label.labelId,
        labelName: label.labelName,
        labelColor: label.labelColor,
        entityType: label.entityType,
        description: label.description,
        isActive: label.isActive,
        creationDate: label.creationDate,
      },
    });
  } catch (error) {
    console.error("Error creating label:", error);
    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "CREATE_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      "Error creating label: " + error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit label
exports.editLabel = async (req, res) => {
  const { labelId } = req.params;
  const { labelName, labelColor, entityType, description, isActive } = req.body;

  // Validate the request body
  const { error } = labelUpdateSchema.validate(req.body);
  if (error) {
    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "EDIT_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const label = await Label.findByPk(labelId);
    if (!label) {
      return res.status(404).json({ message: "Label not found" });
    }

    // Store original values for history logging
    const originalValues = {
      labelName: label.labelName,
      labelColor: label.labelColor,
      entityType: label.entityType,
      description: label.description,
      isActive: label.isActive,
    };

    // Check if label name already exists for the same entity type (excluding current label)
    if (labelName && labelName !== label.labelName) {
      const existingLabel = await Label.findOne({
        where: {
          labelName,
          entityType: entityType || label.entityType,
          isActive: true,
          labelId: { [Op.ne]: labelId }
        }
      });

      if (existingLabel) {
        return res.status(409).json({ 
          message: `Label "${labelName}" already exists for ${entityType || label.entityType} entity type` 
        });
      }
    }

    // Update label
    await label.update({
      labelName: labelName || label.labelName,
      labelColor: labelColor || label.labelColor,
      entityType: entityType || label.entityType,
      description: description !== undefined ? description : label.description,
      isActive: isActive !== undefined ? isActive : label.isActive,
      updatedBy: req.role,
      updatedById: req.adminId,
      updatedDate: new Date(),
      mode: "updated"
    });

    const updatedValues = {
      labelName: label.labelName,
      labelColor: label.labelColor,
      entityType: label.entityType,
      description: label.description,
      isActive: label.isActive,
    };

    await historyLogger(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "EDIT_LABEL", // Mode
      req.adminId, // Updated by (Admin ID)
      label.labelId, // Record ID (Label ID)
      null,
      `Label "${originalValues.labelName}" updated by "${req.role}"`, // Description
      { from: originalValues, to: updatedValues } // Changes logged as JSON
    );

    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "EDIT_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      `Label "${label.labelName}" updated successfully`, // Success description
      req.adminId
    );

    res.status(200).json({
      message: "Label updated successfully",
      label: {
        labelId: label.labelId,
        labelName: label.labelName,
        labelColor: label.labelColor,
        entityType: label.entityType,
        description: label.description,
        isActive: label.isActive,
        updatedDate: label.updatedDate,
      },
    });
  } catch (error) {
    console.error("Error updating label:", error);
    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "EDIT_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      "Error updating label: " + error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete label (soft delete)
exports.deleteLabel = async (req, res) => {
  const { labelId } = req.params;

  try {
    const label = await Label.findByPk(labelId);
    if (!label) {
      return res.status(404).json({ message: "Label not found" });
    }

    const originalValues = {
      labelName: label.labelName,
      isActive: label.isActive,
    };

    // Soft delete by setting isActive to false
    await label.update({
      isActive: false,
      updatedBy: req.role,
      updatedById: req.adminId,
      updatedDate: new Date(),
      mode: "deleted"
    });

    await historyLogger(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "DELETE_LABEL", // Mode
      req.adminId, // Deleted by (Admin ID)
      label.labelId, // Record ID (Label ID)
      null,
      `Label "${originalValues.labelName}" deleted by "${req.role}"`, // Description
      { from: originalValues, to: { isActive: false } } // Changes logged as JSON
    );

    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "DELETE_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      `Label "${label.labelName}" deleted successfully`, // Success description
      req.adminId
    );

    res.status(200).json({
      message: "Label deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting label:", error);
    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "DELETE_LABEL", // Mode
      req.role, // Admin role from the authenticated request
      "Error deleting label: " + error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all labels
exports.getLabels = async (req, res) => {
  try {
    const { entityType, isActive, page = 1, limit = 100, search } = req.query;

    // Build where clause
    let whereClause = {};
    
    if (entityType && entityType !== 'all') {
      whereClause.entityType = { [Op.in]: [entityType, 'all'] };
    }
    
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    } else {
      whereClause.isActive = true; // Default to active labels only
    }
    
    if (search) {
      whereClause.labelName = { [Op.iLike]: `%${search}%` };
    }

    // Pagination
    const offset = (page - 1) * limit;

    const { count, rows: labels } = await Label.findAndCountAll({
      where: whereClause,
      order: [['labelName', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        'labelId',
        'labelName',
        'labelColor',
        'entityType',
        'description',
        'isActive',
        'createdBy',
        'creationDate',
        'updatedBy',
        'updatedDate'
      ]
    });

    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "GET_LABELS", // Mode
      req.role, // Admin role from the authenticated request
      `Retrieved ${labels.length} labels`, // Success description
      req.adminId
    );

    res.status(200).json({
      message: "Labels retrieved successfully",
      labels,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalLabels: count,
        labelsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error retrieving labels:", error);
    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "GET_LABELS", // Mode
      req.role, // Admin role from the authenticated request
      "Error retrieving labels: " + error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get label by ID
exports.getLabelById = async (req, res) => {
  const { labelId } = req.params;

  try {
    const label = await Label.findByPk(labelId);
    if (!label) {
      return res.status(404).json({ message: "Label not found" });
    }

    res.status(200).json({
      message: "Label retrieved successfully",
      label: {
        labelId: label.labelId,
        labelName: label.labelName,
        labelColor: label.labelColor,
        entityType: label.entityType,
        description: label.description,
        isActive: label.isActive,
        createdBy: label.createdBy,
        creationDate: label.creationDate,
        updatedBy: label.updatedBy,
        updatedDate: label.updatedDate,
      },
    });
  } catch (error) {
    console.error("Error retrieving label:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Bulk update labels
exports.bulkUpdateLabels = async (req, res) => {
  const { labelIds, updates } = req.body;

  if (!labelIds || !Array.isArray(labelIds) || labelIds.length === 0) {
    return res.status(400).json({ message: "labelIds array is required" });
  }

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ message: "updates object is required" });
  }

  // Validate updates
  const { error } = labelUpdateSchema.validate(updates);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const labels = await Label.findAll({
      where: { labelId: { [Op.in]: labelIds } }
    });

    if (labels.length === 0) {
      return res.status(404).json({ message: "No labels found with provided IDs" });
    }

    // Update all labels
    const updateData = {
      ...updates,
      updatedBy: req.role,
      updatedById: req.adminId,
      updatedDate: new Date(),
      mode: "bulk_updated"
    };

    const [updatedCount] = await Label.update(updateData, {
      where: { labelId: { [Op.in]: labelIds } }
    });

    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "BULK_UPDATE_LABELS", // Mode
      req.role, // Admin role from the authenticated request
      `Bulk updated ${updatedCount} labels`, // Success description
      req.adminId
    );

    res.status(200).json({
      message: `Successfully updated ${updatedCount} labels`,
      updatedCount
    });
  } catch (error) {
    console.error("Error bulk updating labels:", error);
    await logAuditTrail(
      PROGRAMS.LABEL_MASTER, // Program ID for label management
      "BULK_UPDATE_LABELS", // Mode
      req.role, // Admin role from the authenticated request
      "Error bulk updating labels: " + error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};