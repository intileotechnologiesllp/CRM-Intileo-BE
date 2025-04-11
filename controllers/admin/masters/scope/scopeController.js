const Designation = require("../../../../models/admin/masters/designationModel");
const Scope = require("../../../../models/admin/masters/scopeModel");

// Add Designation
exports.createDesignation = async (req, res) => {
  const { designation_desc } = req.body;

  try {
    const designation = await Designation.create({
      designation_desc,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
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

  try {
    // Build the whereClause with filters
    const whereClause = {
      ...(search && {
        designation_desc: {
          [require("sequelize").Op.like]: `%${search}%`, // Search by designation_desc
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

// Add Scope
exports.createScope = async (req, res) => {
  const { scope_desc } = req.body;

  try {
    const scope = await Scope.create({
      scope_desc,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
    });

    res.status(201).json({ message: "Scope created successfully", scope });
  } catch (error) {
    console.error("Error creating scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Scope
exports.editScope = async (req, res) => {
  const { id } = req.params;
  const { scope_desc } = req.body;

  try {
    const scope = await Scope.findByPk(id);
    if (!scope) {
      return res.status(404).json({ message: "Scope not found" });
    }

    await scope.update({
      scope_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({ message: "Scope updated successfully", scope });
  } catch (error) {
    console.error("Error updating scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Scope
exports.deleteScope = async (req, res) => {
  const { id } = req.params;

  try {
    const scope = await Scope.findByPk(id);
    if (!scope) {
      return res.status(404).json({ message: "Scope not found" });
    }

    // Update mode to "deleted" before deleting
    await scope.update({ mode: "deleted" });

    await scope.destroy();

    res.status(200).json({ message: "Scope deleted successfully" });
  } catch (error) {
    console.error("Error deleting scope:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort scopes
exports.getScopes = async (req, res) => {
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
        scope_desc: {
          [require("sequelize").Op.like]: `%${search}%`, // Search by scope_desc
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
      scopes: scopes.rows,
    });
  } catch (error) {
    console.error("Error fetching scopes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
