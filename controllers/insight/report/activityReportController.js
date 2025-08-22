const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Goal = require("../../../models/insight/goalModel");
const MasterUser = require("../../../models/master/masterUserModel");
const Activity = require("../../../models/activity/activityModel");
const ReportFolder = require("../../../models/insight/reportFolderModel");
const { Op, Sequelize } = require("sequelize");

exports.createActivityReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      filters,
      page = 1,
      limit = 6,
    } = req.body;
    const ownerId = req.adminId;
    const role = req.role;

    // Define available options for xaxis and yaxis
    const xaxisArray = [
      "Owner",
      "Team",
      "status",
      "type",
      "subject",
      "location",
      "priority",
      "subject",
      "contactPerson",
      "organization",
      "isDone",
      "startDateTime",
      "endDateTime",
      "createdAt"
    ];

    const yaxisArray = [
      "no of activities",
      "duration",
    ];

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if (entity && type && !reportId) {
      if (entity === "Activity" && type === "Performance") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Activity Performance reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateActivityPerformanceData(
            ownerId,
            role,
            xaxis,
            yaxis,
            filters,
            page,
            limit
          );
          reportData = result.data;
          paginationInfo = result.pagination;

          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            filters: filters || {}
          };

        } catch (error) {
          console.error("Error generating activity performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate activity performance data",
            error: error.message,
          });
        }
      }
    } else if (!entity && !type && reportId) {
      const existingReports = await Report.findOne({
        where: { reportId },
      });

      const {
        entity: existingentity,
        type: existingtype,
        config: configString,
      } = existingReports.dataValues;

      // Parse the config JSON string
      const config = JSON.parse(configString);
      const { xaxis: existingxaxis, yaxis: existingyaxis, filters: existingfilters } = config;

      if (existingentity === "Activity" && existingtype === "Performance") {
        // Validate required fields for performance reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Activity Performance reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateExistingActivityPerformanceData(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingfilters,
            page,
            limit
          );
          reportData = result.data;
          paginationInfo = result.pagination;

          reportConfig = {
            reportId,
            entity : existingentity,
            type :  existingtype,
            xaxis : existingxaxis,
            yaxis : existingyaxis,
            filters: existingfilters || {}
          };

        } catch (error) {
          console.error("Error generating activity performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate activity performance data",
            error: error.message,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Data generated successfully",
      data: reportData,
      pagination: paginationInfo,
      config: reportConfig,
      availableOptions: {
        xaxis: xaxisArray,
        yaxis: yaxisArray
      }
    });
  } catch (error) {
    console.error("Error creating reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create reports",
      error: error.message,
    });
  }
};

async function generateExistingActivityPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  filters,
  page = 1,
  limit = 6
) {
  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base where condition - only show activities owned by the user if not admin
  const baseWhere = {};

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  // Handle filters if provided
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      // Start with the first condition
      let combinedCondition = getConditionObject(
        validConditions[0].column,
        validConditions[0].operator,
        validConditions[0].value
      );

      // Add remaining conditions with their logical operators
      for (let i = 1; i < validConditions.length; i++) {
        const currentCondition = getConditionObject(
          validConditions[i].column,
          validConditions[i].operator,
          validConditions[i].value
        );

        const logicalOp = (
          filters.logicalOperators[i - 1] || "AND"
        ).toUpperCase();

        if (logicalOp === "AND") {
          combinedCondition = {
            [Op.and]: [combinedCondition, currentCondition],
          };
        } else {
          combinedCondition = {
            [Op.or]: [combinedCondition, currentCondition],
          };
        }
      }

      Object.assign(baseWhere, combinedCondition);
    }
  }

  // Handle special cases for xaxis (like Owner which needs join)
  let includeModels = [];
  let groupBy = [];
  let attributes = [];

  // Handle existingxaxis special cases
  if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "Team") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "team"],
      required: true,
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else {
    // Regular column from Activity table
    groupBy.push(existingxaxis);
    attributes.push([existingxaxis, "xValue"]);
  }

  // Handle existingyaxis
  if (existingyaxis === "no of activities") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("activityId")),
      "yValue",
    ]);
  } else if (existingyaxis === "duration") {
    // Calculate average duration in hours
    attributes.push([
      Sequelize.fn(
        "AVG",
        Sequelize.fn(
          "TIMESTAMPDIFF",
          Sequelize.literal("HOUR"),
          Sequelize.col("startDateTime"),
          Sequelize.col("endDateTime")
        )
      ),
      "yValue",
    ]);
  } else {
    // For other existingyaxis values, assume they're column names that need to be summed
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(existingyaxis)),
      "yValue",
    ]);
  }

  // Get total count for pagination
  const totalCountResult = await Activity.findAll({
    where: baseWhere,
    attributes: [
      [
        Sequelize.fn(
          "COUNT",
          Sequelize.fn("DISTINCT", Sequelize.col(groupBy[0]))
        ),
        "total",
      ],
    ],
    include: includeModels,
    raw: true,
  });

  const totalCount = parseInt(totalCountResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  // Execute query with pagination
  const results = await Activity.findAll({
    where: baseWhere,
    attributes: attributes,
    include: includeModels,
    group: groupBy,
    raw: true,
    order: [[Sequelize.literal("yValue"), "DESC"]],
    limit: limit,
    offset: offset,
  });

  // Format the results for the frontend
  const formattedResults = results.map((item) => ({
    label: item.xValue || "Unknown",
    value: item.yValue || 0,
  }));

  // Return data with pagination info
  return {
    data: formattedResults,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}


// Helper function to generate activity performance data with pagination
async function generateActivityPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
  filters,
  page = 1,
  limit = 6
) {
  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base where condition - only show activities owned by the user if not admin
  const baseWhere = {};

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  // Handle filters if provided
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      // Start with the first condition
      let combinedCondition = getConditionObject(
        validConditions[0].column,
        validConditions[0].operator,
        validConditions[0].value
      );

      // Add remaining conditions with their logical operators
      for (let i = 1; i < validConditions.length; i++) {
        const currentCondition = getConditionObject(
          validConditions[i].column,
          validConditions[i].operator,
          validConditions[i].value
        );

        const logicalOp = (
          filters.logicalOperators[i - 1] || "AND"
        ).toUpperCase();

        if (logicalOp === "AND") {
          combinedCondition = {
            [Op.and]: [combinedCondition, currentCondition],
          };
        } else {
          combinedCondition = {
            [Op.or]: [combinedCondition, currentCondition],
          };
        }
      }

      Object.assign(baseWhere, combinedCondition);
    }
  }

  // Handle special cases for xaxis (like Owner which needs join)
  let includeModels = [];
  let groupBy = [];
  let attributes = [];

  // Handle xaxis special cases
  if (xaxis === "Owner" || xaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "Team") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "team"],
      required: true,
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else {
    // Regular column from Activity table
    groupBy.push(xaxis);
    attributes.push([xaxis, "xValue"]);
  }

  // Handle yaxis
  if (yaxis === "no of activities") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("activityId")),
      "yValue",
    ]);
  } else if (yaxis === "duration") {
    // Calculate average duration in hours
    attributes.push([
      Sequelize.fn(
        "AVG",
        Sequelize.fn(
          "TIMESTAMPDIFF",
          Sequelize.literal("HOUR"),
          Sequelize.col("startDateTime"),
          Sequelize.col("endDateTime")
        )
      ),
      "yValue",
    ]);
  } else {
    // For other yaxis values, assume they're column names that need to be summed
    attributes.push([Sequelize.fn("SUM", Sequelize.col(yaxis)), "yValue"]);
  }

  // Get total count for pagination
  const totalCountResult = await Activity.findAll({
    where: baseWhere,
    attributes: [
      [
        Sequelize.fn(
          "COUNT",
          Sequelize.fn("DISTINCT", Sequelize.col(groupBy[0]))
        ),
        "total",
      ],
    ],
    include: includeModels,
    raw: true,
  });

  const totalCount = parseInt(totalCountResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  // Execute query with pagination
  const results = await Activity.findAll({
    where: baseWhere,
    attributes: attributes,
    include: includeModels,
    group: groupBy,
    raw: true,
    order: [[Sequelize.literal("yValue"), "DESC"]],
    limit: limit,
    offset: offset,
  });

  // Format the results for the frontend
  const formattedResults = results.map((item) => ({
    label: item.xValue || "Unknown",
    value: item.yValue || 0,
  }));

  // Return data with pagination info
  return {
    data: formattedResults,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// Helper function to convert operator strings to Sequelize operators
function getConditionObject(column, operator, value) {
  let conditionValue = value;

  // Handle different data types
  if (column === "isDone") {
    conditionValue = value === "true" || value === true;
  } else if (column.includes("Date") || column.includes("Time")) {
    conditionValue = new Date(value);
  } else if (!isNaN(value) && value !== "") {
    conditionValue = parseFloat(value);
  }

  switch (operator) {
    case ">":
      return { [column]: { [Op.gt]: conditionValue } };
    case "<":
      return { [column]: { [Op.lt]: conditionValue } };
    case "=":
      return { [column]: { [Op.eq]: conditionValue } };
    case "≠":
      return { [column]: { [Op.ne]: conditionValue } };
    case "contains":
      return { [column]: { [Op.like]: `%${conditionValue}%` } };
    case "startsWith":
      return { [column]: { [Op.like]: `${conditionValue}%` } };
    case "endsWith":
      return { [column]: { [Op.like]: `%${conditionValue}` } };
    case "isEmpty":
      return { [column]: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: "" }] } };
    case "isNotEmpty":
      return { [column]: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }] } };
    default:
      return { [column]: { [Op.eq]: conditionValue } };
  }
}

exports.saveActivityReport = async (req, res) => {
  try {
    const {
      dashboardId,
      folderId,
      name,
      entity,
      type,
      description,
      xaxis,
      yaxis,
      filters,
    } = req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (!entity || !type || !xaxis || !yaxis || !dashboardId || !folderId) {
      return res.status(400).json({
        success: false,
        message: "Entity, type, xaxis, and yaxis are required",
      });
    }

    // Verify dashboard ownership if dashboardId is provided
    if (dashboardId) {
      const dashboard = await DASHBOARD.findOne({
        where: { dashboardId, ownerId },
      });
      if (!dashboard) {
        return res.status(404).json({
          success: false,
          message: "Dashboard not found or access denied",
        });
      }
    }

    // Check if report already exists with same configuration (xaxis and yaxis)
    const allReports = await Report.findAll({
      where: {
        ownerId,
        entity,
        type
      }
    });

    // Find report with matching xaxis and yaxis in config
    const existingReport = allReports.find(report => {
      try {
        const config = typeof report.config === 'string' 
          ? JSON.parse(report.config) 
          : report.config;
        
        return config.xaxis === xaxis && config.yaxis === yaxis;
      } catch (error) {
        console.error('Error parsing config:', error);
        return false;
      }
    });

    let reportData = null;
    let report;

    // Generate report data (you can add your data generation logic here)
    // For example: reportData = await generateReportData(xaxis, yaxis, filters);

    // Prepare config object
    const configObj = {
      xaxis,
      yaxis,
      filters: filters || {},
      data: reportData,
    };

    if (existingReport) {
      // Update existing report
      const updateData = {
        ...(dashboardId !== undefined && { dashboardId }),
        ...(folderId !== undefined && { folderId }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        config: configObj,
      };

      await Report.update(updateData, {
        where: { reportId: existingReport.reportId }
      });

      report = await Report.findByPk(existingReport.reportId);
    } else {
      // Create new report
      const reportName = description || `${entity} ${type}`;
      
      // Get next position for dashboard
      let nextPosition = 0;
      if (dashboardId) {
        const lastReport = await Report.findOne({
          where: { dashboardId },
          order: [["position", "DESC"]],
        });
        nextPosition = lastReport ? (lastReport.position || 0) : 0;
      }

      report = await Report.create({
        dashboardId: dashboardId || null,
        folderId: folderId || null,
        entity,
        type,
        description: reportName,
        name: name || reportName,
        position: nextPosition,
        config: configObj,
        ownerId,
      });
    }

    res.status(existingReport ? 200 : 201).json({
      success: true,
      message: existingReport ? "Report updated successfully" : "Report created successfully",
      data: {
        ...report.toJSON(),
        config: report.config,
        reportData,
      }
    });

  } catch (error) {
    console.error("Error saving report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save report",
      error: error.message,
    });
  }
};


exports.updateActivityReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { dashboardId, folderId } = req.body;
    const ownerId = req.adminId;

    // Validate that reportId is provided
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }

    // Validate that at least one field is provided
    if (dashboardId === undefined && folderId === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one of dashboardId or folderId is required",
      });
    }

    // Find the report and verify ownership
    const report = await Report.findOne({
      where: {
        reportId,
        ownerId, // Ensure user can only update their own reports
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found or access denied",
      });
    }

    // Verify dashboard ownership if dashboardId is provided and changing
    if (dashboardId !== undefined && dashboardId !== report.dashboardId) {
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

    // Verify folder ownership if folderId is provided and changing
    if (folderId !== undefined && folderId !== report.folderId) {
      const folder = await ReportFolder.findOne({
        where: {
          reportFolderId: folderId,
          ownerId,
        },
      });

      if (!folder) {
        return res.status(404).json({
          success: false,
          message: "Folder not found or access denied",
        });
      }
    }

    // Prepare update data - only dashboardId and folderId
    const updateData = {};
    if (dashboardId !== undefined) updateData.dashboardId = dashboardId;
    if (folderId !== undefined) updateData.folderId = folderId;

    // Update the report
    const [updatedCount] = await Report.update(updateData, {
      where: {
        reportId,
        ownerId, // Ensure only the owner can update
      },
    });

    if (updatedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Report not found or no changes made",
      });
    }

    // Get the updated report
    const updatedReport = await Report.findOne({
      where: { reportId },
    });

    res.status(200).json({
      success: true,
      message: "Report updated successfully",
      data: updatedReport,
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

exports.deleteActivityReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const ownerId = req.adminId;

    // Validate that reportId is provided
    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }

    // Find the report and verify ownership
    const report = await Report.findOne({
      where: {
        reportId,
        ownerId, // Ensure user can only delete their own reports
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found or access denied",
      });
    }

    // Delete the report
    const deletedCount = await Report.destroy({
      where: {
        reportId,
        ownerId, // Ensure only the owner can delete
      },
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Report not found or already deleted",
      });
    }

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
      data: {
        reportId: parseInt(reportId),
        deleted: true,
      },
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

exports.getActivityReportSummary = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      filters,
      page = 1,
      limit = 200,
      search = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.body;

    const ownerId = req.adminId;
    const role = req.role;

    // Validate required fields
    // if (!entity || !type) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Entity and type are required",
    //   });
    // }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Base where condition
    const baseWhere = {};

    // If user is not admin, filter by ownerId
    if (role !== "admin") {
      baseWhere.masterUserID = ownerId;
    }

    // Handle search
    if (search) {
      baseWhere[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { type: { [Op.like]: `%${search}%` } },
        { priority: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { "$assignedUser.name$": { [Op.like]: `%${search}%` } },
      ];
    }

    // Handle filters if provided
    if (filters && filters.conditions) {
      const validConditions = filters.conditions.filter(
        (cond) => cond.value !== undefined && cond.value !== ""
      );

      if (validConditions.length > 0) {
        // Start with the first condition
        let combinedCondition = getConditionObject(
          validConditions[0].column,
          validConditions[0].operator,
          validConditions[0].value
        );

        // Add remaining conditions with their logical operators
        for (let i = 1; i < validConditions.length; i++) {
          const currentCondition = getConditionObject(
            validConditions[i].column,
            validConditions[i].operator,
            validConditions[i].value
          );

          const logicalOp = (
            filters.logicalOperators[i - 1] || "AND"
          ).toUpperCase();

          if (logicalOp === "AND") {
            combinedCondition = {
              [Op.and]: [combinedCondition, currentCondition],
            };
          } else {
            combinedCondition = {
              [Op.or]: [combinedCondition, currentCondition],
            };
          }
        }

        Object.assign(baseWhere, combinedCondition);
      }
    }

    // Build order clause
    const order = [];
    if (sortBy === "assignedUser") {
      order.push([
        { model: MasterUser, as: "assignedUser" },
        "name",
        sortOrder,
      ]);
    } else if (sortBy === "dueDate") {
      order.push(["endDateTime", sortOrder]);
    } else if (sortBy === "createdAt") {
      order.push(["createdAt", sortOrder]);
    } else {
      order.push([sortBy, sortOrder]);
    }

    // Include assigned user
    const include = [
      {
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name", "email"],
        required: false,
      },
    ];

    // Get total count
    const totalCount = await Activity.count({
      where: baseWhere,
      include: include,
    });

    // Get paginated results
    const activities = await Activity.findAll({
      where: baseWhere,
      include: include,
      order: order,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "activityId",
        "subject",
        "type",
        "priority",
        "status",
        "startDateTime",
        "endDateTime",
        "createdAt",
        "updatedAt",
      ],
    });

    // Generate report data (like your existing performance report)
    let reportData = [];
    let summary = {};

    if (xaxis && yaxis && !reportId) {
      const reportResult = await generateActivityPerformanceData(
        ownerId,
        role,
        xaxis,
        yaxis,
        filters,
        page,
        limit
      );
      reportData = reportResult.data;

      // Calculate summary statistics
      if (reportData.length > 0) {
        const totalValue = reportData.reduce(
          (sum, item) => sum + (item.value || 0),
          0
        );
        const avgValue = totalValue / reportData.length;
        const maxValue = Math.max(...reportData.map((item) => item.value || 0));
        const minValue = Math.min(...reportData.map((item) => item.value || 0));

        summary = {
          totalRecords: totalCount,
          totalCategories: reportData.length,
          totalValue: totalValue,
          avgValue: parseFloat(avgValue.toFixed(2)),
          maxValue: maxValue,
          minValue: minValue,
        };
      }
    } else if(!xaxis && !yaxis && reportId){
        const existingReports = await Report.findOne({
        where: { reportId },
      });

      const {
        entity: existingentity,
        type: existingtype,
        config: configString,
      } = existingReports.dataValues;

      // Parse the config JSON string
      const config = JSON.parse(configString);
      const { xaxis: existingxaxis, yaxis: existingyaxis, filters: existingfilters } = config;

      const reportResult = await generateActivityPerformanceData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        existingfilters,
        page,
        limit
      );
      reportData = reportResult.data;

      // Calculate summary statistics
      if (reportData.length > 0) {
        const totalValue = reportData.reduce(
          (sum, item) => sum + (item.value || 0),
          0
        );
        const avgValue = totalValue / reportData.length;
        const maxValue = Math.max(...reportData.map((item) => item.value || 0));
        const minValue = Math.min(...reportData.map((item) => item.value || 0));

        summary = {
          totalRecords: totalCount,
          totalCategories: reportData.length,
          totalValue: totalValue,
          avgValue: parseFloat(avgValue.toFixed(2)),
          maxValue: maxValue,
          minValue: minValue,
        };
      }

    }

    // Format activities for response
    const formattedActivities = activities.map((activity) => ({
      id: activity.activityId,
      subject: activity.subject,
      type: activity.type,
      priority: activity.priority,
      status: activity.status,
      startDateTime: activity.startDateTime,
      endDateTime: activity.endDateTime,
      createdAt: activity.createdAt,
      assignedTo: activity.assignedUser
        ? {
            id: activity.assignedUser.masterUserID,
            name: activity.assignedUser.name,
            email: activity.assignedUser.email,
          }
        : null,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Activities data retrieved successfully",
      data: {
        activities: formattedActivities,
        reportData: reportData,
        summary: summary,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error retrieving activities data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve activities data",
      error: error.message,
    });
  }
};
