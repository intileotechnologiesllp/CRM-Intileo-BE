const DASHBOARD= require('../../models/insight/dashboardModel');


exports.createDashboard = async (req, res) => {
  try {
    const { name, folder } = req.body;
    const ownerId = req.adminId; // Assuming user ID is stored in req.user

    const newDashboard = await DASHBOARD.create({
      name,
      folder,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Dashboard created successfully",
      data: newDashboard,
    });
  } catch (error) {
    console.error("Error creating dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create dashboard",
      error: error.message,
    });
  }
}

exports.getDashboards = async (req, res) => {
  try {
    const ownerId = req.adminId; // Assuming user ID is stored in req.user

    const dashboards = await DASHBOARD.findAll({
      where: { ownerId },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: dashboards,
    });
  } catch (error) {
    console.error("Error fetching dashboards:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboards",
      error: error.message,
    });
  }
}
// POST /api/insight/reports
exports.createReport = async (req, res) => {
  const { dashboardId, entity, type, config, position } = req.body;
  const report = await Report.create({ dashboardId, entity, type, config, position });
  res.status(201).json({ report });
};

// GET /api/insight/dashboards/:dashboardId/reports
exports.getReportsForDashboard = async (req, res) => {
  const { dashboardId } = req.params;
  const reports = await Report.findAll({ where: { dashboardId } });
  res.json({ reports });
};