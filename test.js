const DASHBOARD = require("../../models/insight/dashboardModel");
const Report = require("../../models/insight/reportModel");
const Goal = require("../../models/insight/goalModel");
const Deal = require("../../models/deals/dealsModels");
const DealStageHistory = require("../../models/deals/dealsStageHistoryModel");
const Lead = require("../../models/leads/leadsModel");
const Activity = require("../../models/activity/activityModel");
const MasterUser = require("../../models/master/masterUserModel");
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
      console.log(`[DEBUG] Processing folder request: "${folder}"`);

      // Handle special cases
      if (folder === "My dashboards") {
        console.log("[DEBUG] Using My dashboards folder");
        resolvedFolderName = "My dashboards";
        // Don't set parentId - keep it null for root level
      } else {
        console.log(`[DEBUG] Looking for existing folder: "${folder}"`);

        // Look for existing folder with the provided name
        let existingFolder = await DASHBOARD.findOne({
          where: {
            name: folder,
            ownerId,
            type: "folder",
            parentId: null,
          },
        });

        console.log(
          `[DEBUG] Existing folder found:`,
          existingFolder
            ? {
                id: existingFolder.dashboardId,
                name: existingFolder.name,
                folder: existingFolder.folder,
              }
            : "None"
        );

        if (!existingFolder) {
          console.log(`[DEBUG] Creating new folder: "${folder}"`);
          // Auto-create the folder if it doesn't exist
          existingFolder = await DASHBOARD.create({
            name: folder,
            folder: folder, // Set folder field to its own name
            type: "folder",
            parentId: null,
            ownerId,
          });
          console.log(
            `[DEBUG] Created folder with ID: ${existingFolder.dashboardId}`
          );
        }
        // Use the existing or newly created folder
        resolvedParentId = existingFolder.dashboardId;
        resolvedFolderName = existingFolder.name;
        console.log(
          `[DEBUG] Resolved parentId: ${resolvedParentId}, folderName: ${resolvedFolderName}`
        );
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
    console.log("[DEBUG] Grouping dashboards, total count:", dashboards.length);

    dashboards.forEach((dashboard) => {
      let folder;

      console.log(
        `[DEBUG] Processing item: ${dashboard.name} (type: ${dashboard.type}, folder: ${dashboard.folder})`
      );

      if (dashboard.type === "folder") {
        // Folders should appear as their own categories, not under "My dashboards"
        // Skip folders - they don't get grouped anywhere, they ARE the groups
        console.log(
          `[DEBUG] Skipping folder "${dashboard.name}" - folders are categories, not items`
        );
        return; // Skip processing folders
      } else {
        // Dashboards use their folder field value
        folder =
          dashboard.folder === null ||
          dashboard.folder === undefined ||
          dashboard.folder === ""
            ? "My dashboards"
            : dashboard.folder;
        console.log(
          `[DEBUG] Dashboard "${dashboard.name}" grouped under: ${folder}`
        );
      }

      if (!dashboardsByFolder[folder]) {
        dashboardsByFolder[folder] = [];
      }
      dashboardsByFolder[folder].push(dashboard);
    });

    console.log("[DEBUG] Final grouping:", Object.keys(dashboardsByFolder));

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
      folder: name, // Set folder field to its own name
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
          type: "Added",
          description: "Based on the number of activities that were created",
          metrics: ["count"],
        },
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
      pipelineStage,
      trackingMetric,
      count,
      value,
      activityType, // Add activityType field for Activity goals
      activityTypes, // Support multiple activity types
    } = req.body;
    const ownerId = req.adminId;

    // Validate required fields - dashboardId is now optional
    if (!entity || !goalType) {
      return res.status(400).json({
        success: false,
        message: "Entity and goal type are required",
      });
    }

    // Additional validation for "Progressed" goals
    if (goalType === "Progressed" && entity === "Deal") {
      if (!pipeline) {
        return res.status(400).json({
          success: false,
          message: "Pipeline is required for 'Progressed' deal goals",
        });
      }
      if (!pipelineStage) {
        return res.status(400).json({
          success: false,
          message: "Pipeline stage is required for 'Progressed' deal goals",
        });
      }
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

    // Determine display name for assignee
    let assigneeDisplay = "Everyone";
    if (assignId && assignId !== "everyone") {
      // Try to fetch user name from MasterUser if assignId is present and not 'everyone'

      const user = await MasterUser.findOne({
        where: { masterUserID: assignId },
      });
      if (user && user.name) {
        assigneeDisplay = user.name;
      } else if (assignee && assignee !== "All" && assignee !== "everyone") {
        assigneeDisplay = assignee;
      }
    } else if (assignee && assignee !== "All" && assignee !== "everyone") {
      assigneeDisplay = assignee;
    }

    // Build goal name for UI as in screenshot
    let goalName = description;
    if (!goalName) {
      if (entity === "Deal" && goalType === "Added") {
        goalName = `Deals added ${assigneeDisplay}`;
      } else if (entity === "Deal" && goalType === "Won") {
        goalName = `Deals won ${assigneeDisplay}`;
      } else if (entity === "Deal" && goalType === "Progressed") {
        goalName = `Deals progressed ${assigneeDisplay}`;
      } else if (entity === "Activity" && goalType === "Completed") {
        goalName = `Activities completed ${assigneeDisplay}`;
      } else {
        goalName = `${entity} ${goalType} ${assigneeDisplay}`;
      }
    }

    // Determine target value based on tracking metric
    let finalTargetValue = targetValue;
    if (trackingMetric === "Count" && count) {
      finalTargetValue = count;
    } else if (trackingMetric === "Value" && value) {
      finalTargetValue = value;
    }

    // Handle activity types for Activity goals
    let finalActivityType = null;
    if (entity === "Activity") {
      // Use activityTypes (multiple) or activityType (single)
      const selectedActivityTypes = activityTypes || activityType;
      if (selectedActivityTypes) {
        if (Array.isArray(selectedActivityTypes)) {
          finalActivityType = selectedActivityTypes.join(",");
        } else {
          finalActivityType = selectedActivityTypes;
        }
      }
    }

    // Get the next position for this dashboard
    let nextPosition = 0;
    if (dashboardId) {
      const existingGoals = await Goal.findAll({
        where: { dashboardId, isActive: true },
        order: [["position", "DESC"]],
        limit: 1,
      });
      if (existingGoals.length > 0) {
        nextPosition = (existingGoals[0].position || 0) + 1;
      }
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
      pipelineStage: pipelineStage || null, // Add pipelineStage field for "Progressed" goals
      activityType: finalActivityType || null, // Add activityType field for Activity goals
      trackingMetric: trackingMetric || "Count",
      count: trackingMetric === "Count" ? count || finalTargetValue : null,
      value: trackingMetric === "Value" ? value || finalTargetValue : null,
      position: nextPosition, // Add position field
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
    const now = new Date();

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

    // Group into Active and Past using createdAt date (1 month cutoff)
    const activeGoals = [];
    const pastGoals = [];
    goalsWithProgress.forEach((goal) => {
      const createdAt = new Date(goal.createdAt);
      // If createdAt is more than 1 month ago, show in Past
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      if (createdAt < oneMonthAgo) {
        pastGoals.push(goal);
      } else {
        activeGoals.push(goal);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        Active: activeGoals,
        Past: pastGoals,
      },
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
    const role = req.role;

    // For admin, do not filter by ownerId
    const goal = await Goal.findOne({
      where: role === "admin" ? { goalId } : { goalId, ownerId },
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found or access denied",
      });
    }

    // For admin, do not filter by ownerId
    const dashboard = await DASHBOARD.findOne({
      where: role === "admin" ? { dashboardId } : { dashboardId, ownerId },
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
    const role = req.role;

    // If no dashboardId provided, return all goals for user
    if (!dashboardId || dashboardId === "all") {
      const goals = await Goal.findAll({
        where:
          role === "admin" ? { isActive: true } : { ownerId, isActive: true },
        order: [
          ["position", "ASC"],
          ["createdAt", "DESC"],
        ],
      });

      // Calculate progress for each goal
      const goalsWithProgress = await Promise.all(
        goals.map(async (goal) => {
          const progress = await calculateGoalProgress(goal, ownerId);
          return {
            ...goal.toJSON(),
            progress,
            isDraggable: true, // Add flag for frontend to show drag handle
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: goalsWithProgress,
      });
    }

    // Verify dashboard ownership (admin can access all dashboards)
    const dashboard = await DASHBOARD.findOne({
      where: role === "admin" ? { dashboardId } : { dashboardId, ownerId },
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
      order: [
        ["position", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateGoalProgress(goal, ownerId);
        return {
          ...goal.toJSON(),
          progress,
          isDraggable: true, // Add flag for frontend to show drag handle
          position: goal.position || 0, // Ensure position is included
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
      pipelineStage,
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
      pipelineStage:
        pipelineStage !== undefined ? pipelineStage : goal.pipelineStage,
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

// Reorder goals on dashboard (for drag and drop functionality)
exports.reorderGoals = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { goalOrders } = req.body; // Array of objects: [{goalId: 'id1', position: 0}, {goalId: 'id2', position: 1}, ...]
    const ownerId = req.adminId;
    const role = req.role;

    // Validate input
    if (!Array.isArray(goalOrders) || goalOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Goal orders array is required",
      });
    }

    // Verify dashboard ownership
    const dashboard = await DASHBOARD.findOne({
      where: role === "admin" ? { dashboardId } : { dashboardId, ownerId },
    });

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: "Dashboard not found or access denied",
      });
    }

    // Get all goals for this dashboard to verify they exist
    const existingGoals = await Goal.findAll({
      where: {
        dashboardId,
        isActive: true,
      },
    });

    const existingGoalIds = existingGoals.map((goal) => goal.goalId);

    // Validate that all provided goalIds exist in this dashboard
    const providedGoalIds = goalOrders.map((order) => order.goalId);
    const invalidGoalIds = providedGoalIds.filter(
      (id) => !existingGoalIds.includes(id)
    );

    if (invalidGoalIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid goal IDs: ${invalidGoalIds.join(", ")}`,
      });
    }

    // Update positions for each goal
    const updatePromises = goalOrders.map(({ goalId, position }) => {
      return Goal.update(
        { position: position || 0 },
        {
          where:
            role === "admin"
              ? { goalId, dashboardId }
              : { goalId, dashboardId, ownerId },
        }
      );
    });

    await Promise.all(updatePromises);

    // Fetch updated goals to return
    const updatedGoals = await Goal.findAll({
      where: {
        dashboardId,
        isActive: true,
      },
      order: [
        ["position", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    res.status(200).json({
      success: true,
      message: "Goals reordered successfully",
      data: updatedGoals,
    });
  } catch (error) {
    console.error("Error reordering goals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reorder goals",
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

// Get filtered data for a specific goal or all goals in a dashboard
exports.getGoalData = async (req, res) => {
  try {
    const { goalId, dashboardId } = req.params;
    const ownerId = req.adminId;
    const role = req.role;
    const periodFilter = req.query.periodFilter; // e.g. 'yesterday', 'this_week', 'last_month', etc.

    // Support both single goal and dashboard-level queries
    let goals = [];

    if (goalId && goalId !== "dashboard") {
      // Single goal query (existing functionality)
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

      goals = [goal];
    } else if (dashboardId || goalId === "dashboard") {
      // Dashboard-level query (new functionality)
      const targetDashboardId = dashboardId || req.query.dashboardId;

      if (!targetDashboardId) {
        return res.status(400).json({
          success: false,
          message: "Dashboard ID is required for dashboard-level goal data",
        });
      }

      // Verify dashboard ownership (admin can access all dashboards)
      const dashboard = await DASHBOARD.findOne({
        where:
          role === "admin"
            ? { dashboardId: targetDashboardId }
            : { dashboardId: targetDashboardId, ownerId },
      });

      if (!dashboard) {
        return res.status(404).json({
          success: false,
          message: "Dashboard not found or access denied",
        });
      }

      // Get all goals for this dashboard
      goals = await Goal.findAll({
        where: {
          dashboardId: targetDashboardId,
          isActive: true,
        },
        order: [
          ["position", "ASC"],
          ["createdAt", "DESC"],
        ],
      });

      if (goals.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No active goals found for this dashboard",
          data: {
            goals: [],
            summary: {
              totalGoals: 0,
              completedGoals: 0,
              avgProgress: 0,
            },
          },
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Either goalId or dashboardId is required",
      });
    }

    // Process each goal to get detailed data
    const goalsWithData = await Promise.all(
      goals.map(async (goal) => {
        const goalData = await processGoalData(goal, ownerId, periodFilter);
        return goalData;
      })
    );

    // If single goal, return single goal format for backward compatibility
    if (goalId && goalId !== "dashboard") {
      return res.status(200).json({
        success: true,
        data: goalsWithData[0],
      });
    }

    // For dashboard queries, return array format with summary
    const completedGoals = goalsWithData.filter(
      (g) => g.summary.progress.percentage >= 100
    ).length;
    const avgProgress =
      goalsWithData.length > 0
        ? Math.round(
            goalsWithData.reduce(
              (sum, g) => sum + g.summary.progress.percentage,
              0
            ) / goalsWithData.length
          )
        : 0;

    res.status(200).json({
      success: true,
      data: {
        goals: goalsWithData,
        summary: {
          totalGoals: goalsWithData.length,
          completedGoals: completedGoals,
          avgProgress: avgProgress,
          dashboardId: dashboardId || req.query.dashboardId,
          periodFilter: periodFilter || "goal_duration",
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

// Helper function to process individual goal data (extracted from original getGoalData)
async function processGoalData(goal, ownerId, periodFilter) {
  const {
    entity,
    goalType,
    assignee,
    assignId,
    pipeline,
    pipelineStage,
    startDate,
    endDate,
    trackingMetric,
  } = goal;

  // Helper function to get date range for period filters
  function getPeriodRange(filter) {
    const now = new Date();
    let start, end;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch ((filter || "").toLowerCase()) {
      case "yesterday":
        start = new Date(today);
        start.setDate(start.getDate() - 1);
        end = new Date(today);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case "today":
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "tomorrow":
        start = new Date(today);
        start.setDate(start.getDate() + 1);
        end = new Date(today);
        end.setDate(end.getDate() + 1);
        end.setHours(23, 59, 59, 999);
        break;
      case "this_week":
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay());
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "last_week":
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay() - 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "next_week":
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay() + 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        break;
      case "last_month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "next_month":
        start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        end = new Date(
          now.getFullYear(),
          now.getMonth() + 2,
          0,
          23,
          59,
          59,
          999
        );
        break;
      case "this_quarter": {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
        end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
        break;
      }
      case "last_quarter": {
        const q = Math.floor(now.getMonth() / 3);
        const year = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const quarter = q === 0 ? 3 : q - 1;
        start = new Date(year, quarter * 3, 1);
        end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
        break;
      }
      case "next_quarter": {
        const q = Math.floor(now.getMonth() / 3);
        const year = q === 3 ? now.getFullYear() + 1 : now.getFullYear();
        const quarter = q === 3 ? 0 : q + 1;
        start = new Date(year, quarter * 3, 1);
        end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
        break;
      }
      case "this_year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case "last_year":
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
      case "next_year":
        start = new Date(now.getFullYear() + 1, 0, 1);
        end = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
        break;
      case "month_to_date":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case "quarter_to_date": {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
        end = now;
        break;
      }
      case "year_to_date":
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      case "past_7_days":
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "past_2_weeks":
        start = new Date(today);
        start.setDate(start.getDate() - 13);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "next_7_days":
        start = new Date(today);
        end = new Date(today);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "next_2_weeks":
        start = new Date(today);
        end = new Date(today);
        end.setDate(end.getDate() + 13);
        end.setHours(23, 59, 59, 999);
        break;
      case "past_1_month":
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        end = now;
        break;
      case "past_3_months":
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        end = now;
        break;
      case "past_6_months":
        start = new Date(now);
        start.setMonth(start.getMonth() - 6);
        end = now;
        break;
      case "past_12_months":
        start = new Date(now);
        start.setMonth(start.getMonth() - 12);
        end = now;
        break;
      case "next_3_months":
        start = now;
        end = new Date(now);
        end.setMonth(end.getMonth() + 3);
        break;
      case "next_6_months":
        start = now;
        end = new Date(now);
        end.setMonth(end.getMonth() + 6);
        break;
      case "next_12_months":
        start = now;
        end = new Date(now);
        end.setMonth(end.getMonth() + 12);
        break;
      case "goal_duration":
      default:
        // Use goal's startDate and endDate (or current date if indefinite)
        start = startDate;
        end = endDate || now;
    }
    return { start, end };
  }

  // Build where clause based on goal criteria and period filter
  let start, end;
  try {
    ({ start, end } = getPeriodRange(periodFilter));
    // If start or end is invalid, fallback to goal duration
    if (
      !start ||
      !end ||
      isNaN(new Date(start).getTime()) ||
      isNaN(new Date(end).getTime())
    ) {
      start = startDate;
      end = endDate || new Date();
    }
  } catch (e) {
    // Fallback to goal duration if getPeriodRange fails
    start = startDate;
    end = endDate || new Date();
  }

  const whereClause = {
    createdAt: {
      [Op.between]: [start, end],
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

  // Add pipeline filter if specified
  if (pipeline && entity === "Deal") {
    if (pipeline.includes(",")) {
      // Multiple pipelines (comma-separated)
      const pipelines = pipeline
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p !== "");
      whereClause.pipeline = {
        [Op.in]: pipelines,
      };
    } else {
      // Single pipeline
      whereClause.pipeline = pipeline;
    }
  }

  let data = [];
  let summary = {};
  let monthlyBreakdown = [];

  // Process based on entity type - using simplified logic for dashboard view
  if (entity === "Deal") {
    if (goalType === "Added") {
      const addedDeals = await Deal.findAll({
        where: whereClause,
        attributes: [
          "dealId",
          "title",
          "value",
          "pipeline",
          "status",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
      });

      // Assign fetched deals to data array for records
      data = addedDeals;

      const currentValue =
        trackingMetric === "Value"
          ? addedDeals.reduce(
              (sum, deal) => sum + parseFloat(deal.value || 0),
              0
            )
          : addedDeals.length;

      summary = {
        totalCount: addedDeals.length,
        totalValue: addedDeals.reduce(
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

      monthlyBreakdown =
        goal.period === "Weekly"
          ? generateWeeklyBreakdown(
              addedDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            )
          : goal.period === "Quarterly"
          ? generateQuarterlyBreakdown(
              addedDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            )
          : generateMonthlyBreakdown(
              addedDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            );
    } else if (goalType === "Won") {
      const wonWhereClause = {
        ...whereClause,
        status: "won",
        updatedAt: {
          [Op.between]: [start, end],
        },
      };

      const wonDeals = await Deal.findAll({
        where: wonWhereClause,
        attributes: [
          "dealId",
          "title",
          "value",
          "pipeline",
          "pipelineStage",
          "status",
          "masterUserID",
          "updatedAt",
        ],
        order: [["updatedAt", "DESC"]],
      });

      // Assign fetched deals to data array for records
      data = wonDeals;

      const currentValue =
        trackingMetric === "Value"
          ? wonDeals.reduce((sum, deal) => sum + parseFloat(deal.value || 0), 0)
          : wonDeals.length;

      summary = {
        totalCount: wonDeals.length,
        totalValue: wonDeals.reduce(
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

      monthlyBreakdown =
        goal.period === "Weekly"
          ? generateWeeklyBreakdown(
              wonDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            )
          : goal.period === "Quarterly"
          ? generateQuarterlyBreakdown(
              wonDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            )
          : generateMonthlyBreakdown(
              wonDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            );
    } else if (goalType === "Progressed") {
      // Count deals that moved to specific stage or progressed beyond qualified
      let progressedWhereClause = { ...whereClause };
      if (pipelineStage) {
        // Track deals entering specific pipeline stage
        progressedWhereClause.pipelineStage = pipelineStage;
      } else {
        // Fallback: deals that progressed beyond "Qualified"
        progressedWhereClause.pipelineStage = { [Op.ne]: "Qualified" };
      }

      const progressedDeals = await Deal.findAll({
        where: progressedWhereClause,
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
        order: [["updatedAt", "DESC"]],
      });

      // Assign fetched deals to data array for records
      data = progressedDeals;

      const currentValue =
        trackingMetric === "Value"
          ? progressedDeals.reduce(
              (sum, deal) => sum + parseFloat(deal.value || 0),
              0
            )
          : progressedDeals.length;

      summary = {
        totalCount: progressedDeals.length,
        totalValue: progressedDeals.reduce(
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

      monthlyBreakdown =
        goal.period === "Weekly"
          ? generateWeeklyBreakdownForProgressed(
              progressedDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            )
          : goal.period === "Quarterly"
          ? generateQuarterlyBreakdownForProgressed(
              progressedDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            )
          : generateMonthlyBreakdownForProgressed(
              progressedDeals,
              goal,
              trackingMetric,
              "Deal",
              start,
              end
            );
    }
    // Add other goal types as needed...
  } else if (entity === "Activity") {
    const activityWhereClause = { ...whereClause };

    // Add activity type filter
    if (goal.activityType && goal.activityType !== "all") {
      if (goal.activityType.includes(",")) {
        const activityTypes = goal.activityType
          .split(",")
          .map((type) => type.trim());
        activityWhereClause.type = { [Op.in]: activityTypes };
      } else {
        activityWhereClause.type = goal.activityType;
      }
    }

    // Add completion filter for "Completed" goals
    if (goalType === "Completed") {
      activityWhereClause.isDone = true;
    }

    const activities = await Activity.findAll({
      where: activityWhereClause,
      attributes: ["activityId", "type", "subject", "isDone", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    // Assign fetched activities to data array for records
    data = activities;

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

    monthlyBreakdown =
      goal.period === "Weekly"
        ? generateWeeklyBreakdown(
            activities,
            goal,
            trackingMetric,
            "Activity",
            start,
            end
          )
        : goal.period === "Quarterly"
        ? generateQuarterlyBreakdown(
            activities,
            goal,
            trackingMetric,
            "Activity",
            start,
            end
          )
        : generateMonthlyBreakdown(
            activities,
            goal,
            trackingMetric,
            "Activity",
            start,
            end
          );
  } else if (entity === "Lead") {
    const leads = await Lead.findAll({
      where: whereClause,
      attributes: ["leadId", "firstName", "lastName", "status", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    // Assign fetched leads to data array for records
    data = leads;

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

    monthlyBreakdown =
      goal.period === "Weekly"
        ? generateWeeklyBreakdown(
            leads,
            goal,
            trackingMetric,
            "Lead",
            start,
            end
          )
        : goal.period === "Quarterly"
        ? generateQuarterlyBreakdown(
            leads,
            goal,
            trackingMetric,
            "Lead",
            start,
            end
          )
        : generateMonthlyBreakdown(
            leads,
            goal,
            trackingMetric,
            "Lead",
            start,
            end
          );
  }

  // Calculate duration info
  const nowTime = new Date();
  const isIndefinite = !endDate || endDate === null;
  const goalStartDate = new Date(startDate);
  const goalEndDate = endDate ? new Date(endDate) : null;

  const durationInfo = {
    startDate: startDate,
    endDate: endDate,
    isIndefinite: isIndefinite,
    frequency: goal.period || "Monthly",
    isActive:
      nowTime >= goalStartDate && (isIndefinite || nowTime <= goalEndDate),
    status: isIndefinite
      ? "ongoing"
      : nowTime <= goalEndDate
      ? "active"
      : "expired",
  };

  return {
    goal: goal.toJSON(),
    records: data,
    summary: summary,
    monthlyBreakdown: monthlyBreakdown,
    period: { startDate: start, endDate: end },
    duration: durationInfo,
    filters: {
      entity: entity,
      goalType: goalType,
      assignee: assignee,
      assignId: assignId,
      pipeline: pipeline,
      pipelineStage: pipelineStage,
      activityType: entity === "Activity" ? goal.activityType : null,
    },
  };
}
exports.getProgressedGoalData = async (req, res) => {
  try {
    const { goalId } = req.params;
    const ownerId = req.adminId;
    const periodFilter = req.query.periodFilter; // e.g. 'yesterday', 'this_week', 'last_month', etc.

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
      pipelineStage,
      startDate,
      endDate,
      trackingMetric,
    } = goal;

    // Helper function to get date range for period filters
    function getPeriodRange(filter) {
      const now = new Date();
      let start, end;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch ((filter || "").toLowerCase()) {
        case "yesterday":
          start = new Date(today);
          start.setDate(start.getDate() - 1);
          end = new Date(today);
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          break;
        case "today":
          start = new Date(today);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case "tomorrow":
          start = new Date(today);
          start.setDate(start.getDate() + 1);
          end = new Date(today);
          end.setDate(end.getDate() + 1);
          end.setHours(23, 59, 59, 999);
          break;
        case "this_week":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay());
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "last_week":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay() - 7);
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "next_week":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay() + 7);
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "last_two_weeks":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay() - 14);
          end = new Date(today);
          end.setDate(end.getDate() - end.getDay() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "this_month":
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          );
          break;
        case "last_month":
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case "next_month":
          start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          end = new Date(
            now.getFullYear(),
            now.getMonth() + 2,
            0,
            23,
            59,
            59,
            999
          );
          break;
        case "this_quarter": {
          const q = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), q * 3, 1);
          end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
          break;
        }
        case "last_quarter": {
          const q = Math.floor(now.getMonth() / 3);
          const year = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
          const quarter = q === 0 ? 3 : q - 1;
          start = new Date(year, quarter * 3, 1);
          end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
          break;
        }
        case "next_quarter": {
          const q = Math.floor(now.getMonth() / 3);
          const year = q === 3 ? now.getFullYear() + 1 : now.getFullYear();
          const quarter = q === 3 ? 0 : q + 1;
          start = new Date(year, quarter * 3, 1);
          end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
          break;
        }
        case "this_year":
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        case "last_year":
          start = new Date(now.getFullYear() - 1, 0, 1);
          end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
          break;
        case "next_year":
          start = new Date(now.getFullYear() + 1, 0, 1);
          end = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
          break;
        case "month_to_date":
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = now;
          break;
        case "quarter_to_date": {
          const q = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), q * 3, 1);
          end = now;
          break;
        }
        case "year_to_date":
          start = new Date(now.getFullYear(), 0, 1);
          end = now;
          break;
        case "past_7_days":
          start = new Date(today);
          start.setDate(start.getDate() - 6);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case "past_2_weeks":
          start = new Date(today);
          start.setDate(start.getDate() - 13);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case "next_7_days":
          start = new Date(today);
          end = new Date(today);
          end.setDate(end.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "next_2_weeks":
          start = new Date(today);
          end = new Date(today);
          end.setDate(end.getDate() + 13);
          end.setHours(23, 59, 59, 999);
          break;
        case "past_1_month":
          start = new Date(now);
          start.setMonth(start.getMonth() - 1);
          end = now;
          break;
        case "past_3_months":
          start = new Date(now);
          start.setMonth(start.getMonth() - 3);
          end = now;
          break;
        case "past_6_months":
          start = new Date(now);
          start.setMonth(start.getMonth() - 6);
          end = now;
          break;
        case "past_12_months":
          start = new Date(now);
          start.setMonth(start.getMonth() - 12);
          end = now;
          break;
        case "next_3_months":
          start = now;
          end = new Date(now);
          end.setMonth(end.getMonth() + 3);
          break;
        case "next_6_months":
          start = now;
          end = new Date(now);
          end.setMonth(end.getMonth() + 6);
          break;
        case "next_12_months":
          start = now;
          end = new Date(now);
          end.setMonth(end.getMonth() + 12);
          break;
        case "goal_duration":
        default:
          // Use goal's startDate and endDate (or current date if indefinite)
          start = startDate;
          end = endDate || now;
      }
      return { start, end };
    }

    // Build where clause based on goal criteria and period filter
    let start, end;
    try {
      ({ start, end } = getPeriodRange(periodFilter));
      // If start or end is invalid, fallback to goal duration
      if (
        !start ||
        !end ||
        isNaN(new Date(start).getTime()) ||
        isNaN(new Date(end).getTime())
      ) {
        start = startDate;
        end = endDate || new Date();
      }
    } catch (e) {
      // Fallback to goal duration if getPeriodRange fails
      start = startDate;
      end = endDate || new Date();
    }
    const whereClause = {
      createdAt: {
        [Op.between]: [start, end],
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
      if (pipeline.includes(",")) {
        // Multiple pipelines (comma-separated)
        const pipelines = pipeline
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p !== "");
        whereClause.pipeline = {
          [Op.in]: pipelines,
        };
      } else {
        // Single pipeline
        whereClause.pipeline = pipeline;
      }
    }

    let data = [];
    let summary = {};
    let monthlyBreakdown = [];

    if (entity === "Deal") {
      // Handle different goal types with specific logic
      if (goalType === "Progressed") {
        // Use DealStageHistory for accurate stage progression tracking
        if (pipelineStage) {
          // Query DealStageHistory to find deals that entered this stage during the period
          const stageEntries = await DealStageHistory.findAll({
            where: {
              stageName: pipelineStage,
              enteredAt: {
                [Op.between]: [start, end],
              },
            },
            include: [
              {
                model: Deal,
                as: "Deal",
                where: {
                  ...(assignId && assignId !== "everyone"
                    ? { masterUserID: assignId }
                    : {}),
                  ...(assignee &&
                  assignee !== "All" &&
                  assignee !== "Company (everyone)" &&
                  assignee !== "everyone" &&
                  (!assignId || assignId === "everyone")
                    ? { masterUserID: assignee }
                    : {}),
                  ...(pipeline
                    ? pipeline.includes(",")
                      ? {
                          pipeline: {
                            [Op.in]: pipeline
                              .split(",")
                              .map((p) => p.trim())
                              .filter((p) => p !== ""),
                          },
                        }
                      : { pipeline: pipeline }
                    : {}),
                },
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
              },
            ],
            order: [["enteredAt", "DESC"]],
          });

          // Format the data for frontend with stage entry information
          data = stageEntries.map((entry) => ({
            id: entry.Deal.dealId,
            title: entry.Deal.title,
            value: parseFloat(entry.Deal.value || 0),
            pipeline: entry.Deal.pipeline,
            stage: entry.Deal.pipelineStage,
            status: entry.Deal.status,
            owner: entry.Deal.masterUserID,
            enteredStageAt: entry.enteredAt,
            createdAt: entry.Deal.createdAt,
            updatedAt: entry.Deal.updatedAt,
          }));

          // Calculate current value based on tracking metric
          const currentValue =
            trackingMetric === "Value"
              ? data.reduce((sum, deal) => sum + deal.value, 0)
              : data.length;

          // Calculate summary
          summary = {
            totalCount: data.length,
            totalValue: data.reduce((sum, deal) => sum + deal.value, 0),
            goalTarget: parseFloat(goal.targetValue),
            trackingMetric: trackingMetric,
            targetStage: pipelineStage,
            progress: {
              current: currentValue,
              target: parseFloat(goal.targetValue),
              percentage: Math.min(
                100,
                Math.round((currentValue / parseFloat(goal.targetValue)) * 100)
              ),
            },
          };

          // Generate breakdown by stage entry date (weekly, quarterly, or monthly based on period)
          monthlyBreakdown =
            goal.period === "Weekly"
              ? generateWeeklyBreakdownForProgressed(
                  stageEntries,
                  goal,
                  trackingMetric
                )
              : goal.period === "Quarterly"
              ? generateQuarterlyBreakdownForProgressed(
                  stageEntries,
                  goal,
                  trackingMetric
                )
              : generateMonthlyBreakdownForProgressed(
                  stageEntries,
                  goal,
                  trackingMetric
                );
        } else {
          return res.status(400).json({
            success: false,
            message: "Pipeline stage is required for progressed goals",
          });
        }
      } else if (goalType === "Added") {
        // ...existing code for Added...
        const addedDeals = await Deal.findAll({
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
        data = addedDeals.map((deal) => ({
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
        const currentValue =
          trackingMetric === "Value"
            ? data.reduce((sum, deal) => sum + deal.value, 0)
            : data.length;
        summary = {
          totalCount: data.length,
          totalValue: data.reduce((sum, deal) => sum + deal.value, 0),
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
        monthlyBreakdown =
          goal.period === "Weekly"
            ? generateWeeklyBreakdown(
                addedDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              )
            : goal.period === "Quarterly"
            ? generateQuarterlyBreakdown(
                addedDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              )
            : generateMonthlyBreakdown(
                addedDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              );
      } else if (goalType === "Won") {
        // Efficiently get only won deals in the period, applying all filters
        const wonWhereClause = {
          ...whereClause,
          status: "won",
          updatedAt: {
            [Op.between]: [start, end],
          },
        };
        const wonDeals = await Deal.findAll({
          where: wonWhereClause,
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
          order: [["updatedAt", "DESC"]],
        });
        data = wonDeals.map((deal) => ({
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
        const currentValue =
          trackingMetric === "Value"
            ? data.reduce((sum, deal) => sum + deal.value, 0)
            : data.length;
        summary = {
          totalCount: data.length,
          totalValue: data.reduce((sum, deal) => sum + deal.value, 0),
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
        monthlyBreakdown =
          goal.period === "Weekly"
            ? generateWeeklyBreakdown(
                wonDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              )
            : goal.period === "Quarterly"
            ? generateQuarterlyBreakdown(
                wonDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              )
            : generateMonthlyBreakdown(
                wonDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              );
      } else {
        // Unsupported goal type for Deal entity
        return res.status(400).json({
          success: false,
          message: `Unsupported goal type '${goalType}' for Deal entity. Supported types: Added, Progressed, Won`,
        });
      }

      // Add periodSummary for UI table (Goal, Result, Difference, Goal progress)
      if (Array.isArray(monthlyBreakdown) && monthlyBreakdown.length > 0) {
        summary.periodSummary = monthlyBreakdown.map((period) => {
          // For weekly breakdown: period.goal, for monthly breakdown: period.goalTarget
          // period.label: e.g. "Jul 2025" or "W31 2025" based on breakdown type
          // period.result: actual value for this period
          const goalValue = period.goal || period.goalTarget || 0;
          const result = period.result || 0;
          const difference = result - goalValue;
          const goalProgress =
            goalValue > 0 ? `${Math.round((result / goalValue) * 100)}%` : "0%";
          return {
            period: period.label || period.period || "",
            goal: goalValue,
            result,
            difference,
            goalProgress,
          };
        });
      }
    } else if (entity === "Activity") {
      // For Activity goals, use separate activityType and pipeline fields
      const activityTypeFilter = goal.activityType; // Use dedicated activityType field
      const pipelineFilter = goal.pipeline; // Pipeline is separate for Activity goals

      // Build where clause for activities
      const activityWhereClause = { ...whereClause };

      // Add activity type filter if specified
      if (activityTypeFilter && activityTypeFilter !== "all") {
        if (activityTypeFilter.includes(",")) {
          // Multiple activity types (comma-separated)
          const activityTypes = activityTypeFilter
            .split(",")
            .map((type) => type.trim());
          activityWhereClause.type = {
            [Op.in]: activityTypes,
          };
        } else {
          // Single activity type
          activityWhereClause.type = activityTypeFilter;
        }
      }

      // Handle goalType-specific filtering
      if (goalType === "Completed") {
        // For completed activities, filter by completion status
        activityWhereClause.isDone = true; // Use 'isDone' field for completion status
      } else if (goalType === "Added") {
        // For added activities, no additional filter needed - count all activities in date range
        // The date range filtering is already handled by whereClause
      }

      // Add pipeline filter by checking linked deals
      // Activities must be linked to deals in the specified pipeline(s)
      let includeClause = [];
      if (
        pipelineFilter &&
        pipelineFilter !== "All pipelines" &&
        pipelineFilter !== "all"
      ) {
        let pipelineWhereClause = {};

        if (pipelineFilter.includes(",")) {
          // Multiple pipelines (comma-separated)
          const pipelines = pipelineFilter
            .split(",")
            .map((pipeline) => pipeline.trim())
            .filter((pipeline) => pipeline !== "");
          pipelineWhereClause.pipeline = {
            [Op.in]: pipelines,
          };
        } else {
          // Single pipeline
          pipelineWhereClause.pipeline = pipelineFilter;
        }

        includeClause.push({
          model: Deal,
          where: pipelineWhereClause,
          required: true, // INNER JOIN - only activities linked to deals in these pipelines
          attributes: ["dealId", "pipeline", "title"], // Include deal info in response
        });
      } else {
        // If no pipeline filter, still include deal info but make it optional
        includeClause.push({
          model: Deal,
          required: false, // LEFT JOIN - include activities even if not linked to deals
          attributes: ["dealId", "pipeline", "title"],
        });
      }

      const activities = await Activity.findAll({
        where: activityWhereClause,
        include: includeClause, // Include deal information for pipeline filtering
        attributes: [
          "activityId",
          "type", // Use 'type' instead of 'activityType'
          "subject",
          "dealId", // Include dealId to show linked deal
          "isDone", // Include completion status
          "masterUserID",
          "createdAt",
          "updatedAt",
        ],
        order: [["createdAt", "DESC"]],
      });

      data = activities.map((activity) => ({
        id: activity.activityId,
        type: activity.type, // Use 'type' instead of 'activityType'
        subject: activity.subject,
        dealId: activity.dealId,
        dealTitle: activity.Deal ? activity.Deal.title : null, // Include linked deal title
        pipeline: activity.Deal ? activity.Deal.pipeline : null, // Include pipeline from linked deal
        isDone: activity.isDone, // Include completion status
        owner: activity.masterUserID,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
      }));

      summary = {
        totalCount: activities.length,
        goalTarget: parseFloat(goal.targetValue),
        trackingMetric: trackingMetric,
        activityTypeFilter: activityTypeFilter, // Include filter info in response
        pipelineFilter: pipelineFilter, // Include pipeline filter info
        goalType: goalType, // Include goal type in response
        filterDescription:
          pipelineFilter &&
          pipelineFilter !== "all" &&
          pipelineFilter !== "All pipelines"
            ? `${goalType} activities of type "${
                activityTypeFilter || "any"
              }" linked to deals in "${
                pipelineFilter.includes(",")
                  ? pipelineFilter
                      .split(",")
                      .map((p) => p.trim())
                      .join(", ") + " pipelines"
                  : pipelineFilter + " pipeline"
              }"`
            : `${goalType} activities of type "${activityTypeFilter || "any"}"${
                pipelineFilter ? " (any pipeline)" : ""
              }`,
        progress: {
          current: activities.length,
          target: parseFloat(goal.targetValue),
          percentage: Math.min(
            100,
            Math.round((activities.length / parseFloat(goal.targetValue)) * 100)
          ),
        },
      };

      // Generate breakdown for Activity goals based on period setting
      monthlyBreakdown =
        goal.period === "Weekly"
          ? generateWeeklyBreakdown(
              activities,
              goal,
              trackingMetric,
              "Activity",
              start,
              end
            )
          : goal.period === "Quarterly"
          ? generateQuarterlyBreakdown(
              activities,
              goal,
              trackingMetric,
              "Activity",
              start,
              end
            )
          : generateMonthlyBreakdown(
              activities,
              goal,
              trackingMetric,
              "Activity",
              start,
              end
            );

      // Add periodSummary for UI table (Goal, Result, Difference, Goal progress)
      if (Array.isArray(monthlyBreakdown) && monthlyBreakdown.length > 0) {
        summary.periodSummary = monthlyBreakdown.map((period) => {
          // For weekly breakdown: period.goal, for monthly breakdown: period.goalTarget
          // period.label: e.g. "W31 2025" for weekly or "Jul 2025" for monthly
          // period.result: actual value for this period
          const goalValue = period.goal || period.goalTarget || 0;
          const result = period.result || 0;
          const difference = result - goalValue;
          const goalProgress =
            goalValue > 0 ? `${Math.round((result / goalValue) * 100)}%` : "0%";
          return {
            period: period.label || period.period || "",
            goal: goalValue,
            result,
            difference,
            goalProgress,
          };
        });
      }
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

      // Generate breakdown based on goal's period setting
      monthlyBreakdown =
        goal.period === "Weekly"
          ? generateWeeklyBreakdown(
              leads,
              goal,
              trackingMetric,
              "Lead",
              start,
              end
            )
          : goal.period === "Quarterly"
          ? generateQuarterlyBreakdown(
              leads,
              goal,
              trackingMetric,
              "Lead",
              start,
              end
            )
          : generateMonthlyBreakdown(
              leads,
              goal,
              trackingMetric,
              "Lead",
              start,
              end
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
          pipeline: pipeline, // Show pipeline for all entities (Activity goals filter by linked deal pipeline)
          pipelineStage: pipelineStage,
          activityType: entity === "Activity" ? goal.activityType : null, // Show activity type for Activity goals from dedicated field
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

// Get progressed goal data with detailed stage tracking
exports.getProgressedGoalData = async (req, res) => {
  try {
    const { goalId } = req.params;
    const ownerId = req.adminId;
    const periodFilter = req.query.periodFilter;

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

    // Check if goal type is supported (Progressed or Added)
    if (
      (goal.goalType !== "Progressed" && goal.goalType !== "Added") ||
      goal.entity !== "Deal"
    ) {
      return res.status(400).json({
        success: false,
        message: "This endpoint is only for 'Progressed' or 'Added' deal goals",
      });
    }

    const {
      assignee,
      assignId,
      pipeline,
      pipelineStage,
      startDate,
      endDate,
      trackingMetric,
    } = goal;

    // Use the same date range logic as getGoalData
    function getPeriodRange(filter) {
      const now = new Date();
      let start, end;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch ((filter || "").toLowerCase()) {
        case "yesterday":
          start = new Date(today);
          start.setDate(start.getDate() - 1);
          end = new Date(today);
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          break;
        case "today":
          start = new Date(today);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case "tomorrow":
          start = new Date(today);
          start.setDate(start.getDate() + 1);
          end = new Date(today);
          end.setDate(end.getDate() + 1);
          end.setHours(23, 59, 59, 999);
          break;
        case "this_week":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay());
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "last_week":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay() - 7);
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "next_week":
          start = new Date(today);
          start.setDate(start.getDate() - start.getDay() + 7);
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "this_month":
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          );
          break;
        case "last_month":
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case "next_month":
          start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          end = new Date(
            now.getFullYear(),
            now.getMonth() + 2,
            0,
            23,
            59,
            59,
            999
          );
          break;
        case "this_quarter": {
          const q = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), q * 3, 1);
          end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
          break;
        }
        case "last_quarter": {
          const q = Math.floor(now.getMonth() / 3);
          const year = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
          const quarter = q === 0 ? 3 : q - 1;
          start = new Date(year, quarter * 3, 1);
          end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
          break;
        }
        case "next_quarter": {
          const q = Math.floor(now.getMonth() / 3);
          const year = q === 3 ? now.getFullYear() + 1 : now.getFullYear();
          const quarter = q === 3 ? 0 : q + 1;
          start = new Date(year, quarter * 3, 1);
          end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
          break;
        }
        case "this_year":
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          break;
        case "last_year":
          start = new Date(now.getFullYear() - 1, 0, 1);
          end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
          break;
        case "next_year":
          start = new Date(now.getFullYear() + 1, 0, 1);
          end = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
          break;
        case "month_to_date":
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = now;
          break;
        case "quarter_to_date": {
          const q = Math.floor(now.getMonth() / 3);
          start = new Date(now.getFullYear(), q * 3, 1);
          end = now;
          break;
        }
        case "year_to_date":
          start = new Date(now.getFullYear(), 0, 1);
          end = now;
          break;
        case "past_7_days":
          start = new Date(today);
          start.setDate(start.getDate() - 6);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case "past_2_weeks":
          start = new Date(today);
          start.setDate(start.getDate() - 13);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case "next_7_days":
          start = new Date(today);
          end = new Date(today);
          end.setDate(end.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "next_2_weeks":
          start = new Date(today);
          end = new Date(today);
          end.setDate(end.getDate() + 13);
          end.setHours(23, 59, 59, 999);
          break;
        case "past_1_month":
          start = new Date(now);
          start.setMonth(start.getMonth() - 1);
          end = now;
          break;
        case "past_3_months":
          start = new Date(now);
          start.setMonth(start.getMonth() - 3);
          end = now;
          break;
        case "past_6_months":
          start = new Date(now);
          start.setMonth(start.getMonth() - 6);
          end = now;
          break;
        case "next_3_months":
          start = now;
          end = new Date(now);
          end.setMonth(end.getMonth() + 3);
          break;
        case "next_6_months":
          start = now;
          end = new Date(now);
          end.setMonth(end.getMonth() + 6);
          break;
        case "past_12_months":
          start = new Date(now);
          start.setMonth(start.getMonth() - 12);
          end = now;
          break;
        case "next_12_months":
          start = now;
          end = new Date(now);
          end.setMonth(end.getMonth() + 12);
          break;
        case "goal_duration":
        default:
          start = startDate;
          end = endDate || now;
      }
      return { start, end };
    }

    let start, end;
    try {
      ({ start, end } = getPeriodRange(periodFilter));
      if (
        !start ||
        !end ||
        isNaN(new Date(start).getTime()) ||
        isNaN(new Date(end).getTime())
      ) {
        start = startDate;
        end = endDate || new Date();
      }
    } catch (e) {
      start = startDate;
      end = endDate || new Date();
    }

    // Build where clause for deals based on goal type
    const whereClause = {};

    // Add assignee filter
    if (assignId && assignId !== "everyone") {
      whereClause.masterUserID = assignId;
    } else if (
      assignee &&
      assignee !== "All" &&
      assignee !== "Company (everyone)" &&
      assignee !== "everyone"
    ) {
      whereClause.masterUserID = assignee;
    }

    // Add pipeline filter
    if (pipeline) {
      if (pipeline.includes(",")) {
        // Multiple pipelines (comma-separated)
        const pipelines = pipeline
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p !== "");
        whereClause.pipeline = {
          [Op.in]: pipelines,
        };
      } else {
        // Single pipeline
        whereClause.pipeline = pipeline;
      }
    }

    let data = [];
    let summary = {};
    let monthlyBreakdown = [];

    // Handle different goal types
    if (goal.goalType === "Progressed") {
      // Track deals that entered the specific pipeline stage during the period
      if (pipelineStage) {
        // Query DealStageHistory to find deals that entered this stage during the period
        const stageEntries = await DealStageHistory.findAll({
          where: {
            stageName: pipelineStage,
            enteredAt: {
              [Op.between]: [start, end],
            },
          },
          include: [
            {
              model: Deal,
              as: "Deal",
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
            },
          ],
          order: [["enteredAt", "DESC"]],
        });

        // Format the data for frontend
        data = stageEntries.map((entry) => ({
          id: entry.Deal.dealId,
          title: entry.Deal.title,
          value: parseFloat(entry.Deal.value || 0),
          pipeline: entry.Deal.pipeline,
          stage: entry.Deal.pipelineStage,
          status: entry.Deal.status,
          owner: entry.Deal.masterUserID,
          enteredStageAt: entry.enteredAt,
          createdAt: entry.Deal.createdAt,
          updatedAt: entry.Deal.updatedAt,
        }));

        // Calculate current value based on tracking metric
        const currentValue =
          trackingMetric === "Value"
            ? data.reduce((sum, deal) => sum + deal.value, 0)
            : data.length;

        // Calculate summary
        summary = {
          totalCount: data.length,
          totalValue: data.reduce((sum, deal) => sum + deal.value, 0),
          goalTarget: parseFloat(goal.targetValue),
          trackingMetric: trackingMetric,
          targetStage: pipelineStage,
          progress: {
            current: currentValue,
            target: parseFloat(goal.targetValue),
            percentage: Math.min(
              100,
              Math.round((currentValue / parseFloat(goal.targetValue)) * 100)
            ),
          },
        };

        // Generate monthly breakdown by stage entry date
        monthlyBreakdown = generateMonthlyBreakdownForProgressed(
          stageEntries,
          goal,
          trackingMetric
        );
      } else {
        return res.status(400).json({
          success: false,
          message: "Pipeline stage is required for progressed goals",
        });
      }
    } else if (goal.goalType === "Added") {
      // Track deals that were added (created) during the period
      const addedWhereClause = {
        ...whereClause,
        createdAt: {
          [Op.between]: [start, end],
        },
      };

      // Get all deals that were added during the period
      const addedDeals = await Deal.findAll({
        where: addedWhereClause,
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

      // Format the data for frontend
      data = addedDeals.map((deal) => ({
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
          ? data.reduce((sum, deal) => sum + deal.value, 0)
          : data.length;

      // Calculate summary
      summary = {
        totalCount: data.length,
        totalValue: data.reduce((sum, deal) => sum + deal.value, 0),
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

      // Generate monthly breakdown for added deals
      monthlyBreakdown = generateMonthlyBreakdown(
        addedDeals,
        goal,
        trackingMetric,
        "Deal"
      );
    }

    // Enhanced duration info
    const nowTime = new Date();
    const isIndefinite = !endDate || endDate === null;
    const goalStartDate = new Date(startDate);
    const goalEndDate = endDate ? new Date(endDate) : null;

    const durationInfo = {
      startDate: startDate,
      endDate: endDate,
      isIndefinite: isIndefinite,
      frequency: goal.period || "Monthly",
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
    };

    res.status(200).json({
      success: true,
      data: {
        goal: goal.toJSON(),
        records: data,
        summary: summary,
        monthlyBreakdown: monthlyBreakdown,
        period: {
          startDate: start,
          endDate: end,
        },
        duration: durationInfo,
        filters: {
          entity: goal.entity,
          goalType: goal.goalType,
          assignee: assignee,
          assignId: assignId,
          pipeline: pipeline,
          pipelineStage: pipelineStage,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching progressed goal data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch progressed goal data",
      error: error.message,
    });
  }
};
// Get progressed goal data (legacy endpoint)

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

// Helper function to generate breakdown data for goals (used in getGoalsForDashboard)
async function generateGoalBreakdownData(
  goal,
  ownerId,
  periodFilter = "goal_duration"
) {
  const {
    entity,
    goalType,
    assignee,
    assignId,
    pipeline,
    pipelineStage,
    startDate,
    endDate,
    trackingMetric,
    activityType,
  } = goal;

  // Helper function to get date range for period filters
  function getPeriodRange(filter) {
    const now = new Date();
    let start, end;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch ((filter || "").toLowerCase()) {
      case "yesterday":
        start = new Date(today);
        start.setDate(start.getDate() - 1);
        end = new Date(today);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case "today":
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "this_week":
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay());
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "last_week":
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay() - 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        break;
      case "last_month":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "this_year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case "last_year":
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
      case "goal_duration":
      default:
        // Use goal's startDate and endDate (or current date if indefinite)
        start = startDate;
        end = endDate || now;
    }
    return { start, end };
  }

  // Build where clause based on goal criteria and period filter
  let start, end;
  try {
    ({ start, end } = getPeriodRange(periodFilter));
    // If start or end is invalid, fallback to goal duration
    if (
      !start ||
      !end ||
      isNaN(new Date(start).getTime()) ||
      isNaN(new Date(end).getTime())
    ) {
      start = startDate;
      end = endDate || new Date();
    }
  } catch (e) {
    // Fallback to goal duration if getPeriodRange fails
    start = startDate;
    end = endDate || new Date();
  }

  const whereClause = {
    createdAt: {
      [Op.between]: [start, end],
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

  // Add pipeline filter if specified
  if (pipeline && entity === "Deal") {
    if (pipeline.includes(",")) {
      // Multiple pipelines (comma-separated)
      const pipelines = pipeline
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p !== "");
      whereClause.pipeline = {
        [Op.in]: pipelines,
      };
    } else {
      // Single pipeline
      whereClause.pipeline = pipeline;
    }
  }

  let breakdown = [];
  let summary = {};

  try {
    if (entity === "Deal") {
      // Handle different goal types with specific logic
      if (goalType === "Progressed") {
        // Use DealStageHistory for accurate stage progression tracking
        if (pipelineStage) {
          const stageHistoryWhereClause = {
            newStage: pipelineStage,
            updatedAt: {
              [Op.between]: [start, end],
            },
          };

          // Add pipeline filter to stage history
          if (pipeline) {
            if (pipeline.includes(",")) {
              const pipelines = pipeline
                .split(",")
                .map((p) => p.trim())
                .filter((p) => p !== "");
              stageHistoryWhereClause.pipeline = {
                [Op.in]: pipelines,
              };
            } else {
              stageHistoryWhereClause.pipeline = pipeline;
            }
          }

          // Add assignee filter by joining with Deal
          const includeClause = [];
          if (assignId && assignId !== "everyone") {
            includeClause.push({
              model: Deal,
              where: { masterUserID: assignId },
              required: true,
            });
          } else if (
            assignee &&
            assignee !== "All" &&
            assignee !== "Company (everyone)" &&
            assignee !== "everyone"
          ) {
            includeClause.push({
              model: Deal,
              where: { masterUserID: assignee },
              required: true,
            });
          }

          const stageEntries = await DealStageHistory.findAll({
            where: stageHistoryWhereClause,
            include: includeClause,
            attributes: [
              "dealId",
              "oldStage",
              "newStage",
              "pipeline",
              "updatedAt",
              "dealValue",
            ],
            order: [["updatedAt", "DESC"]],
          });

          const currentValue =
            trackingMetric === "Value"
              ? stageEntries.reduce(
                  (sum, entry) => sum + parseFloat(entry.dealValue || 0),
                  0
                )
              : stageEntries.length;

          summary = {
            totalCount: stageEntries.length,
            totalValue: stageEntries.reduce(
              (sum, entry) => sum + parseFloat(entry.dealValue || 0),
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

          // Generate breakdown by stage entry date
          breakdown =
            goal.period === "Weekly"
              ? generateWeeklyBreakdownForProgressed(
                  stageEntries,
                  goal,
                  trackingMetric,
                  start,
                  end
                )
              : generateMonthlyBreakdownForProgressed(
                  stageEntries,
                  goal,
                  trackingMetric,
                  start,
                  end
                );
        }
      } else if (goalType === "Added") {
        const addedDeals = await Deal.findAll({
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
          ],
          order: [["createdAt", "DESC"]],
        });

        const currentValue =
          trackingMetric === "Value"
            ? addedDeals.reduce(
                (sum, deal) => sum + parseFloat(deal.value || 0),
                0
              )
            : addedDeals.length;

        summary = {
          totalCount: addedDeals.length,
          totalValue: addedDeals.reduce(
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

        breakdown =
          goal.period === "Weekly"
            ? generateWeeklyBreakdown(
                addedDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              )
            : generateMonthlyBreakdown(
                addedDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              );
      } else if (goalType === "Won") {
        const wonWhereClause = {
          ...whereClause,
          status: "won",
          updatedAt: {
            [Op.between]: [start, end],
          },
        };

        const wonDeals = await Deal.findAll({
          where: wonWhereClause,
          attributes: [
            "dealId",
            "title",
            "value",
            "pipeline",
            "pipelineStage",
            "status",
            "masterUserID",
            "updatedAt",
          ],
          order: [["updatedAt", "DESC"]],
        });

        const currentValue =
          trackingMetric === "Value"
            ? wonDeals.reduce(
                (sum, deal) => sum + parseFloat(deal.value || 0),
                0
              )
            : wonDeals.length;

        summary = {
          totalCount: wonDeals.length,
          totalValue: wonDeals.reduce(
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

        breakdown =
          goal.period === "Weekly"
            ? generateWeeklyBreakdown(
                wonDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              )
            : generateMonthlyBreakdown(
                wonDeals,
                goal,
                trackingMetric,
                "Deal",
                start,
                end
              );
      }
    } else if (entity === "Activity") {
      // Build where clause for activities
      const activityWhereClause = { ...whereClause };

      // Add activity type filter if specified
      if (activityType) {
        if (activityType.includes(",")) {
          // Multiple activity types (comma-separated)
          const activityTypes = activityType
            .split(",")
            .map((type) => type.trim())
            .filter((type) => type !== "");
          activityWhereClause.type = {
            [Op.in]: activityTypes,
          };
        } else {
          // Single activity type
          activityWhereClause.type = activityType;
        }
      }

      // Add pipeline filter for Activity goals via Deal association
      const includeClause = [];
      if (pipeline) {
        const dealWhereClause = {};
        if (pipeline.includes(",")) {
          const pipelines = pipeline
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
          dealWhereClause.pipeline = {
            [Op.in]: pipelines,
          };
        } else {
          dealWhereClause.pipeline = pipeline;
        }

        includeClause.push({
          model: Deal,
          where: dealWhereClause,
          required: true,
        });
      }

      if (goalType === "Added") {
        const addedActivities = await Activity.findAll({
          where: activityWhereClause,
          include: includeClause,
          attributes: [
            "activityId",
            "type",
            "isDone",
            "masterUserID",
            "dealId",
            "createdAt",
          ],
          order: [["createdAt", "DESC"]],
        });

        const currentValue = addedActivities.length;

        summary = {
          totalCount: addedActivities.length,
          goalTarget: parseFloat(goal.targetValue),
          trackingMetric: "Count",
          progress: {
            current: currentValue,
            target: parseFloat(goal.targetValue),
            percentage: Math.min(
              100,
              Math.round((currentValue / parseFloat(goal.targetValue)) * 100)
            ),
          },
        };

        breakdown =
          goal.period === "Weekly"
            ? generateWeeklyBreakdown(
                addedActivities,
                goal,
                "Count",
                "Activity",
                start,
                end
              )
            : generateMonthlyBreakdown(
                addedActivities,
                goal,
                "Count",
                "Activity",
                start,
                end
              );
      } else if (goalType === "Completed") {
        activityWhereClause.isDone = true;

        const completedActivities = await Activity.findAll({
          where: activityWhereClause,
          include: includeClause,
          attributes: [
            "activityId",
            "type",
            "isDone",
            "masterUserID",
            "dealId",
            "updatedAt",
          ],
          order: [["updatedAt", "DESC"]],
        });

        const currentValue = completedActivities.length;

        summary = {
          totalCount: completedActivities.length,
          goalTarget: parseFloat(goal.targetValue),
          trackingMetric: "Count",
          progress: {
            current: currentValue,
            target: parseFloat(goal.targetValue),
            percentage: Math.min(
              100,
              Math.round((currentValue / parseFloat(goal.targetValue)) * 100)
            ),
          },
        };

        breakdown =
          goal.period === "Weekly"
            ? generateWeeklyBreakdown(
                completedActivities,
                goal,
                "Count",
                "Activity",
                start,
                end
              )
            : generateMonthlyBreakdown(
                completedActivities,
                goal,
                "Count",
                "Activity",
                start,
                end
              );
      }
    }
  } catch (error) {
    console.error("Error generating goal breakdown data:", error);
    breakdown = [];
    summary = {
      totalCount: 0,
      totalValue: 0,
      goalTarget: parseFloat(goal.targetValue),
      trackingMetric: trackingMetric || "Count",
      progress: {
        current: 0,
        target: parseFloat(goal.targetValue),
        percentage: 0,
      },
    };
  }

  return {
    breakdown,
    summary,
    periodInfo: {
      start,
      end,
      periodFilter,
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
    pipelineStage,
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
    if (pipeline.includes(",")) {
      // Multiple pipelines (comma-separated)
      const pipelines = pipeline
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p !== "");
      whereClause.pipeline = {
        [Op.in]: pipelines,
      };
    } else {
      // Single pipeline
      whereClause.pipeline = pipeline;
    }
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
        // Count deals that moved to specific stage or progressed beyond qualified
        let progressedWhereClause = { ...whereClause };
        if (pipelineStage) {
          // Track deals entering specific pipeline stage
          progressedWhereClause.pipelineStage = pipelineStage;
        } else {
          // Fallback: deals that progressed beyond "Qualified"
          progressedWhereClause.pipelineStage = { [Op.ne]: "Qualified" };
        }

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
function generateMonthlyBreakdown(
  records,
  goal,
  trackingMetric,
  entityType,
  filterStartDate = null,
  filterEndDate = null
) {
  const { startDate, endDate, period, targetValue } = goal;
  const currentDate = new Date();
  const isIndefinite = !endDate || endDate === null;

  // Use filter dates if provided, otherwise use goal dates
  const effectiveStartDate = filterStartDate
    ? new Date(filterStartDate)
    : new Date(startDate);
  const effectiveEndDate = filterEndDate
    ? new Date(filterEndDate)
    : isIndefinite
    ? new Date(currentDate.getFullYear() + 1, 0, 31) // Extend to end of January next year for indefinite goals
    : new Date(endDate);

  // Calculate monthly target based on frequency
  let monthlyTarget = parseFloat(targetValue);
  if (period === "Quarterly") {
    monthlyTarget = parseFloat(targetValue) / 3; // Divide quarterly target by 3 months
  } else if (period === "Yearly") {
    monthlyTarget = parseFloat(targetValue) / 12; // Divide yearly target by 12 months
  }
  // For Monthly frequency, target remains the same

  const monthlyBreakdown = [];

  // Generate months from effective start date to effective end date
  let currentMonth = new Date(
    effectiveStartDate.getFullYear(),
    effectiveStartDate.getMonth(),
    1
  );

  while (currentMonth <= effectiveEndDate) {
    const monthStart = new Date(currentMonth);
    const monthEnd = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    );

    // Adjust first month to start from effective start date
    if (
      monthStart.getMonth() === effectiveStartDate.getMonth() &&
      monthStart.getFullYear() === effectiveStartDate.getFullYear()
    ) {
      monthStart.setDate(effectiveStartDate.getDate());
    }

    // Adjust last month to end at effective end date
    if (
      monthEnd.getMonth() === effectiveEndDate.getMonth() &&
      monthEnd.getFullYear() === effectiveEndDate.getFullYear()
    ) {
      monthEnd.setDate(effectiveEndDate.getDate());
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

// Generate monthly breakdown for progressed goals based on stage entry dates
function generateMonthlyBreakdownForProgressed(
  stageEntries,
  goal,
  trackingMetric
) {
  if (!stageEntries || stageEntries.length === 0) return [];

  const monthlyData = new Map();

  stageEntries.forEach((entry) => {
    const entryDate = new Date(entry.enteredAt);
    const monthKey = `${entryDate.getFullYear()}-${String(
      entryDate.getMonth() + 1
    ).padStart(2, "0")}`;
    const monthLabel = entryDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        period: monthLabel,
        label: monthLabel,
        count: 0,
        value: 0,
        deals: [],
      });
    }

    const monthData = monthlyData.get(monthKey);
    monthData.count += 1;
    monthData.value += parseFloat(entry.Deal?.value || 0);
    monthData.deals.push(entry);
  });

  // Convert to array and sort by date
  const breakdown = Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => {
      const goalTarget = parseFloat(goal.targetValue);
      const result = trackingMetric === "Value" ? data.value : data.count;
      const difference = result - goalTarget;
      const goalProgress =
        goalTarget > 0 ? `${Math.round((result / goalTarget) * 100)}%` : "0%";

      return {
        period: data.period,
        label: data.label,
        goalTarget: goalTarget,
        result: result,
        difference: difference,
        goalProgress: goalProgress,
        count: data.count,
        value: data.value,
        deals: data.deals.length,
      };
    });

  return breakdown;
}

// Generate weekly breakdown for progressed goals based on stage entry dates
function generateWeeklyBreakdownForProgressed(
  stageEntries,
  goal,
  trackingMetric
) {
  if (!stageEntries || stageEntries.length === 0) return [];

  const weeklyData = new Map();

  // Helper function to get week number
  function getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  stageEntries.forEach((entry) => {
    const entryDate = new Date(entry.enteredAt);
    const weekNumber = getWeekNumber(entryDate);
    const year = entryDate.getFullYear();
    const weekKey = `${year}-W${weekNumber}`;
    const weekLabel = `W${weekNumber} ${year}`;

    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, {
        period: weekLabel,
        label: weekLabel,
        count: 0,
        value: 0,
        deals: [],
      });
    }

    const weekData = weeklyData.get(weekKey);
    weekData.count += 1;
    weekData.value += parseFloat(entry.Deal?.value || 0);
    weekData.deals.push(entry);
  });

  // Calculate weekly target based on goal duration
  const currentDate = new Date();
  const isIndefinite = !goal.endDate || goal.endDate === null;
  const effectiveEndDate = isIndefinite ? currentDate : new Date(goal.endDate);
  const goalStartDate = new Date(goal.startDate);
  const totalDays = Math.ceil(
    (effectiveEndDate - goalStartDate) / (1000 * 60 * 60 * 24)
  );
  const totalWeeks = Math.ceil(totalDays / 7);
  const weeklyTarget = parseFloat(goal.targetValue) / totalWeeks;

  // Convert to array and sort by date
  const breakdown = Array.from(weeklyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, data]) => {
      const goalTarget = weeklyTarget;
      const result = trackingMetric === "Value" ? data.value : data.count;
      const difference = result - goalTarget;
      const goalProgress =
        goalTarget > 0 ? `${Math.round((result / goalTarget) * 100)}%` : "0%";

      return {
        period: data.period,
        label: data.label,
        goal: goalTarget, // Use 'goal' key to match weekly breakdown format
        result: result,
        difference: difference,
        goalProgress: goalProgress,
        count: data.count,
        value: data.value,
        deals: data.deals.length,
      };
    });

  return breakdown;
}
function generateQuarterlyBreakdown(
  records,
  goal,
  trackingMetric,
  entityType,
  filterStartDate = null,
  filterEndDate = null
) {
  if (!records || records.length === 0) return [];

  const now = new Date();
  const startDate = filterStartDate || new Date(goal.startDate);
  const endDate =
    filterEndDate || (goal.endDate ? new Date(goal.endDate) : now);

  // Use the filtered date range, not the goal's full duration
  const effectiveStartDate = new Date(
    Math.max(startDate.getTime(), new Date(goal.startDate).getTime())
  );
  const effectiveEndDate = new Date(
    Math.min(
      endDate.getTime(),
      goal.endDate ? new Date(goal.endDate).getTime() : now.getTime()
    )
  );

  const quarterlyBreakdown = [];

  // Helper function to get quarter start date
  function getQuarterStart(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const quarterStartMonth = Math.floor(month / 3) * 3; // 0, 3, 6, or 9
    return new Date(year, quarterStartMonth, 1);
  }

  // Helper function to get quarter end date
  function getQuarterEnd(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const quarterEndMonth = Math.floor(month / 3) * 3 + 2; // 2, 5, 8, or 11
    return new Date(year, quarterEndMonth + 1, 0, 23, 59, 59, 999); // Last day of quarter
  }

  // Helper function to get quarter number (1-4)
  function getQuarterNumber(date) {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  // Calculate quarterly target based on goal's target and period
  let quarterlyTarget = parseFloat(goal.targetValue);
  if (goal.period === "Monthly") {
    quarterlyTarget = quarterlyTarget * 3; // 3 months per quarter
  } else if (goal.period === "Weekly") {
    quarterlyTarget = quarterlyTarget * 13; // ~13 weeks per quarter
  } else if (goal.period === "Yearly") {
    quarterlyTarget = quarterlyTarget / 4; // 4 quarters per year
  }
  // If goal.period === "Quarterly", use the target as-is

  // Start from the first quarter that intersects with effective start date
  let currentQuarterStart = getQuarterStart(effectiveStartDate);

  // Generate breakdown for each quarter within the effective period
  while (currentQuarterStart <= effectiveEndDate) {
    const quarterEnd = getQuarterEnd(currentQuarterStart);

    // Adjust quarter boundaries to fit within effective date range
    let quarterStart = new Date(
      Math.max(currentQuarterStart.getTime(), effectiveStartDate.getTime())
    );
    let quarterEndAdjusted = new Date(
      Math.min(quarterEnd.getTime(), effectiveEndDate.getTime())
    );

    // Don't process quarters that are entirely in the future beyond effective end date
    if (quarterStart > effectiveEndDate) {
      break;
    }

    // Filter records for this quarter
    const quarterRecords = records.filter((record) => {
      const recordDate = new Date(record.createdAt);
      return recordDate >= quarterStart && recordDate <= quarterEndAdjusted;
    });

    // Calculate result based on tracking metric and entity type
    let quarterResult = 0;
    if (entityType === "Deal" && trackingMetric === "Value") {
      quarterResult = quarterRecords.reduce(
        (sum, deal) => sum + parseFloat(deal.value || 0),
        0
      );
    } else {
      quarterResult = quarterRecords.length; // Count for all other cases
    }

    // Calculate progress metrics
    const difference = quarterResult - quarterlyTarget;
    const percentage =
      quarterlyTarget > 0
        ? Math.round((quarterResult / quarterlyTarget) * 100)
        : 0;

    // Format period display (Q3 2025 format)
    const quarterNumber = getQuarterNumber(currentQuarterStart);
    const year = currentQuarterStart.getFullYear();
    const periodDisplay = `Q${quarterNumber} ${year}`;

    // Check if this is the current quarter
    const currentQuarterStart_check = getQuarterStart(now);
    const isCurrentQuarter =
      currentQuarterStart.getTime() === currentQuarterStart_check.getTime();

    quarterlyBreakdown.push({
      period: periodDisplay,
      goal: quarterlyTarget, // Keep the actual quarterly target
      result: quarterResult,
      difference: difference,
      percentage: percentage,
      quarterStart: quarterStart.toISOString(),
      quarterEnd: quarterEndAdjusted.toISOString(),
      recordCount: quarterRecords.length,
      isCurrentQuarter: isCurrentQuarter,
      isFutureQuarter: currentQuarterStart > now,
      quarterNumber: quarterNumber,
      year: year,
    });

    // Move to next quarter
    currentQuarterStart = new Date(
      currentQuarterStart.getFullYear(),
      currentQuarterStart.getMonth() + 3,
      1
    );
  }

  return quarterlyBreakdown;
}
// Generate weekly breakdown specifically for Activity goals
function generateWeeklyBreakdown(
  records,
  goal,
  trackingMetric,
  entityType,
  filterStartDate = null,
  filterEndDate = null
) {
  const { startDate, endDate, period, targetValue } = goal;
  const currentDate = new Date();
  const isIndefinite = !endDate || endDate === null;

  // Use filter dates if provided, otherwise use goal dates
  const effectiveStartDate = filterStartDate
    ? new Date(filterStartDate)
    : new Date(startDate);
  const effectiveEndDate = filterEndDate
    ? new Date(filterEndDate)
    : isIndefinite
    ? new Date(currentDate.getFullYear() + 1, 0, 31) // Extend to end of January next year for indefinite goals
    : new Date(endDate);

  // Calculate weekly target based on goal duration and frequency
  let weeklyTarget = parseFloat(targetValue);

  // Calculate total weeks in the effective period
  const totalDays = Math.ceil(
    (effectiveEndDate - effectiveStartDate) / (1000 * 60 * 60 * 24)
  );
  const totalWeeks = Math.ceil(totalDays / 7);

  if (period === "Monthly" || period === "Quarterly" || period === "Yearly") {
    // For any frequency, distribute the total target across the actual weeks in the goal period
    weeklyTarget = parseFloat(targetValue) / totalWeeks;
  }
  // Round to reasonable decimal places
  weeklyTarget = Math.round(weeklyTarget * 100) / 100;

  const weeklyBreakdown = [];

  // Helper function to get week number
  function getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  // Helper function to get start of week (Monday)
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  // Helper function to get end of week (Sunday)
  function getEndOfWeek(date) {
    const startOfWeek = getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek;
  }

  // Start from the week containing the effective start date
  let currentWeekStart = getStartOfWeek(effectiveStartDate);

  while (currentWeekStart <= effectiveEndDate) {
    const weekStart = new Date(currentWeekStart);
    const weekEnd = getEndOfWeek(currentWeekStart);

    // Adjust first week to start from effective start date
    if (
      currentWeekStart <= effectiveStartDate &&
      weekEnd >= effectiveStartDate
    ) {
      weekStart.setTime(effectiveStartDate.getTime());
    }

    // Adjust last week to end at effective end date
    if (weekEnd >= effectiveEndDate) {
      weekEnd.setTime(effectiveEndDate.getTime());
    }

    // Don't process weeks that are entirely in the future beyond effective end date
    if (weekStart > effectiveEndDate) {
      break;
    }

    // Filter records for this week
    const weekRecords = records.filter((record) => {
      const recordDate = new Date(record.createdAt);
      return recordDate >= weekStart && recordDate <= weekEnd;
    });

    // Calculate result based on tracking metric and entity type
    let weekResult = 0;
    if (entityType === "Deal" && trackingMetric === "Value") {
      weekResult = weekRecords.reduce(
        (sum, deal) => sum + parseFloat(deal.value || 0),
        0
      );
    } else {
      weekResult = weekRecords.length; // Count for all other cases
    }

    // Calculate progress metrics
    const difference = weekResult - weeklyTarget;
    const percentage =
      weeklyTarget > 0 ? Math.round((weekResult / weeklyTarget) * 100) : 0;

    // Format period display (W31 2025 format)
    const weekNumber = getWeekNumber(currentWeekStart);
    const year = currentWeekStart.getFullYear();
    const periodDisplay = `W${weekNumber} ${year}`;

    // Check if this is the current week
    const currentWeekStart_check = getStartOfWeek(currentDate);
    const isCurrentWeek =
      currentWeekStart.getTime() === currentWeekStart_check.getTime();

    weeklyBreakdown.push({
      period: periodDisplay,
      goal: weeklyTarget, // Keep the actual weekly target (with decimals)
      result: weekResult,
      difference: difference,
      percentage: percentage,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      recordCount: weekRecords.length,
      isCurrentWeek: isCurrentWeek,
      isFutureWeek: currentWeekStart > currentDate,
      weekNumber: weekNumber,
      year: year,
    });

    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return weeklyBreakdown;
}