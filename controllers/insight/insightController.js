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
    let resolvedFolderName = null; // Start with null

    // If folder name is provided, check if it's a valid existing folder
    if (!parentId && folder) {
      // Handle special cases
      if (folder === "My dashboards") {
        resolvedFolderName = "My dashboards";
        // Don't set parentId - keep it null for root level
      } else {
        // Look for existing folder with the provided name
        let existingFolder = await DASHBOARD.findOne({
          where: {
            name: folder,
            ownerId,
            type: "folder",
            parentId: null,
          },
        });

        if (!existingFolder) {
          // Auto-create the folder if it doesn't exist
          existingFolder = await DASHBOARD.create({
            name: folder,
            folder: null, // Folders themselves don't have a folder parent
            type: "folder",
            parentId: null,
            ownerId,
          });
        }
        // Use the existing or newly created folder
        resolvedParentId = existingFolder.dashboardId;
        resolvedFolderName = existingFolder.name;
      }
    } else if (parentId) {
      // If parentId is provided, validate it is a folder and get its name
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
      resolvedFolderName = parentFolder.name;
    } else {
      // No folder specified and no parentId - this goes to "My dashboards"
      resolvedFolderName = "My dashboards";
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
      folder: resolvedFolderName, // Allow null values
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
    const role = req.role;
    let dashboards;
    if (role === "admin") {
      dashboards = await DASHBOARD.findAll({
        include: [
          {
            model: Report,
            as: "Reports",
            required: false,
          },
          {
            model: Goal,
            as: "Goals",
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } else {
      dashboards = await DASHBOARD.findAll({
        where: { ownerId },
        include: [
          {
            model: Report,
            as: "Reports",
            required: false,
          },
          {
            model: Goal,
            as: "Goals",
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    }

    // Group dashboards by folder for backward compatibility
    const dashboardsByFolder = {};
    dashboards.forEach((dashboard) => {
      const folder =
        dashboard.folder === null ||
        dashboard.folder === undefined ||
        dashboard.folder === ""
          ? "My dashboards"
          : dashboard.folder;
      if (!dashboardsByFolder[folder]) {
        dashboardsByFolder[folder] = [];
      }
      dashboardsByFolder[folder].push(dashboard);
    });

    res.status(200).json({
      success: true,
      byFolder: dashboardsByFolder,
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
          as: "Reports",
          required: false,
          order: [["position", "ASC"]],
        },
        {
          model: Goal,
          as: "Goals",
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

// Bulk delete multiple dashboards
exports.bulkDeleteDashboards = async (req, res) => {
  try {
    const { dashboardIds } = req.body;
    const ownerId = req.adminId;
    const role = req.role;

    // Validate input
    if (
      !dashboardIds ||
      !Array.isArray(dashboardIds) ||
      dashboardIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Dashboard IDs array is required",
      });
    }

    // Get all dashboards for admin, or only user's dashboards for non-admin
    let allUserDashboards;
    if (role === "admin") {
      allUserDashboards = await DASHBOARD.findAll({
        where: {
          type: { [Op.ne]: "folder" },
        },
      });
    } else {
      allUserDashboards = await DASHBOARD.findAll({
        where: {
          ownerId,
          type: { [Op.ne]: "folder" },
        },
      });
    }

    // Check if user is trying to delete all dashboards
    const remainingDashboards = allUserDashboards.filter(
      (dashboard) => !dashboardIds.includes(dashboard.dashboardId)
    );

    if (remainingDashboards.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "It's required to keep at least one dashboard. Cannot delete all dashboards.",
      });
    }

    // Find dashboards to delete (admin: all, non-admin: only own)
    let dashboardsToDelete;
    if (role === "admin") {
      dashboardsToDelete = await DASHBOARD.findAll({
        where: {
          dashboardId: { [Op.in]: dashboardIds },
        },
      });
    } else {
      dashboardsToDelete = await DASHBOARD.findAll({
        where: {
          dashboardId: { [Op.in]: dashboardIds },
          ownerId,
        },
      });
    }

    if (dashboardsToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No dashboards found to delete",
      });
    }

    // Check if some dashboards were not found or not accessible
    const foundIds = dashboardsToDelete.map((d) => d.dashboardId);
    const notFoundIds = dashboardIds.filter((id) => !foundIds.includes(id));

    // Delete associated reports and goals for all dashboards
    await Report.destroy({
      where: {
        dashboardId: { [Op.in]: foundIds },
      },
    });

    await Goal.destroy({
      where: {
        dashboardId: { [Op.in]: foundIds },
      },
    });

    // Delete the dashboards
    let deleteWhere = { dashboardId: { [Op.in]: foundIds } };
    if (role !== "admin") deleteWhere.ownerId = ownerId;
    const deletedCount = await DASHBOARD.destroy({
      where: deleteWhere,
    });

    let message = `Successfully deleted ${deletedCount} dashboard(s)`;
    if (notFoundIds.length > 0) {
      message += `. Note: ${notFoundIds.length} dashboard(s) were not found or not accessible.`;
    }

    res.status(200).json({
      success: true,
      message: message,
      data: {
        deletedCount: deletedCount,
        deletedIds: foundIds,
        notFoundIds: notFoundIds,
        remainingDashboards: remainingDashboards.length,
      },
    });
  } catch (error) {
    console.error("Error bulk deleting dashboards:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete dashboards",
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
      folder: folder || null, // Allow null values
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
          as: "Reports",
          required: false,
        },
        {
          model: Goal,
          as: "Goals",
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
          as: "Dashboard",
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
          as: "Dashboard",
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
          as: "Dashboard",
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

// Get available goal types for entity selection
exports.getGoalTypes = async (req, res) => {
  try {
    const goalTypes = {
      Deal: [
        {
          type: "Added",
          description: "Based on the number or value of new deals",
          metrics: ["count", "value"],
        },
        {
          type: "Progressed",
          description:
            "Based on the number or value of deals entering a certain stage",
          metrics: ["count", "value"],
        },
        {
          type: "Won",
          description: "Based on the number or value of won deals",
          metrics: ["count", "value"],
        },
      ],
      Activity: [
        {
          type: "Completed",
          description: "Based on the number of completed activities",
          metrics: ["count"],
        },
      ],
      Forecast: [
        {
          type: "Revenue",
          description: "Based on forecasted revenue",
          metrics: ["value"],
        },
      ],
    };

    res.status(200).json({
      success: true,
      data: goalTypes,
    });
  } catch (error) {
    console.error("Error fetching goal types:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goal types",
      error: error.message,
    });
  }
};

exports.createGoal = async (req, res) => {
  try {
    const {
      dashboardId,
      entity,
      goalType,
      targetValue,
      targetType,
      period,
      frequency,
      startDate,
      endDate,
      description,
      assignee,
      assignId,
      pipeline,
      trackingMetric,
      count,
      value,
    } = req.body;
    const ownerId = req.adminId;

    // Validate required fields - dashboardId is now optional
    if (!entity || !goalType) {
      return res.status(400).json({
        success: false,
        message: "Entity and goal type are required",
      });
    }

    // Validate target value or count/value based on tracking metric
    if (!targetValue && !count && !value) {
      return res.status(400).json({
        success: false,
        message: "Target value, count, or value is required",
      });
    }

    // Validate start date is required
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required",
      });
    }

    // Verify dashboard ownership if dashboardId is provided
    if (dashboardId) {
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
    }

    // Set default dates if not provided
    const now = new Date();
    let defaultStartDate, defaultEndDate;

    // Parse startDate if provided
    if (startDate) {
      defaultStartDate = new Date(startDate);
      // Validate startDate
      if (isNaN(defaultStartDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid start date format",
        });
      }
    }

    // Parse endDate if provided, otherwise handle indefinite goals
    if (endDate && endDate !== "" && endDate !== null) {
      defaultEndDate = new Date(endDate);
      // Validate endDate
      if (isNaN(defaultEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid end date format",
        });
      }
      // Validate end date is after start date
      if (defaultEndDate <= defaultStartDate) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    } else {
      // No end date provided - goal continues indefinitely
      // For display purposes, we can set a far future date or null
      // Setting to null indicates an indefinite goal
      defaultEndDate = null;

      // If frequency is provided, we can calculate the current period's end date for tracking
      // But the goal itself continues indefinitely
      if (frequency === "Monthly") {
        // For tracking current period only
        const currentPeriodEnd = new Date(
          defaultStartDate.getFullYear(),
          defaultStartDate.getMonth() + 1,
          0
        );
      } else if (frequency === "Quarterly") {
        const currentPeriodEnd = new Date(
          defaultStartDate.getFullYear(),
          defaultStartDate.getMonth() + 3,
          0
        );
      } else if (frequency === "Yearly") {
        const currentPeriodEnd = new Date(
          defaultStartDate.getFullYear() + 1,
          0,
          0
        );
      }
      // Note: For indefinite goals, we track progress from start date to current date
    }

    // Generate goal name if not provided
    const goalName =
      description || `${entity} ${goalType} - ${assignee || "All"}`;

    // Determine target value based on tracking metric
    let finalTargetValue = targetValue;
    if (trackingMetric === "Count" && count) {
      finalTargetValue = count;
    } else if (trackingMetric === "Value" && value) {
      finalTargetValue = value;
    }

    const newGoal = await Goal.create({
      dashboardId: dashboardId || null,
      entity,
      goalType,
      targetValue: finalTargetValue,
      targetType:
        targetType || (trackingMetric === "Value" ? "currency" : "number"),
      period: period || "Monthly", // Use period field as defined in model
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      description: goalName,
      assignee: assignee || null,
      assignId: assignId || null, // Add assignId field
      pipeline: pipeline || null,
      trackingMetric: trackingMetric || "Count",
      count: trackingMetric === "Count" ? count || finalTargetValue : null,
      value: trackingMetric === "Value" ? value || finalTargetValue : null,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Goal created successfully",
      data: {
        ...newGoal.toJSON(),
        isIndefinite: !defaultEndDate,
        durationInfo: !defaultEndDate
          ? `Indefinite goal starting from ${defaultStartDate.toLocaleDateString()}`
          : `Goal from ${defaultStartDate.toLocaleDateString()} to ${defaultEndDate.toLocaleDateString()}`,
      },
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

// Get all goals (not tied to specific dashboard)
exports.getAllGoals = async (req, res) => {
  try {
    const ownerId = req.adminId;

    const goals = await Goal.findAll({
      where: {
        ownerId,
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

// Add goal to dashboard
exports.addGoalToDashboard = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { dashboardId } = req.body;
    const ownerId = req.adminId;

    // Verify goal ownership
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

    await goal.update({
      dashboardId,
    });

    res.status(200).json({
      success: true,
      message: "Goal added to dashboard successfully",
      data: goal,
    });
  } catch (error) {
    console.error("Error adding goal to dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add goal to dashboard",
      error: error.message,
    });
  }
};

exports.getGoalsForDashboard = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const ownerId = req.adminId;

    // If no dashboardId provided, return all goals for user
    if (!dashboardId || dashboardId === "all") {
      const goals = await Goal.findAll({
        where: {
          ownerId,
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

      return res.status(200).json({
        success: true,
        data: goalsWithProgress,
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
      frequency,
      startDate,
      endDate,
      description,
      assignee,
      assignId,
      pipeline,
      trackingMetric,
      count,
      value,
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
      period: frequency || period || goal.period,
      startDate: startDate || goal.startDate,
      endDate: endDate || goal.endDate,
      description: description !== undefined ? description : goal.description,
      assignee: assignee !== undefined ? assignee : goal.assignee,
      assignId: assignId !== undefined ? assignId : goal.assignId,
      pipeline: pipeline !== undefined ? pipeline : goal.pipeline,
      trackingMetric: trackingMetric || goal.trackingMetric,
      count: count !== undefined ? count : goal.count,
      value: value !== undefined ? value : goal.value,
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

// Get filtered data for a specific goal
exports.getGoalData = async (req, res) => {
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

    const {
      entity,
      goalType,
      assignee,
      assignId,
      pipeline,
      startDate,
      endDate,
      trackingMetric,
    } = goal;

    // Build where clause based on goal criteria
    // For indefinite goals (endDate is null), track from startDate to current date
    const currentDate = new Date();
    const effectiveEndDate = endDate || currentDate;

    const whereClause = {
      createdAt: {
        [Op.between]: [startDate, effectiveEndDate],
      },
    };

    // Add assignee filter based on assignId and assignee values
    if (assignId && assignId !== "everyone") {
      // Specific user assigned
      whereClause.masterUserID = assignId;
    } else if (
      assignee &&
      assignee !== "All" &&
      assignee !== "Company (everyone)" &&
      assignee !== "everyone"
    ) {
      // Legacy assignee field (for backward compatibility)
      whereClause.masterUserID = assignee;
    }
    // If assignId is "everyone" or assignee is "Company (everyone)" or "All", don't add user filter to get all data

    // Add pipeline filter if specified
    if (pipeline && entity === "Deal") {
      whereClause.pipeline = pipeline;
    }

    let data = [];
    let summary = {};
    let monthlyBreakdown = [];

    if (entity === "Deal") {
      // Get deals based on goal criteria
      const deals = await Deal.findAll({
        where: whereClause,
        attributes: [
          "dealId",
          "title",
          "value",
          "pipeline",
          "pipelineStage",
          "status",
          "masterUserID",
          "createdAt",
          "updatedAt",
        ],
        order: [["createdAt", "DESC"]],
      });

      // Calculate summary based on goal type
      let filteredDeals = deals;
      if (goalType === "Won") {
        filteredDeals = deals.filter((deal) => deal.status === "won");
      } else if (goalType === "Progressed") {
        filteredDeals = deals.filter(
          (deal) => deal.pipelineStage !== "Qualified"
        );
      }

      data = filteredDeals.map((deal) => ({
        id: deal.dealId,
        title: deal.title,
        value: parseFloat(deal.value || 0),
        pipeline: deal.pipeline,
        stage: deal.pipelineStage,
        status: deal.status,
        owner: deal.masterUserID,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      }));

      // Calculate current value based on tracking metric
      const currentValue =
        trackingMetric === "Value"
          ? filteredDeals.reduce(
              (sum, deal) => sum + parseFloat(deal.value || 0),
              0
            )
          : filteredDeals.length;

      // Calculate summary
      summary = {
        totalCount: filteredDeals.length,
        totalValue: filteredDeals.reduce(
          (sum, deal) => sum + parseFloat(deal.value || 0),
          0
        ),
        goalTarget: parseFloat(goal.targetValue),
        trackingMetric: trackingMetric,
        progress: {
          current: currentValue,
          target: parseFloat(goal.targetValue),
          percentage: Math.min(
            100,
            Math.round((currentValue / parseFloat(goal.targetValue)) * 100)
          ),
        },
      };

      // Generate monthly breakdown based on goal's actual duration
      monthlyBreakdown = generateMonthlyBreakdown(
        filteredDeals,
        goal,
        trackingMetric,
        "Deal"
      );
    } else if (entity === "Activity") {
      const activities = await Activity.findAll({
        where: whereClause,
        attributes: [
          "activityId",
          "activityType",
          "subject",
          "masterUserID",
          "createdAt",
          "updatedAt",
        ],
        order: [["createdAt", "DESC"]],
      });

      data = activities.map((activity) => ({
        id: activity.activityId,
        type: activity.activityType,
        subject: activity.subject,
        owner: activity.masterUserID,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
      }));

      summary = {
        totalCount: activities.length,
        goalTarget: parseFloat(goal.targetValue),
        trackingMetric: trackingMetric,
        progress: {
          current: activities.length,
          target: parseFloat(goal.targetValue),
          percentage: Math.min(
            100,
            Math.round((activities.length / parseFloat(goal.targetValue)) * 100)
          ),
        },
      };

      // Generate monthly breakdown based on goal's actual duration
      monthlyBreakdown = generateMonthlyBreakdown(
        activities,
        goal,
        trackingMetric,
        "Activity"
      );
    } else if (entity === "Lead") {
      const leads = await Lead.findAll({
        where: whereClause,
        attributes: [
          "leadId",
          "firstName",
          "lastName",
          "email",
          "status",
          "masterUserID",
          "createdAt",
          "updatedAt",
        ],
        order: [["createdAt", "DESC"]],
      });

      data = leads.map((lead) => ({
        id: lead.leadId,
        name: `${lead.firstName} ${lead.lastName}`,
        email: lead.email,
        status: lead.status,
        owner: lead.masterUserID,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }));

      summary = {
        totalCount: leads.length,
        goalTarget: parseFloat(goal.targetValue),
        trackingMetric: trackingMetric,
        progress: {
          current: leads.length,
          target: parseFloat(goal.targetValue),
          percentage: Math.min(
            100,
            Math.round((leads.length / parseFloat(goal.targetValue)) * 100)
          ),
        },
      };

      // Generate monthly breakdown based on goal's actual duration
      monthlyBreakdown = generateMonthlyBreakdown(
        leads,
        goal,
        trackingMetric,
        "Lead"
      );
    }

    // Calculate comprehensive duration information
    const nowTime = new Date();
    const isIndefinite = !endDate || endDate === null;
    const goalStartDate = new Date(startDate);
    const goalEndDate = endDate ? new Date(endDate) : null;

    // Calculate periods based on frequency
    let totalPeriods = 1;
    let currentPeriod = 1;
    let periodType = goal.period || "Monthly";

    if (!isIndefinite && goalEndDate) {
      const totalMonths =
        (goalEndDate.getFullYear() - goalStartDate.getFullYear()) * 12 +
        (goalEndDate.getMonth() - goalStartDate.getMonth()) +
        1;

      if (periodType === "Monthly") {
        totalPeriods = totalMonths;
        currentPeriod = Math.min(
          totalPeriods,
          (nowTime.getFullYear() - goalStartDate.getFullYear()) * 12 +
            (nowTime.getMonth() - goalStartDate.getMonth()) +
            1
        );
      } else if (periodType === "Quarterly") {
        totalPeriods = Math.ceil(totalMonths / 3);
        currentPeriod = Math.min(
          totalPeriods,
          Math.ceil(
            ((nowTime.getFullYear() - goalStartDate.getFullYear()) * 12 +
              (nowTime.getMonth() - goalStartDate.getMonth()) +
              1) /
              3
          )
        );
      } else if (periodType === "Yearly") {
        totalPeriods = Math.ceil(totalMonths / 12);
        currentPeriod = Math.min(
          totalPeriods,
          Math.ceil(
            ((nowTime.getFullYear() - goalStartDate.getFullYear()) * 12 +
              (nowTime.getMonth() - goalStartDate.getMonth()) +
              1) /
              12
          )
        );
      }
    } else if (isIndefinite) {
      // For indefinite goals, calculate current period from start
      const monthsFromStart =
        (nowTime.getFullYear() - goalStartDate.getFullYear()) * 12 +
        (nowTime.getMonth() - goalStartDate.getMonth()) +
        1;

      if (periodType === "Monthly") {
        currentPeriod = monthsFromStart;
      } else if (periodType === "Quarterly") {
        currentPeriod = Math.ceil(monthsFromStart / 3);
      } else if (periodType === "Yearly") {
        currentPeriod = Math.ceil(monthsFromStart / 12);
      }
      totalPeriods = null; // Indefinite
    }

    const durationInfo = {
      startDate: startDate,
      endDate: endDate,
      isIndefinite: isIndefinite,
      frequency: periodType,
      totalPeriods: totalPeriods,
      currentPeriod: currentPeriod,
      durationDays: isIndefinite
        ? null
        : Math.ceil((goalEndDate - goalStartDate) / (1000 * 60 * 60 * 24)),
      isActive:
        nowTime >= goalStartDate && (isIndefinite || nowTime <= goalEndDate),
      timeRemaining: isIndefinite
        ? null
        : Math.max(
            0,
            Math.ceil((goalEndDate - nowTime) / (1000 * 60 * 60 * 24))
          ),
      timeElapsed: Math.max(
        0,
        Math.ceil((nowTime - goalStartDate) / (1000 * 60 * 60 * 24))
      ),
      status: isIndefinite
        ? "ongoing"
        : nowTime <= goalEndDate
        ? "active"
        : "expired",
      trackingPeriod: isIndefinite
        ? `From ${goalStartDate.toLocaleDateString()} onwards (indefinite)`
        : `${goalStartDate.toLocaleDateString()} to ${goalEndDate.toLocaleDateString()}`,
      periodProgress: totalPeriods
        ? `${currentPeriod} of ${totalPeriods} ${periodType.toLowerCase()} periods`
        : `${currentPeriod} ${periodType.toLowerCase()} period(s) elapsed`,
      targetPerPeriod: calculateTargetPerPeriod(
        goal.targetValue,
        periodType,
        totalPeriods
      ),
    };

    res.status(200).json({
      success: true,
      data: {
        goal: goal.toJSON(),
        records: data,
        summary: summary,
        monthlyBreakdown: monthlyBreakdown,
        period: {
          startDate: startDate,
          endDate: endDate,
        },
        duration: durationInfo,
        filters: {
          entity: entity,
          goalType: goalType,
          assignee: assignee,
          assignId: assignId,
          pipeline: pipeline,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching goal data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goal data",
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
  const {
    entity,
    goalType,
    targetValue,
    startDate,
    endDate,
    assignee,
    assignId,
    pipeline,
    trackingMetric,
  } = goal;

  // Handle indefinite goals (endDate is null)
  const currentDate = new Date();
  const effectiveEndDate = endDate || currentDate;

  const whereClause = {
    createdAt: {
      [Op.between]: [startDate, effectiveEndDate],
    },
  };

  // Add assignee filter based on assignId and assignee values
  if (assignId && assignId !== "everyone") {
    // Specific user assigned
    whereClause.masterUserID = assignId;
  } else if (
    assignee &&
    assignee !== "All" &&
    assignee !== "Company (everyone)" &&
    assignee !== "everyone"
  ) {
    // Legacy assignee field (for backward compatibility)
    whereClause.masterUserID = assignee;
  } else if (ownerId && !assignId && !assignee) {
    // Fallback to owner ID if no specific assignment
    whereClause[Op.or] = [{ masterUserID: ownerId }, { ownerId: ownerId }];
  }
  // If assignId is "everyone" or assignee is "Company (everyone)" or "All", don't add user filter to get all data

  // Add pipeline filter if specified
  if (pipeline && entity === "Deal") {
    whereClause.pipeline = pipeline;
  }

  let currentValue = 0;

  try {
    if (entity === "Deal") {
      if (goalType === "Added") {
        if (trackingMetric === "Value") {
          const result = await Deal.sum("value", { where: whereClause });
          currentValue = result || 0;
        } else {
          const count = await Deal.count({ where: whereClause });
          currentValue = count;
        }
      } else if (goalType === "Won") {
        const wonWhereClause = {
          ...whereClause,
          status: "won",
        };
        if (trackingMetric === "Value") {
          const result = await Deal.sum("value", { where: wonWhereClause });
          currentValue = result || 0;
        } else {
          const count = await Deal.count({ where: wonWhereClause });
          currentValue = count;
        }
      } else if (goalType === "Progressed") {
        // Count deals that moved stages
        const progressedWhereClause = {
          ...whereClause,
          pipelineStage: { [Op.ne]: "Qualified" },
        };
        if (trackingMetric === "Value") {
          const result = await Deal.sum("value", {
            where: progressedWhereClause,
          });
          currentValue = result || 0;
        } else {
          const count = await Deal.count({ where: progressedWhereClause });
          currentValue = count;
        }
      }
    } else if (entity === "Lead") {
      const count = await Lead.count({ where: whereClause });
      currentValue = count;
    } else if (entity === "Activity") {
      const count = await Activity.count({ where: whereClause });
      currentValue = count;
    } else if (entity === "Forecast") {
      // For forecast, calculate based on deal projections
      const result = await Deal.sum("value", {
        where: {
          ...whereClause,
          status: { [Op.in]: ["open", "qualified"] },
        },
      });
      currentValue = result || 0;
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

// Generate monthly breakdown based on goal's actual duration and frequency
function generateMonthlyBreakdown(records, goal, trackingMetric, entityType) {
  const { startDate, endDate, period, targetValue } = goal;
  const currentDate = new Date();
  const isIndefinite = !endDate || endDate === null;

  // Calculate effective end date for breakdown generation
  const effectiveEndDate = isIndefinite ? currentDate : new Date(endDate);
  const goalStartDate = new Date(startDate);

  // Calculate monthly target based on frequency
  let monthlyTarget = parseFloat(targetValue);
  if (period === "Quarterly") {
    monthlyTarget = parseFloat(targetValue) / 3; // Divide quarterly target by 3 months
  } else if (period === "Yearly") {
    monthlyTarget = parseFloat(targetValue) / 12; // Divide yearly target by 12 months
  }
  // For Monthly frequency, target remains the same

  const monthlyBreakdown = [];

  // Generate months from start date to effective end date
  let currentMonth = new Date(
    goalStartDate.getFullYear(),
    goalStartDate.getMonth(),
    1
  );

  while (currentMonth <= effectiveEndDate) {
    const monthStart = new Date(currentMonth);
    const monthEnd = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    );

    // Adjust first month to start from goal start date
    if (
      monthStart.getMonth() === goalStartDate.getMonth() &&
      monthStart.getFullYear() === goalStartDate.getFullYear()
    ) {
      monthStart.setDate(goalStartDate.getDate());
    }

    // Adjust last month to end at goal end date (if not indefinite)
    if (
      !isIndefinite &&
      monthEnd.getMonth() === new Date(endDate).getMonth() &&
      monthEnd.getFullYear() === new Date(endDate).getFullYear()
    ) {
      monthEnd.setDate(new Date(endDate).getDate());
    }

    // Filter records for this month
    const monthRecords = records.filter((record) => {
      const recordDate = new Date(record.createdAt);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Calculate result based on tracking metric and entity type
    let monthResult = 0;
    if (entityType === "Deal" && trackingMetric === "Value") {
      monthResult = monthRecords.reduce(
        (sum, deal) => sum + parseFloat(deal.value || 0),
        0
      );
    } else {
      monthResult = monthRecords.length; // Count for all other cases
    }

    // Calculate progress metrics
    const difference = monthResult - monthlyTarget;
    const percentage =
      monthResult > 0 ? Math.round((monthResult / monthlyTarget) * 100) : 0;

    // Format period display
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const periodDisplay = `${
      monthNames[currentMonth.getMonth()]
    } ${currentMonth.getFullYear()}`;

    monthlyBreakdown.push({
      period: periodDisplay,
      goal: monthlyTarget,
      result: monthResult,
      difference: difference,
      percentage: percentage,
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      recordCount: monthRecords.length,
      isCurrentMonth:
        currentMonth.getMonth() === currentDate.getMonth() &&
        currentMonth.getFullYear() === currentDate.getFullYear(),
      isFutureMonth: currentMonth > currentDate,
    });

    // Move to next month
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  return monthlyBreakdown;
}

// Calculate target per period based on frequency
function calculateTargetPerPeriod(totalTarget, frequency, totalPeriods) {
  const target = parseFloat(totalTarget);

  if (frequency === "Monthly") {
    return target; // Monthly targets remain the same
  } else if (frequency === "Quarterly") {
    return target / 3; // Quarterly target divided by 3 months
  } else if (frequency === "Yearly") {
    return target / 12; // Yearly target divided by 12 months
  }

  return target; // Default case
}
