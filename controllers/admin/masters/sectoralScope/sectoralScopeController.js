const SectoralScope = require("../../../../models/admin/masters/sectoralScopeModel");

// Add Sectoral Scope
exports.createSectoralScope = async (req, res) => {
  const { sectoral_scope_desc } = req.body;

  try {
    const sectoralScope = await SectoralScope.create({
      sectoral_scope_desc,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
    });

    res
      .status(201)
      .json({ message: "Sectoral Scope created successfully", sectoralScope });
  } catch (error) {
    console.error("Error creating sectoral scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Sectoral Scope
exports.editSectoralScope = async (req, res) => {
  const { id } = req.params;
  const { sectoral_scope_desc } = req.body;

  try {
    const sectoralScope = await SectoralScope.findByPk(id);
    if (!sectoralScope) {
      return res.status(404).json({ message: "Sectoral Scope not found" });
    }

    await sectoralScope.update({
      sectoral_scope_desc,
      mode: "modified", // Set mode to "modified"
    });

    res
      .status(200)
      .json({ message: "Sectoral Scope updated successfully", sectoralScope });
  } catch (error) {
    console.error("Error updating sectoral scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Sectoral Scope
exports.deleteSectoralScope = async (req, res) => {
  const { id } = req.params;

  try {
    const sectoralScope = await SectoralScope.findByPk(id);
    if (!sectoralScope) {
      return res.status(404).json({ message: "Sectoral Scope not found" });
    }

    // Update mode to "deleted" before deleting
    await sectoralScope.update({ mode: "deleted" });

    await sectoralScope.destroy();

    res.status(200).json({ message: "Sectoral Scope deleted successfully" });
  } catch (error) {
    console.error("Error deleting sectoral scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort sectoral scopes
exports.getSectoralScopes = async (req, res) => {
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
        sectoral_scope_desc: {
          [require("sequelize").Op.like]: `%${search}%`, // Search by sectoral_scope_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const sectoralScopes = await SectoralScope.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: sectoralScopes.count,
      pages: Math.ceil(sectoralScopes.count / limit),
      currentPage: parseInt(page),
      sectoralScopes: sectoralScopes.rows,
    });
  } catch (error) {
    console.error("Error fetching sectoral scopes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
