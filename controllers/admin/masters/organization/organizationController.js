const OrganizationType = require("../../../../models/admin/masters/organizationModel");
const { Op } = require("sequelize");

// Add Organization Type
exports.createOrganizationType = async (req, res) => {
  const { organization_desc } = req.body;

  try {
    const newOrganizationType = await OrganizationType.create({
      organization_desc,
      createdBy: "admin", // Static admin for now
      mode: "added",
    });

    res.status(201).json({
      message: "Organization Type created successfully",
      organizationType: newOrganizationType,
    });
  } catch (error) {
    console.error("Error creating Organization Type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Organization Type
exports.editOrganizationType = async (req, res) => {
  const { id } = req.params;
  const { organization_desc } = req.body;

  try {
    const organizationType = await OrganizationType.findByPk(id);
    if (!organizationType) {
      return res.status(404).json({ message: "Organization Type not found" });
    }

    await organizationType.update({
      organization_desc,
      mode: "modified",
    });

    res.status(200).json({
      message: "Organization Type updated successfully",
      organizationType,
    });
  } catch (error) {
    console.error("Error updating Organization Type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Organization Type
exports.deleteOrganizationType = async (req, res) => {
  const { id } = req.params;

  try {
    const organizationType = await OrganizationType.findByPk(id);
    if (!organizationType) {
      return res.status(404).json({ message: "Organization Type not found" });
    }

    await organizationType.update({ mode: "deleted" });
    await organizationType.destroy();

    res.status(200).json({ message: "Organization Type deleted successfully" });
  } catch (error) {
    console.error("Error deleting Organization Type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Organization Types with Filters
exports.getOrganizationTypes = async (req, res) => {
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
        organization_desc: {
          [Op.like]: `%${search}%`,
        },
      }),
      ...(createdBy && { createdBy }),
      ...(mode && { mode }),
    };

    const organizationTypes = await OrganizationType.findAndCountAll({
      where: whereClause,
      order: [[sortBy, order]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    res.status(200).json({
      total: organizationTypes.count,
      pages: Math.ceil(organizationTypes.count / limit),
      currentPage: parseInt(page),
      organizationTypes: organizationTypes.rows,
    });
  } catch (error) {
    console.error("Error fetching Organization Types:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
