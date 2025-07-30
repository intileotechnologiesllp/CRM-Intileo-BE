const DASHBOARD = require("../../models/insight/dashboardModel");
const Report = require("../../models/insight/reportModel");
const Goal = require("../../models/insight/goalModel");
const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Activity = require("../../models/activity/activityModel");
const { Op } = require("sequelize");

// =============== DASHBOARD MANAGEMENT ===============

exports.createDashboard = async (req, res) => {
  try {
    const { name, folder, type, parentId } = req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Dashboard name is required",
      });
    }

    // Determine the type (folder or dashboard/file)
    const itemType = type || "dashboard"; // default to dashboard

    let resolvedParentId = parentId || null;
    let resolvedFolderName = folder || "My dashboards";

    // If folder name is provided and not default, check if it's a valid existing folder
    if (!parentId && folder && folder !== "My dashboards") {
      // Only use existing folders, don't auto-create new ones to avoid confusion
      const existingFolder = await DASHBOARD.findOne({
        where: {
          name: folder,
          ownerId,
          type: "folder",
          parentId: null,
        },
      });

      if (existingFolder) {
        // Use the existing folder
        resolvedParentId = existingFolder.dashboardId;
        resolvedFolderName = existingFolder.name;
      } else {
        // If folder doesn't exist, inform user instead of defaulting to root
        return res.status(400).json({
          success: false,
          message: `Folder "${folder}" does not exist. Please create the folder first or use an existing folder.`,
        });
      }
    }

    // If parentId is provided, validate it is a folder
    if (resolvedParentId) {
      const parentFolder = await DASHBOARD.findOne({
        where: {
          dashboardId: resolvedParentId,
          ownerId,
          type: "folder",
        },
      });
      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          message: "Parent folder not found",
        });
      }
      resolvedFolderName = parentFolder.name;
    }

    // Check if a dashboard with the same name already exists in the same folder
    const existingDashboard = await DASHBOARD.findOne({
      where: {
        name,
        ownerId,
        parentId: resolvedParentId, // Check within the same folder/parent
        type: itemType, // Also check for the same type (dashboard/folder)
      },
    });

    if (existingDashboard) {
      return res.status(400).json({
        success: false,
        message: `A ${
          itemType === "folder" ? "folder" : "dashboard"
        } with this name already exists in this location`,
      });
    }

    const newDashboard = await DASHBOARD.create({
      name,
      folder: resolvedFolderName,
      type: itemType,
      parentId: resolvedParentId,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: `${
        itemType === "folder" ? "Folder" : "Dashboard"
      } created successfully`,
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
};

exports.getDashboards = async (req, res) => {
  try {
    const ownerId = req.adminId;

    const dashboards = await DASHBOARD.findAll({
      where: { ownerId },
      include: [
        {
          model: Report,
          required: false,
        },
        {
          model: Goal,
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Group dashboards by folder and organize hierarchically
    const dashboardsByFolder = {};
    const hierarchicalData = [];

    // First, create folders structure
    const folders = dashboards.filter((item) => item.type === "folder");
    const files = dashboards.filter((item) => item.type !== "folder");

    // Organize into hierarchy
    folders.forEach((folder) => {
      const folderData = {
        ...folder.toJSON(),
        children: [],
      };

      // Find files that belong to this folder
      const folderFiles = files.filter(
        (file) => file.parentId === folder.dashboardId
      );
      folderData.children = folderFiles;

      if (folder.parentId === null) {
        hierarchicalData.push(folderData);
      }
    });

    // Add orphaned files (files without parent folder)
    const orphanedFiles = files.filter((file) => file.parentId === null);
    hierarchicalData.push(...orphanedFiles);

    // Legacy grouping by folder name for backward compatibility
    dashboards.forEach((dashboard) => {
      const folder = dashboard.folder || "My dashboards";
      if (!dashboardsByFolder[folder]) {
        dashboardsByFolder[folder] = [];
      }
      dashboardsByFolder[folder].push(dashboard);
    });

    res.status(200).json({
      success: true,
      data: dashboards,
      byFolder: dashboardsByFolder,
      hierarchical: hierarchicalData,
    });
  } catch (error) {
    console.error("Error fetching dashboards:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboards",
      error: error.message,
    });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const ownerId = req.adminId;

    const dashboard = await DASHBOARD.findOne({
      where: {
        dashboardId,
        ownerId,
      },
      include: [
        {
          model: Report,
          required: false,
          order: [["position", "ASC"]],
        },
        {
          model: Goal,
          where: { isActive: true },
          required: false,
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found",
      });
    }

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
      error: error.message,
    });
  }
};

exports.updateDashboard = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { name, folder } = req.body;
    const ownerId = req.adminId;

    const dashboard = await DASHBOARD.findOne({
      where: {
        dashboardId,
        ownerId,
      },
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found",
      });
    }

    await dashboard.update({
      name: name || dashboard.name,
      folder: folder || dashboard.folder,
    });

    res.status(200).json({
      success: true,
      message: "Dashboard updated successfully",
      data: dashboard,
    });
  } catch (error) {
    console.error("Error updating dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update dashboard",
      error: error.message,
    });
  }
};

exports.deleteDashboard = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const ownerId = req.adminId;

    const dashboard = await DASHBOARD.findOne({
      where: {
        dashboardId,
        ownerId,
      },
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found",
      });
    }

    // Delete associated reports and goals
    await Report.destroy({ where: { dashboardId } });
    await Goal.destroy({ where: { dashboardId } });
    await dashboard.destroy();

    res.status(200).json({
      success: true,
      message: "Dashboard deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete dashboard",
      error: error.message,
    });
  }
};

// =============== FOLDER MANAGEMENT ===============

exports.createFolder = async (req, res) => {
  try {
    const { name, parentId, folder } = req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Folder name is required",
      });
    }

    // Check if a folder with the same name already exists in the same location
    const existingFolder = await DASHBOARD.findOne({
      where: {
        name,
        ownerId,
        type: "folder",
        parentId: parentId || null,
      },
    });

    if (existingFolder) {
      return res.status(400).json({
        success: false,
        message: "A folder with this name already exists in this location",
      });
    }

    // If creating subfolder, validate parent exists
    if (parentId) {
      const parentFolder = await DASHBOARD.findOne({
        where: {
          dashboardId: parentId,
          ownerId,
          type: "folder",
        },
      });

      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          message: "Parent folder not found",
        });
      }
    }

    const newFolder = await DASHBOARD.create({
      name,
      folder: folder || "My dashboards",
      type: "folder",
      parentId: parentId || null,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Folder created successfully",
      data: newFolder,
    });
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create folder",
      error: error.message,
    });
  }
};

exports.getFolderContents = async (req, res) => {
  try {
    const { folderId } = req.params;
    const ownerId = req.adminId;

    // Verify folder ownership
    const folder = await DASHBOARD.findOne({
      where: {
        dashboardId: folderId,
        ownerId,
        type: "folder",
      },
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found or access denied",
      });
    }

    // Get all items in this folder
    const contents = await DASHBOARD.findAll({
      where: {
        parentId: folderId,
        ownerId,
      },
      include: [
        {
          model: Report,
          required: false,
        },
        {
          model: Goal,
          required: false,
        },
      ],
      order: [
        ["type", "ASC"], // Folders first
        ["name", "ASC"],
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        folder,
        contents,
      },
    });
  } catch (error) {
    console.error("Error fetching folder contents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch folder contents",
      error: error.message,
    });
  }
};

exports.moveToFolder = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { targetFolderId } = req.body;
    const ownerId = req.adminId;

    // Verify item ownership
    const item = await DASHBOARD.findOne({
      where: {
        dashboardId: itemId,
        ownerId,
      },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found or access denied",
      });
    }

    // If moving to a folder, verify folder exists
    if (targetFolderId) {
      const targetFolder = await DASHBOARD.findOne({
        where: {
          dashboardId: targetFolderId,
          ownerId,
          type: "folder",
        },
      });

      if (!targetFolder) {
        return res.status(404).json({
          success: false,
          message: "Target folder not found",
        });
      }

      // Prevent moving folder into itself or its descendants
      if (item.type === "folder") {
        const isDescendant = await checkIfDescendant(
          targetFolderId,
          itemId,
          ownerId
        );
        if (isDescendant || targetFolderId === itemId) {
          return res.status(400).json({
            success: false,
            message: "Cannot move folder into itself or its descendants",
          });
        }
      }
    }

    await item.update({
      parentId: targetFolderId || null,
    });

    res.status(200).json({
      success: true,
      message: "Item moved successfully",
      data: item,
    });
  } catch (error) {
    console.error("Error moving item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move item",
      error: error.message,
    });
  }
};

// Helper function to check if target is a descendant of source
async function checkIfDescendant(targetId, sourceId, ownerId) {
  const descendants = await DASHBOARD.findAll({
    where: {
      parentId: sourceId,
      ownerId,
    },
  });

  for (const descendant of descendants) {
    if (descendant.dashboardId === targetId) {
      return true;
    }
    if (descendant.type === "folder") {
      const isSubDescendant = await checkIfDescendant(
        targetId,
        descendant.dashboardId,
        ownerId
      );
      if (isSubDescendant) {
        return true;
      }
    }
  }

  return false;
}

// =============== REPORT MANAGEMENT ===============

exports.createReport = async (req, res) => {
  try {
    const { dashboardId, entity, type, config, position, name, description } =
      req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (!dashboardId || !entity || !type) {
      return res.status(400).json({
        success: false,
        message: "Dashboard ID, entity, and type are required",
      });
    }

    // Verify dashboard ownership
    const dashboard = await DASHBOARD.findOne({
      where: {
        dashboardId,
        ownerId,
      },
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found or access denied",
      });
    }

    // Default config based on report type
    let defaultConfig = {};
    switch (type) {
      case "Performance":
        defaultConfig = {
          chartType: "pie",
          metrics: ["win_rate", "loss_rate"],
          period: "this_month",
          groupBy: "status",
        };
        break;
      case "Conversion":
        defaultConfig = {
          chartType: "funnel",
          metrics: ["conversion_rate"],
          period: "this_month",
          stages: ["all"],
        };
        break;
      case "Duration":
        defaultConfig = {
          chartType: "bar",
          metrics: ["avg_days"],
          period: "this_month",
          groupBy: "pipeline_stage",
        };
        break;
      case "Progress":
        defaultConfig = {
          chartType: "line",
          metrics: ["deal_movement"],
          period: "this_month",
          groupBy: "stage",
        };
        break;
      case "Products":
        defaultConfig = {
          chartType: "bar",
          metrics: ["revenue", "quantity"],
          period: "this_month",
          groupBy: "product",
        };
        break;
      default:
        defaultConfig = {
          chartType: "bar",
          metrics: ["count"],
          period: "this_month",
        };
    }

    const finalConfig = { ...defaultConfig, ...config };

    const newReport = await Report.create({
      dashboardId,
      entity,
      type,
      config: finalConfig,
      position: position || 0,
      name: name || `${entity} ${type} Report`,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: newReport,
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create report",
      error: error.message,
    });
  }
};

exports.getReportsForDashboard = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const ownerId = req.adminId;

    // Verify dashboard ownership
    const dashboard = await DASHBOARD.findOne({
      where: {
        dashboardId,
        ownerId,
      },
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found or access denied",
      });
    }

    const reports = await Report.findAll({
      where: { dashboardId },
      order: [
        ["position", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    // Generate report data for each report
    const reportsWithData = await Promise.all(
      reports.map(async (report) => {
        const reportData = await generateReportData(report, ownerId);
        return {
          ...report.toJSON(),
          data: reportData,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: reportsWithData,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { entity, type, config, position, name, description } = req.body;
    const ownerId = req.adminId;

    const report = await Report.findOne({
      where: { reportId },
      include: [
        {
          model: DASHBOARD,
          where: { ownerId },
        },
      ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found or access denied",
      });
    }

    await report.update({
      entity: entity || report.entity,
      type: type || report.type,
      config: config ? { ...report.config, ...config } : report.config,
      position: position !== undefined ? position : report.position,
      name: name || report.name,
      description: description !== undefined ? description : report.description,
    });

    res.status(200).json({
      success: true,
      message: "Report updated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update report",
      error: error.message,
    });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const ownerId = req.adminId;

    const report = await Report.findOne({
      where: { reportId },
      include: [
        {
          model: DASHBOARD,
          where: { ownerId },
        },
      ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found or access denied",
      });
    }

    await report.destroy();

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report",
      error: error.message,
    });
  }
};

exports.getReportData = async (req, res) => {
  try {
    const { reportId } = req.params;
    const ownerId = req.adminId;

    const report = await Report.findOne({
      where: { reportId },
      include: [
        {
          model: DASHBOARD,
          where: { ownerId },
        },
      ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found or access denied",
      });
    }

    const reportData = await generateReportData(report, ownerId);

    res.status(200).json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error("Error generating report data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report data",
      error: error.message,
    });
  }
};

// =============== GOAL MANAGEMENT ===============

exports.createGoal = async (req, res) => {
  try {
    const {
      dashboardId,
      entity,
      goalType,
      targetValue,
      targetType,
      period,
      startDate,
      endDate,
      description,
    } = req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (!dashboardId || !entity || !goalType || !targetValue) {
      return res.status(400).json({
        success: false,
        message:
          "Dashboard ID, entity, goal type, and target value are required",
      });
    }

    // Verify dashboard ownership
    const dashboard = await DASHBOARD.findOne({
      where: {
        dashboardId,
        ownerId,
      },
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found or access denied",
      });
    }

    // Set default dates if not provided
    const now = new Date();
    const defaultStartDate =
      startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate =
      endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const newGoal = await Goal.create({
      dashboardId,
      entity,
      goalType,
      targetValue,
      targetType: targetType || "number",
      period: period || "monthly",
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      description,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Goal created successfully",
      data: newGoal,
    });
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create goal",
      error: error.message,
    });
  }
};

exports.getGoalsForDashboard = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const ownerId = req.adminId;

    // Verify dashboard ownership
    const dashboard = await DASHBOARD.findOne({
      where: {
        dashboardId,
        ownerId,
      },
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found or access denied",
      });
    }

    const goals = await Goal.findAll({
      where: {
        dashboardId,
        isActive: true,
      },
      order: [["createdAt", "DESC"]],
    });

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateGoalProgress(goal, ownerId);
        return {
          ...goal.toJSON(),
          progress,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: goalsWithProgress,
    });
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goals",
      error: error.message,
    });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const {
      entity,
      goalType,
      targetValue,
      targetType,
      period,
      startDate,
      endDate,
      description,
      isActive,
    } = req.body;
    const ownerId = req.adminId;

    const goal = await Goal.findOne({
      where: {
        goalId,
        ownerId,
      },
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found or access denied",
      });
    }

    await goal.update({
      entity: entity || goal.entity,
      goalType: goalType || goal.goalType,
      targetValue: targetValue !== undefined ? targetValue : goal.targetValue,
      targetType: targetType || goal.targetType,
      period: period || goal.period,
      startDate: startDate || goal.startDate,
      endDate: endDate || goal.endDate,
      description: description !== undefined ? description : goal.description,
      isActive: isActive !== undefined ? isActive : goal.isActive,
    });

    res.status(200).json({
      success: true,
      message: "Goal updated successfully",
      data: goal,
    });
  } catch (error) {
    console.error("Error updating goal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update goal",
      error: error.message,
    });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const ownerId = req.adminId;

    const goal = await Goal.findOne({
      where: {
        goalId,
        ownerId,
      },
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found or access denied",
      });
    }

    await goal.destroy();

    res.status(200).json({
      success: true,
      message: "Goal deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete goal",
      error: error.message,
    });
  }
};

exports.getGoalProgress = async (req, res) => {
  try {
    const { goalId } = req.params;
    const ownerId = req.adminId;

    const goal = await Goal.findOne({
      where: {
        goalId,
        ownerId,
      },
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found or access denied",
      });
    }

    const progress = await calculateGoalProgress(goal, ownerId);

    res.status(200).json({
      success: true,
      data: {
        goal: goal.toJSON(),
        progress,
      },
    });
  } catch (error) {
    console.error("Error calculating goal progress:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate goal progress",
      error: error.message,
    });
  }
};

// =============== HELPER FUNCTIONS ===============

async function generateReportData(report, ownerId) {
  try {
    const { entity, type, config } = report;
    const period = config.period || "this_month";

    // Get date range based on period
    const dateRange = getDateRange(period);

    let data = {};

    if (entity === "Deal") {
      data = await generateDealReportData(type, config, dateRange, ownerId);
    } else if (entity === "Lead") {
      data = await generateLeadReportData(type, config, dateRange, ownerId);
    } else if (entity === "Activity") {
      data = await generateActivityReportData(type, config, dateRange, ownerId);
    }

    return {
      ...data,
      generatedAt: new Date(),
      period: period,
      dateRange: dateRange,
    };
  } catch (error) {
    console.error("Error generating report data:", error);
    return {
      error: "Failed to generate report data",
      generatedAt: new Date(),
    };
  }
}

async function generateDealReportData(type, config, dateRange, ownerId) {
  const whereClause = {
    createdAt: {
      [Op.between]: [dateRange.start, dateRange.end],
    },
  };

  // Add user filter for non-admin users
  if (ownerId) {
    whereClause[Op.or] = [{ masterUserID: ownerId }, { ownerId: ownerId }];
  }

  switch (type) {
    case "Performance":
      const dealStats = await Deal.findAll({
        attributes: [
          "status",
          [Deal.sequelize.fn("COUNT", Deal.sequelize.col("dealId")), "count"],
          [Deal.sequelize.fn("SUM", Deal.sequelize.col("value")), "totalValue"],
        ],
        where: whereClause,
        group: ["status"],
      });

      return {
        chartType: "pie",
        labels: dealStats.map((stat) => stat.status || "Open"),
        datasets: [
          {
            data: dealStats.map((stat) => stat.get("count")),
            backgroundColor: ["#4CAF50", "#2196F3", "#FF9800", "#F44336"],
          },
        ],
        summary: {
          total: dealStats.reduce(
            (sum, stat) => sum + parseInt(stat.get("count")),
            0
          ),
          totalValue: dealStats.reduce(
            (sum, stat) => sum + parseFloat(stat.get("totalValue") || 0),
            0
          ),
        },
      };

    case "Conversion":
      const conversionData = await Deal.findAll({
        attributes: [
          "pipelineStage",
          [Deal.sequelize.fn("COUNT", Deal.sequelize.col("dealId")), "count"],
        ],
        where: whereClause,
        group: ["pipelineStage"],
      });

      return {
        chartType: "funnel",
        stages: conversionData.map((stage) => ({
          name: stage.pipelineStage || "Unknown",
          value: parseInt(stage.get("count")),
        })),
      };

    case "Duration":
      const durationData = await Deal.findAll({
        attributes: [
          "pipelineStage",
          [
            Deal.sequelize.fn(
              "AVG",
              Deal.sequelize.fn(
                "DATEDIFF",
                Deal.sequelize.fn("NOW"),
                Deal.sequelize.col("createdAt")
              )
            ),
            "avgDays",
          ],
        ],
        where: whereClause,
        group: ["pipelineStage"],
      });

      return {
        chartType: "bar",
        labels: durationData.map((stage) => stage.pipelineStage || "Unknown"),
        datasets: [
          {
            label: "Average Days",
            data: durationData.map((stage) =>
              Math.round(parseFloat(stage.get("avgDays")) || 0)
            ),
            backgroundColor: "#2196F3",
          },
        ],
      };

    default:
      return { error: "Unknown report type" };
  }
}

async function generateLeadReportData(type, config, dateRange, ownerId) {
  const whereClause = {
    createdAt: {
      [Op.between]: [dateRange.start, dateRange.end],
    },
  };

  if (ownerId) {
    whereClause.masterUserID = ownerId;
  }

  const leadStats = await Lead.findAll({
    attributes: [
      "status",
      [Lead.sequelize.fn("COUNT", Lead.sequelize.col("leadId")), "count"],
    ],
    where: whereClause,
    group: ["status"],
  });

  return {
    chartType: "pie",
    labels: leadStats.map((stat) => stat.status || "Open"),
    datasets: [
      {
        data: leadStats.map((stat) => parseInt(stat.get("count"))),
        backgroundColor: ["#4CAF50", "#2196F3", "#FF9800"],
      },
    ],
    summary: {
      total: leadStats.reduce(
        (sum, stat) => sum + parseInt(stat.get("count")),
        0
      ),
    },
  };
}

async function generateActivityReportData(type, config, dateRange, ownerId) {
  const whereClause = {
    createdAt: {
      [Op.between]: [dateRange.start, dateRange.end],
    },
  };

  if (ownerId) {
    whereClause.masterUserID = ownerId;
  }

  const activityStats = await Activity.findAll({
    attributes: [
      "activityType",
      [
        Activity.sequelize.fn("COUNT", Activity.sequelize.col("activityId")),
        "count",
      ],
    ],
    where: whereClause,
    group: ["activityType"],
  });

  return {
    chartType: "bar",
    labels: activityStats.map((stat) => stat.activityType || "Unknown"),
    datasets: [
      {
        label: "Activity Count",
        data: activityStats.map((stat) => parseInt(stat.get("count"))),
        backgroundColor: "#FF9800",
      },
    ],
    summary: {
      total: activityStats.reduce(
        (sum, stat) => sum + parseInt(stat.get("count")),
        0
      ),
    },
  };
}

async function calculateGoalProgress(goal, ownerId) {
  const { entity, goalType, targetValue, startDate, endDate } = goal;

  const whereClause = {
    createdAt: {
      [Op.between]: [startDate, endDate],
    },
  };

  if (ownerId) {
    whereClause[Op.or] = [{ masterUserID: ownerId }, { ownerId: ownerId }];
  }

  let currentValue = 0;

  try {
    if (entity === "Deal") {
      if (goalType === "Added") {
        const count = await Deal.count({ where: whereClause });
        currentValue = count;
      } else if (goalType === "Won") {
        const count = await Deal.count({
          where: {
            ...whereClause,
            status: "won",
          },
        });
        currentValue = count;
      } else if (goalType === "Progressed") {
        // Count deals that moved stages
        const count = await Deal.count({
          where: {
            ...whereClause,
            pipelineStage: { [Op.ne]: "Qualified" },
          },
        });
        currentValue = count;
      }
    } else if (entity === "Lead") {
      const count = await Lead.count({ where: whereClause });
      currentValue = count;
    } else if (entity === "Activity") {
      const count = await Activity.count({ where: whereClause });
      currentValue = count;
    }

    const percentage = Math.min(
      100,
      Math.round((currentValue / targetValue) * 100)
    );

    return {
      currentValue,
      targetValue: parseFloat(targetValue),
      percentage,
      status:
        percentage >= 100
          ? "completed"
          : percentage >= 75
          ? "on_track"
          : "behind",
    };
  } catch (error) {
    console.error("Error calculating goal progress:", error);
    return {
      currentValue: 0,
      targetValue: parseFloat(targetValue),
      percentage: 0,
      status: "error",
      error: error.message,
    };
  }
}

function getDateRange(period) {
  const now = new Date();
  let start, end;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case "this_week":
      start = new Date(now.setDate(now.getDate() - now.getDay()));
      end = new Date(now.setDate(now.getDate() - now.getDay() + 6));
      break;
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case "this_quarter":
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      break;
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return { start, end };
}
