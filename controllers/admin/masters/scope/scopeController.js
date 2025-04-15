const Joi = require("joi");
const { Op } = require("sequelize");
const Scope = require("../../../../models/admin/masters/scopeModel");

// Validation schema for scope
const scopeSchema = Joi.object({
  scope_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "scope description cannot be empty",
    "any.required": "scope description is required",
  }),
});

// Add scope
exports.createscope = async (req, res) => {
  const { scope_desc } = req.body;

  // Validate the request body
  const { error } = scopeSchema.validate({ scope_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const scope = await Scope.create({
      scope_desc,
      createdBy: "admin",
      mode: "added"
    });

    res.status(201).json({
      message: "scope created successfully",
      scope: {
        scopeId: scope.scopeId, // Include scopeId in the response
        scope_desc: scope.scope_desc,
        createdBy: scope.createdBy,
        mode: scope.mode,
        createdAt: scope.createdAt,
        updatedAt: scope.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit scope
exports.editscope = async (req, res) => {
  const { scopeId } = req.params; // Use scopeId instead of id
  const { scope_desc } = req.body;

  // Validate the request body
  const { error } = scopeSchema.validate({ scope_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const scope = await Scope.findByPk(scopeId); // Find scope by scopeId
    if (!scope) {
      return res.status(404).json({ message: "scope not found" });
    }

    await scope.update({
      scope_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({
      message: "scope updated successfully",
      scope: {
        scopeId: scope.scopeId, // Include scopeId in the response
        scope_desc: scope.scope_desc,
        mode: scope.mode,
        createdAt: scope.createdAt,
        updatedAt: scope.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete scope
exports.deletescope = async (req, res) => {
  const { scopeId } = req.params; // Use scopeId instead of id

  try {
    const scope = await Scope.findByPk(scopeId); // Find scope by scopeId
    if (!scope) {
      return res.status(404).json({ message: "scope not found" });
    }

    // Update mode to "deleted" before deleting
    await scope.update({ mode: "deleted" });

    await scope.destroy();

    res.status(200).json({
      message: "scope deleted successfully",
      scopeId, // Include scopeId in the response
    });
  } catch (error) {
    console.error("Error deleting scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort scopes
exports.getscopes = async (req, res) => {
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
    sortBy: Joi.string().valid("creationDate", "scope_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    // Build the whereClause with filters
    const whereClause = {
      ...(search && {
        scope_desc: {
          [Op.like]: `%${search}%`, // Search by scope_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const scopes = await Scope.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: scopes.count,
      pages: Math.ceil(scopes.count / limit),
      currentPage: parseInt(page),
      scopes: scopes.rows.map((scope) => ({
        scopeId: scope.scopeId, // Include scopeId in the response
        scope_desc: scope.scope_desc,
        mode: scope.mode,
        createdBy: scope.createdBy,
        createdAt: scope.createdAt,
        updatedAt: scope.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching scopes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
