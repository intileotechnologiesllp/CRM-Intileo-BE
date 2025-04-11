const Status = require("../../../../models/admin/masters/statusModel");
const { Op } = require("sequelize");

// Add Status
exports.createStatus = async (req, res) => {
  const { status_desc } = req.body;

  try {
    const newStatus = await Status.create({
      status_desc,
      createdBy: "admin", // Static admin for now
      mode: "added",
    });

    res.status(201).json({
      message: "Status created successfully",
      status: newStatus,
    });
  } catch (error) {
    console.error("Error creating Status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Status
exports.editStatus = async (req, res) => {
  const { id } = req.params;
  const { status_desc } = req.body;

  try {
    const status = await Status.findByPk(id);
    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    await status.update({
      status_desc,
      mode: "modified",
    });

    res.status(200).json({
      message: "Status updated successfully",
      status,
    });
  } catch (error) {
    console.error("Error updating Status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Status
exports.deleteStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const status = await Status.findByPk(id);
    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }

    await status.update({ mode: "deleted" });
    await status.destroy();

    res.status(200).json({ message: "Status deleted successfully" });
  } catch (error) {
    console.error("Error deleting Status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Statuses with Filters
exports.getStatuses = async (req, res) => {
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
    const whereClause = {
      ...(search && {
        status_desc: {
          [Op.like]: `%${search}%`,
        },
      }),
      ...(createdBy && { createdBy }),
      ...(mode && { mode }),
    };

    const statuses = await Status.findAndCountAll({
      where: whereClause,
      order: [[sortBy, order]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    res.status(200).json({
      total: statuses.count,
      pages: Math.ceil(statuses.count / limit),
      currentPage: parseInt(page),
      statuses: statuses.rows,
    });
  } catch (error) {
    console.error("Error fetching Statuses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
