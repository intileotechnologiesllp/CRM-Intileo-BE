const Program = require("../../../../models/admin/masters/programModel");

// Add Program
exports.createProgram = async (req, res) => {
  const { program_desc } = req.body;

  try {
    const program = await Program.create({
      program_desc,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
    });

    res.status(201).json({ message: "Program created successfully", program });
  } catch (error) {
    console.error("Error creating program:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Program
exports.editProgram = async (req, res) => {
  const { id } = req.params;
  const { program_desc } = req.body;

  try {
    const program = await Program.findByPk(id);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    await program.update({
      program_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({ message: "Program updated successfully", program });
  } catch (error) {
    console.error("Error updating program:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Program
exports.deleteProgram = async (req, res) => {
  const { id } = req.params;

  try {
    const program = await Program.findByPk(id);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Update mode to "deleted" before deleting
    await program.update({ mode: "deleted" });

    await program.destroy();

    res.status(200).json({ message: "Program deleted successfully" });
  } catch (error) {
    console.error("Error deleting program:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort programs
exports.getPrograms = async (req, res) => {
  const {
    search,
    createdBy,
    mode,
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;

  try {
    // Build the whereClause with filters
    const whereClause = {
      ...(search && {
        program_desc: {
          [require("sequelize").Op.like]: `%${search}%`, // Search by program_desc
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
      programs: programs.rows,
    });
  } catch (error) {
    console.error("Error fetching programs:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
