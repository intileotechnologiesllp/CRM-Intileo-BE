const Joi = require("joi");
const { Op } = require("sequelize");
const Designation = require("../../../../models/admin/masters/designationModel");

// Validation schema for designation
const designationSchema = Joi.object({
  designation_desc: Joi.string().min(3).max(100).required(), // Must be a string between 3 and 100 characters
});

// Add Designation
exports.createDesignation = async (req, res) => {
  const { designation_desc } = req.body;

  // Validate the request body
  const { error } = designationSchema.validate({ designation_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const designation = await Designation.create({
      designation_desc,
      createdBy: "admin",
      mode: "added",
    });

    res
      .status(201)
      .json({ message: "Designation created successfully", designation });
  } catch (error) {
    console.error("Error creating designation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Designation
exports.editDesignation = async (req, res) => {
  const { id } = req.params;
  const { designation_desc } = req.body;

  // Validate the request body
  const { error } = designationSchema.validate({ designation_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const designation = await Designation.findByPk(id);
    if (!designation) {
      return res.status(404).json({ message: "Designation not found" });
    }

    await designation.update({
      designation_desc,
      mode: "modified", // Set mode to "modified"
    });

    res
      .status(200)
      .json({ message: "Designation updated successfully", designation });
  } catch (error) {
    console.error("Error updating designation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Designation
exports.deleteDesignation = async (req, res) => {
  const { id } = req.params;

  try {
    const designation = await Designation.findByPk(id);
    if (!designation) {
      return res.status(404).json({ message: "Designation not found" });
    }

    // Update mode to "deleted" before deleting
    await designation.update({ mode: "deleted" });

    await designation.destroy();

    res.status(200).json({ message: "Designation deleted successfully" });
  } catch (error) {
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

  // Validate query parameters
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
      designations: designations.rows,
    });
  } catch (error) {
    console.error("Error fetching designations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
