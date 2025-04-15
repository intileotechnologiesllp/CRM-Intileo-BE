const Joi = require("joi");
const { Op } = require("sequelize");
const Program = require("../../../../models/admin/masters/programModel");

// Validation schema for program
const programSchema = Joi.object({
  program_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "program description cannot be empty",
    "any.required": "program description is required",
  }),
});

// Add program
exports.createprogram = async (req, res) => {
  const { program_desc } = req.body;

  // Validate the request body
  const { error } = programSchema.validate({ program_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const program = await Program.create({
      program_desc,
      createdBy: "admin",
      mode: "added"
    });

    res.status(201).json({
      message: "program created successfully",
      program: {
        programId: program.programId, // Include programId in the response
        program_desc: program.program_desc,
        createdBy: program.createdBy,
        mode: program.mode,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating program:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit program
exports.editprogram = async (req, res) => {
  const { programId } = req.params; // Use programId instead of id
  const { program_desc } = req.body;

  // Validate the request body
  const { error } = programSchema.validate({ program_desc });
  if (error) {
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const program = await Program.findByPk(programId); // Find program by programId
    if (!program) {
      return res.status(404).json({ message: "program not found" });
    }

    await program.update({
      program_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({
      message: "program updated successfully",
      program: {
        programId: program.programId, // Include programId in the response
        program_desc: program.program_desc,
        mode: program.mode,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating program:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete program
exports.deleteprogram = async (req, res) => {
  const { programId } = req.params; // Use programId instead of id

  try {
    const program = await Program.findByPk(programId); // Find program by programId
    if (!program) {
      return res.status(404).json({ message: "program not found" });
    }

    // Update mode to "deleted" before deleting
    await program.update({ mode: "deleted" });

    await program.destroy();

    res.status(200).json({
      message: "program deleted successfully",
      programId, // Include programId in the response
    });
  } catch (error) {
    console.error("Error deleting program:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort programs
exports.getprograms = async (req, res) => {
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
    sortBy: Joi.string().valid("creationDate", "program_desc").optional(),
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
        program_desc: {
          [Op.like]: `%${search}%`, // Search by program_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const programs = await Program.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: programs.count,
      pages: Math.ceil(programs.count / limit),
      currentPage: parseInt(page),
      programs: programs.rows.map((program) => ({
        programId: program.programId, // Include programId in the response
        program_desc: program.program_desc,
        mode: program.mode,
        createdBy: program.createdBy,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching programs:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
