
const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Goal = require("../../../models/insight/goalModel");
const MasterUser = require("../../../models/master/masterUserModel");
const Activity = require("../../../models/activity/activityModel")
const ReportFolder = require("../../../models/insight/reportFolderModel")
const { Op, Sequelize  } = require("sequelize");


exports.createActivityReport = async (req, res) => {
  try {
    const {
      dashboardId,
      folderId,
      name,
      entity,
      type,
      config, 
      position, 
      description,
      filter,
      xaxis,
      yaxis,
      filters,
      page = 1,      // Default to page 1
      limit = 6      // Default to 6 items per page
    } = req.body;
    const ownerId = req.adminId;
    const role = req.role
    // Validate required fields - dashboardId is now optional
    if (!entity || !type) {
      return res.status(400).json({
        success: false,
        message: "Entity and type are required",
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

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    
    if (entity === "Activity" && type === "Performance") {
      // Validate required fields for performance reports
      if (!xaxis || !yaxis) {
        return res.status(400).json({
          success: false,
          message: "X-axis and Y-axis are required for Activity Performance reports",
        });
      }

      try {
        // Generate data with pagination
        const result = await generateActivityPerformanceData(ownerId, role, xaxis, yaxis, filters, page, limit);
        reportData = result.data;
        paginationInfo = result.pagination;
      } catch (error) {
        console.error("Error generating activity performance data:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to generate activity performance data",
          error: error.message,
        });
      }
    }

    // If no dashboardId or folderId is provided, just return the data with pagination info
    // if (!dashboardId && !folderId) {
    //   return res.status(200).json({
    //     success: true,
    //     message: "Data generated successfully",
    //     data: reportData,
    //     pagination: paginationInfo
    //   });
    // }

    // Build goal name for UI as in screenshot
    let Name = description;
    if (!Name) {
      if (entity === "Activity" && type === "Performance") {
        Name = `Activity Performance`;
      } else {
        Name = `${entity} ${type}`;
      }
    }

    // Get the next position for this dashboard
    let nextPosition = 0;
    if (dashboardId) {
      const existingReports = await Report.findAll({
        where: { dashboardId },
        order: [["position", "DESC"]],
        limit: 1,
      });
      if (existingReports.length > 0) {
        nextPosition = (existingReports[0].position || 0) + 1;
      }
    }

    const newReport = await Report.create({
      dashboardId: dashboardId || null,
      folderId: folderId || null,
      entity,
      type,
      description: Name,
      name, 
      position: nextPosition,
      config: {
        xaxis,
        yaxis,
        filters,
        data: reportData // Store the generated data for immediate use
      },
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: {
        ...newReport.toJSON(),
        reportData // Include the generated data in the response
      },
      pagination: paginationInfo // Include pagination info if available
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


// Helper function to generate activity performance data with pagination
async function generateActivityPerformanceData(ownerId, role, xaxis, yaxis, filters, page = 1, limit = 6) {
  // Calculate offset for pagination
  const offset = (page - 1) * limit;
  
  // Base where condition - only show activities owned by the user if not admin
  const baseWhere = {};
  
  // If user is not admin, filter by ownerId
  if (role !== 'admin') {
    baseWhere.masterUserID = ownerId;
  }

  // Handle filters if provided
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      cond => cond.value !== undefined && cond.value !== ''
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
        
        const logicalOp = (filters.logicalOperators[i-1] || 'AND').toUpperCase();
        
        if (logicalOp === 'AND') {
          combinedCondition = {
            [Op.and]: [combinedCondition, currentCondition]
          };
        } else {
          combinedCondition = {
            [Op.or]: [combinedCondition, currentCondition]
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
  if (xaxis === 'Owner' || xaxis === 'assignedTo') {
    includeModels.push({
      model: MasterUser,
      as: 'assignedUser', // Use the correct alias
      attributes: ['masterUserID', 'name'],
      required: true
    });
    groupBy.push('assignedUser.masterUserID');
    attributes.push([Sequelize.col('assignedUser.name'), 'xValue']);
  } else if (xaxis === 'Team') {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: 'assignedUser', // Use the correct alias
      attributes: ['masterUserID', 'team'],
      required: true
    });
    groupBy.push('assignedUser.team');
    attributes.push([Sequelize.col('assignedUser.team'), 'xValue']);
  } else {
    // Regular column from Activity table
    groupBy.push(xaxis);
    attributes.push([xaxis, 'xValue']);
  }

  // Handle yaxis
  if (yaxis === 'no of activities') {
    attributes.push([Sequelize.fn('COUNT', Sequelize.col('activityId')), 'yValue']);
  } else if (yaxis === 'duration') {
    // Calculate average duration in hours
    attributes.push([
      Sequelize.fn(
        'AVG', 
        Sequelize.fn(
          'TIMESTAMPDIFF', 
          Sequelize.literal('HOUR'), 
          Sequelize.col('startDateTime'), 
          Sequelize.col('endDateTime')
        )
      ), 
      'yValue'
    ]);
  } else {
    // For other yaxis values, assume they're column names that need to be summed
    attributes.push([Sequelize.fn('SUM', Sequelize.col(yaxis)), 'yValue']);
  }

  // Get total count for pagination
  const totalCountResult = await Activity.findAll({
    where: baseWhere,
    attributes: [
      [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col(groupBy[0]))), 'total']
    ],
    include: includeModels,
    raw: true
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
    order: [[Sequelize.literal('yValue'), 'DESC']],
    limit: limit,
    offset: offset
  });

  // Format the results for the frontend
  const formattedResults = results.map(item => ({
    label: item.xValue || 'Unknown',
    value: item.yValue || 0
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
      hasPrevPage: page > 1
    }
  };
}

// Helper function to convert operator strings to Sequelize operators
function getConditionObject(column, operator, value) {
  let conditionValue = value;
  
  // Handle different data types
  if (column === 'isDone') {
    conditionValue = value === 'true' || value === true;
  } else if (column.includes('Date') || column.includes('Time')) {
    conditionValue = new Date(value);
  } else if (!isNaN(value) && value !== '') {
    conditionValue = parseFloat(value);
  }
  
  switch (operator) {
    case '>': return { [column]: { [Op.gt]: conditionValue } };
    case '<': return { [column]: { [Op.lt]: conditionValue } };
    case '=': return { [column]: { [Op.eq]: conditionValue } };
    case '≠': return { [column]: { [Op.ne]: conditionValue } };
    case 'contains': return { [column]: { [Op.like]: `%${conditionValue}%` } };
    case 'startsWith': return { [column]: { [Op.like]: `${conditionValue}%` } };
    case 'endsWith': return { [column]: { [Op.like]: `%${conditionValue}` } };
    case 'isEmpty': return { [column]: { [Op.or]: [{ [Op.is]: null }, { [Op.eq]: '' }] } };
    case 'isNotEmpty': return { [column]: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: '' }] } };
    default: return { [column]: { [Op.eq]: conditionValue } };
  }
};


exports.saveActivityReport = async (req, res) => {
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
      data: updatedReport
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