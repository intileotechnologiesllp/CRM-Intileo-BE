
const DASHBOARD = require("../../../../models/insight/dashboardModel");
const Report = require("../../../../models/insight/reportModel");
const Goal = require("../../../models/insight/goalModel");
const MasterUser = require("../../../models/master/masterUserModel");
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
      filters
    } = req.body;
    const ownerId = req.adminId;

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

    // Build goal name for UI as in screenshot
    let Name = description;
    if (!Name) {
      if (entity === "Activity" && type === "Performance") {
        Name = `Activity Performance`;
      } else {
        Name = `${entity} ${type}`;
      }
    }

    // For Activity Performance reports, generate the data immediately
    let reportData = null;
    if (entity === "Activity" && type === "Performance") {
      // Validate required fields for performance reports
      if (!xaxis || !yaxis) {
        return res.status(400).json({
          success: false,
          message: "X-axis and Y-axis are required for Activity Performance reports",
        });
      }

      try {
        reportData = await generateActivityPerformanceData(ownerId, xaxis, yaxis, filters);
      } catch (error) {
        console.error("Error generating activity performance data:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to generate activity performance data",
          error: error.message,
        });
      }
    }

    // Get the next position for this dashboard
    let nextPosition = 0;
    if (dashboardId) {
      const existingReports = await Report.findAll({
        where: { dashboardId, isActive: true },
        order: [["position", "DESC"]],
        limit: 1,
      });
      if (existingReports.length > 0) {
        nextPosition = (existingReports[0].position || 0) + 1;
      }
    }

    const newReport = await Report.create({
      dashboardId: dashboardId || null,
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

// Helper function to generate activity performance data
async function generateActivityPerformanceData(ownerId, xaxis, yaxis, filters) {
  // Base where condition - only show activities owned by the user
  const baseWhere = {
    masterUserID: ownerId,
  };

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
  if (xaxis === 'Owner') {
    includeModels.push({
      model: MasterUser,
      as: 'assignee',
      attributes: ['masterUserID', 'name'],
      required: true
    });
    groupBy.push('assignee.masterUserID');
    attributes.push([Sequelize.col('assignee.name'), 'xValue']);
  } else if (xaxis === 'Team') {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: 'assignee',
      attributes: ['masterUserID', 'team'],
      required: true
    });
    groupBy.push('assignee.team');
    attributes.push([Sequelize.col('assignee.team'), 'xValue']);
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

  // Execute query
  const results = await Activity.findAll({
    where: baseWhere,
    attributes: attributes,
    include: includeModels,
    group: groupBy,
    raw: true,
    order: [[Sequelize.literal('yValue'), 'DESC']]
  });

  // Format the results for the frontend
  return results.map(item => ({
    label: item.xValue || 'Unknown',
    value: item.yValue || 0
  }));
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
}