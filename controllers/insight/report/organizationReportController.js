const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Deal = require("../../../models/deals/dealsModels");
const Lead = require("../../../models/leads/leadsModel");
const Organization = require("../../../models/leads/leadOrganizationModel");
const Person = require("../../../models/leads/leadPersonModel");
const MasterUser = require("../../../models/master/masterUserModel");
const Activity = require("../../../models/activity/activityModel");
const ReportFolder = require("../../../models/insight/reportFolderModel");
const { Op, Sequelize } = require("sequelize");
const LeadPerson = require("../../../models/leads/leadPersonModel");

exports.createOrganizationReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      durationUnit = null,
      segmentedBy = "none",
      filters,
      page = 1,
      limit = 8,
    } = req.body;
    const ownerId = req.adminId;
    const role = req.role;

    // Define available options for xaxis and yaxis
    const xaxisArray = [
      { label: "Organization", value: "organization", type: "Organization" },
      { label: "Address", value: "address", type: "Organization" },
      {
        label: "Organization Labels",
        value: "organizationLabels",
        type: "Organization",
      },
      { label: "Add On", value: "createdAt", type: "Date" },
      { label: "Updated On", value: "updatedAt", type: "Date" },
    ];
    const segmentedByOptions = [
      { label: "None", value: "none" },
      { label: "Organization", value: "organization" },
      { label: "Address", value: "address" },
      { label: "Organization Labels", value: "organizationLabels" },
    ];
    const yaxisArray = [
      {
        label: "No of Organizations",
        value: "no of organizations",
        type: "Organization",
      },
    ];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Organization: [
        {
          label: "Organization",
          value: "organization",
          type: "text",
        },
        {
          label: "Organization Labels",
          value: "organizationLabels",
          type: "text",
        },
        { label: "Address", value: "address", type: "text" },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
    };

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    let totalValue = 0;
    let summary = null;
    let reportConfig = null;

    if (entity && type && !reportId) {
      if (entity === "Contact" && type === "Organization") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Contact Organization reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateOrganizationPerformanceData(
            ownerId,
            role,
            xaxis,
            yaxis,
            durationUnit,
            segmentedBy,
            filters,
            page,
            limit
          );
          reportData = result.data;
          paginationInfo = result.pagination;
          totalValue = result.totalValue;
          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            durationUnit,
            segmentedBy,
            filters: filters || {},
            reportData,
          };
          if (reportData.length > 0) {
            const avgValue = totalValue / reportData.length;
            const maxValue = Math.max(
              ...reportData.map((item) => item.value || 0)
            );
            const minValue = Math.min(
              ...reportData.map((item) => item.value || 0)
            );

            summary = {
              totalCategories: reportData.length,
              totalValue: totalValue,
              avgValue: parseFloat(avgValue.toFixed(2)),
              maxValue: maxValue,
              minValue: minValue,
            };
          }
        } catch (error) {
          console.error("Error generating Contact Organization data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Contact Organization data",
            error: error.message,
          });
        }
      }
    } 
    else if ((entity && type && reportId) || (!entity && !type && reportId)) {
      const existingReports = await Report.findOne({
        where: { reportId },
      });

      const {
        entity: existingentity,
        type: existingtype,
        config: configString,
        graphtype: existinggraphtype,
        colors: existingcolors,
      } = existingReports.dataValues;

      const colors = JSON.parse(existingcolors);
      // Parse the config JSON string
      const config = JSON.parse(configString);
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        durationUnit: existingDurationUnit,
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      if (existingentity === "Contact" && existingtype === "Organization") {
        // Validate required fields for Organization reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Contact Organization reports",
          });
        }

          // Generate data with pagination
          const result = await generateExistingOrganizationPerformanceData(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingDurationUnit,
            existingSegmentedBy,
            existingfilters,
            page,
            limit
          );
          reportData = result.data;
          paginationInfo = result.pagination;
          totalValue = result.totalValue;
          reportConfig = {
            reportId,
            entity: existingentity,
            type: existingtype,
            xaxis: existingxaxis,
            yaxis: existingyaxis,
            durationUnit: existingDurationUnit,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors,
            reportData,
          };
          if (reportData.length > 0) {
            const avgValue = totalValue / reportData.length;
            const maxValue = Math.max(
              ...reportData.map((item) => item.value || 0)
            );
            const minValue = Math.min(
              ...reportData.map((item) => item.value || 0)
            );

            summary = {
              totalCategories: reportData.length,
              totalValue: totalValue,
              avgValue: parseFloat(avgValue.toFixed(2)),
              maxValue: maxValue,
              minValue: minValue,
            };
          }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Data generated successfully",
      data: reportData,
      totalValue: totalValue,
      summary: summary,
      pagination: paginationInfo,
      config: reportConfig,
      availableOptions: {
        xaxis: xaxisArray,
        yaxis: yaxisArray,
        segmentedByOptions: segmentedByOptions,
      },
      filters: availableFilterColumns,
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

async function generateExistingOrganizationPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  existingfilters,
  page = 1,
  limit = 8
) {
  let includeModels = [];
  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base where condition - only show activities owned by the user if not admin
  const baseWhere = {};

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

 let xaxisNullExcludeCondition = {};

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";


  if (shouldGroupByDuration) {
    // For date fields with duration grouping
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);
  
  // Handle existingfilters if provided
  // In your generateActivityPerformanceData function, modify the filter handling:
  if (existingfilters && existingfilters.conditions) {
    const validConditions = existingfilters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      // Array to track include models for filtering
      const filterIncludeModels = [];

      // Process all conditions first to collect include models
      const conditions = validConditions.map((cond) => {
        return getConditionObject(
          cond.column,
          cond.operator,
          cond.value,
          filterIncludeModels
        );
      });

      // Build combined condition with logical operators
      let combinedCondition = conditions[0];

      for (let i = 1; i < conditions.length; i++) {
        const logicalOp = (
          existingfilters.logicalOperators[i - 1] || "AND"
        ).toUpperCase();

        if (logicalOp === "AND") {
          combinedCondition = { [Op.and]: [combinedCondition, conditions[i]] };
        } else {
          combinedCondition = { [Op.or]: [combinedCondition, conditions[i]] };
        }
      }

      Object.assign(baseWhere, combinedCondition);

      // Add filter-related include models to the main includeModels array
      // Avoid duplicates
      filterIncludeModels.forEach((newInclude) => {
        const exists = includeModels.some(
          (existingInclude) => existingInclude.as === newInclude.as
        );
        if (!exists) {
          includeModels.push(newInclude);
        }
      });
    }
  }

  // Handle special cases for xaxis (like Owner which needs join)

  let groupBy = [];
  let attributes = [];

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(
      existingxaxis,
      existingDurationUnit
    );
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([
      Sequelize.col("LeadOrganization.masterUserID"),
      "assignedUserId",
    ]);
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
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`LeadOrganization.${existingxaxis}`);
    attributes.push([
      Sequelize.col(`LeadOrganization.${existingxaxis}`),
      "xValue",
    ]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
     const isSegmentedByDate = isDateField(existingSegmentedBy);

    const shouldSegmentByDuration =
      isSegmentedByDate &&
      existingDurationUnit &&
      existingDurationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(
        existingSegmentedBy,
        existingDurationUnit
      );
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
      existingSegmentedBy === "Owner" ||
      (existingSegmentedBy === "assignedTo" && !assignedUserIncludeExists)
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`LeadOrganization.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadOrganization.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of organizations") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("leadOrganizationId")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadOrganization.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Pagination and Query logic
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Organization.findAll({
      where: baseWhere,
      attributes: [
        [
          Sequelize.fn(
            "COUNT",
            Sequelize.fn(
              "DISTINCT",
              getDateGroupExpression(existingxaxis, existingDurationUnit)
            )
          ),
          "total",
        ],
      ],
      include: includeModels,
      raw: true,
    });
  } else {
    let countColumn;
    if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
      countColumn = Sequelize.col("assignedUser.name");
    } else {
      countColumn = Sequelize.col(`LeadOrganization.${existingxaxis}`);
    }

    totalCountResult = await Organization.findAll({
      where: baseWhere,
      attributes: [
        [Sequelize.fn("COUNT", Sequelize.fn("DISTINCT", countColumn)), "total"],
      ],
      include: includeModels,
      raw: true,
    });
  }

  const totalCount = parseInt(totalCountResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // For segmented queries
    const paginationAttributes = [];
    let groupColumn;
    if (shouldGroupByDuration) {
      groupColumn = getDateGroupExpression(existingxaxis, existingDurationUnit);
      paginationAttributes.push([groupColumn, "groupKey"]);
    } else {
      if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
        groupColumn = Sequelize.col("assignedUser.name");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`LeadOrganization.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Organization.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
      limit: limit,
      offset: offset,
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };

      let groupCondition;
      if (shouldGroupByDuration) {
        const groupExpression = getDateGroupExpression(
          existingxaxis,
          existingDurationUnit
        );
        groupCondition = Sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
        groupCondition = { "$assignedUser.name$": { [Op.in]: groupKeys } };
      } else {
        groupCondition = { [existingxaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await Organization.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
      });
    }
  } else {
    results = await Organization.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
      limit: limit,
      offset: offset,
    });
  }

  // Format the results for the frontend
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};

    results.forEach((item) => {
      const xValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;
        if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
          id = item.assignedUserId || null;
        }

        groupedData[xValue] = {
          label: xValue,
          segments: [],
          id: id,
        };
      }
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
      });
    });

    formattedResults = Object.values(groupedData);

    // Calculate total for each segment group
    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
    });

    // Only sort for non-date fields
    if (!isDateFieldX) {
      formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);
    }

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      // Set proper ID based on xaxis type
      let id = null;
      if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
        id = item.assignedUserId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return data with pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
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
async function generateOrganizationPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters,
  page = 1,
  limit = 8
) {
  let includeModels = [];

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base where condition - only show activities owned by the user if not admin
  const baseWhere = {};

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  let xaxisNullExcludeCondition = {};
  
     // Check if xaxis is a date field and durationUnit is provided
    const isDateFieldX = isDateField(xaxis);
    const shouldGroupByDuration =
      isDateFieldX && durationUnit && durationUnit !== "none";
  
  
    if (shouldGroupByDuration) {
      // For date fields with duration grouping, we'll handle this differently
      // since we're grouping by date expressions
      xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null };
    } else if (xaxis === "Owner" || xaxis === "assignedTo") {
      // For Owner/assignedTo, exclude where assignedUser is null
      xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null };
    } else if (xaxis === "Team") {
      // For Team, exclude where assignedUser.team is null
      xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null };
    } else {
      // For regular columns, exclude where the column value is null
      xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null };
    }
  
    // Add the null exclusion condition to baseWhere
    Object.assign(baseWhere, xaxisNullExcludeCondition);
  
  // Handle filters if provided
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      // Array to track include models for filtering
      const filterIncludeModels = [];

      // Process all conditions first to collect include models
      const conditions = validConditions.map((cond) => {
        return getConditionObject(
          cond.column,
          cond.operator,
          cond.value,
          filterIncludeModels
        );
      });

      // Build combined condition with logical operators
      let combinedCondition = conditions[0];

      for (let i = 1; i < conditions.length; i++) {
        const logicalOp = (
          filters.logicalOperators[i - 1] || "AND"
        ).toUpperCase();

        if (logicalOp === "AND") {
          combinedCondition = { [Op.and]: [combinedCondition, conditions[i]] };
        } else {
          combinedCondition = { [Op.or]: [combinedCondition, conditions[i]] };
        }
      }

      Object.assign(baseWhere, combinedCondition);

      // Add filter-related include models to the main includeModels array
      // Avoid duplicates
      filterIncludeModels.forEach((newInclude) => {
        const exists = includeModels.some(
          (existingInclude) => existingInclude.as === newInclude.as
        );
        if (!exists) {
          includeModels.push(newInclude);
        }
      });
    }
  }

  // Handle special cases for xaxis (like Owner which needs join)
  let groupBy = [];
  let attributes = [];

  // Handle xaxis special cases
  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
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
    // For regular columns, explicitly specify the LeadOrganization table
    groupBy.push(`LeadOrganization.${xaxis}`);
    attributes.push([Sequelize.col(`LeadOrganization.${xaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
    const isSegmentedByDate = isDateField(segmentedBy);
    const shouldSegmentByDuration =
      isSegmentedByDate && durationUnit && durationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(
        segmentedBy,
        durationUnit
      );
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
      (segmentedBy === "Owner" || segmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`LeadOrganization.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadOrganization.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle yaxis
  if (yaxis === "no of organizations") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("leadOrganizationId")),
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
    // For other yaxis values, explicitly specify the LeadOrganization table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadOrganization.${yaxis}`)),
      "yValue",
    ]);
  }

  // Total count calculation
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Organization.findAll({
      where: baseWhere,
      attributes: [
        [
          Sequelize.fn(
            "COUNT",
            Sequelize.fn(
              "DISTINCT",
              getDateGroupExpression(xaxis, durationUnit)
            )
          ),
          "total",
        ],
      ],
      include: includeModels,
      raw: true,
    });
  } else {
    let countColumn;
    if (xaxis === "Owner" || xaxis === "assignedTo") {
      countColumn = Sequelize.col("assignedUser.masterUserID");
    } else if (xaxis === "Team") {
      countColumn = Sequelize.col("assignedUser.team");
    } else {
      countColumn = Sequelize.col(`LeadOrganization.${xaxis}`);
    }

    totalCountResult = await Organization.findAll({
      where: baseWhere,
      attributes: [
        [Sequelize.fn("COUNT", Sequelize.fn("DISTINCT", countColumn)), "total"],
      ],
      include: includeModels,
      raw: true,
    });
  }

  const totalCount = parseInt(totalCountResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    // For segmented queries, we need a different approach
    const paginationAttributes = [];

    // Determine the correct group column for pagination
    let groupColumn;
    if (shouldGroupByDuration) {
      groupColumn = getDateGroupExpression(xaxis, durationUnit);
      paginationAttributes.push([groupColumn, "groupKey"]);
    } else {
      // Handle special cases for Owner, contactPerson, organization
      if (xaxis === "Owner" || xaxis === "assignedTo") {
        groupColumn = Sequelize.col("assignedUser.name");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`LeadOrganization.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Organization.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
      limit: limit,
      offset: offset,
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };

      // Build condition for the specific group keys - FIXED for related tables
      let groupCondition;

      if (shouldGroupByDuration) {
        // For date grouping
        const groupExpression = getDateGroupExpression(xaxis, durationUnit);
        groupCondition = Sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (xaxis === "Owner" || xaxis === "assignedTo") {
        // For Owner/assignedTo - use proper Sequelize syntax for related table
        groupCondition = { "$assignedUser.name$": { [Op.in]: groupKeys } };
      } else if (xaxis === "contactPerson") {
        // For contactPerson - use proper column reference
        groupCondition = { personId: { [Op.in]: groupKeys } };
      } else if (xaxis === "organization") {
        // For organization - use proper column reference
        groupCondition = { leadOrganizationId: { [Op.in]: groupKeys } };
      } else {
        // For regular Organization columns
        groupCondition = { [xaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await Organization.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
      });
    }
  } else {
    results = await Organization.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
      limit: limit,
      offset: offset,
    });
  }

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};

    results.forEach((item) => {
      const xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;
        if (xaxis === "Owner" || xaxis === "assignedTo") {
          id = item.assignedUserId || null;
        }

        groupedData[xValue] = {
          label: xValue,
          segments: [],
          id: id,
        };
      }
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
      });
    });

    formattedResults = Object.values(groupedData);

    // Calculate and add total for each segment group
    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
    });

    // Only sort for non-date fields
    if (!isDateFieldX) {
      formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);
    }

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, durationUnit) || "Unknown";

      // Set proper ID based on xaxis type
      let id = null;
      if (xaxis === "Owner" || xaxis === "assignedTo") {
        id = item.assignedUserId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return data with pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
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

// Helper function to check if xaxis is a date field
function isDateField(xaxis) {
  const dateFields = [
    "createdAt",
    "dueDate"
  ];
  return dateFields.includes(xaxis);
}

// Helper function to convert operator strings to Sequelize operators
function getConditionObject(column, operator, value, includeModels = []) {
  let conditionValue = value;

  // Check if column contains a dot (indicating a related table field)
  const hasRelation = column.includes(".");
  let tableAlias = "LeadOrganization";
  let fieldName = column;

  if (hasRelation) {
    [tableAlias, fieldName] = column.split(".");
  }

  // Handle date filtering for specific date columns
  const isDateColumn =
    fieldName.includes("Date") ||
    fieldName.includes("Time") ||
    fieldName === "createdAt" ||
    fieldName === "updatedAt";

  // Handle date range filtering for "Add on" (daterange type)
  const isDateRangeFilter = fieldName === "daterange";

  if (isDateRangeFilter && Array.isArray(value)) {
    // Handle date range filter (from frontend: ["2025-06-23", "2025-06-25"])
    const [fromDate, toDate] = value;

    if (operator === "between" || operator === "=" || operator === "is") {
      // Include records within the date range
      return {
        [dateField]: {
          [Op.between]: [
            new Date(fromDate + " 00:00:00"),
            new Date(toDate + " 23:59:59"),
          ],
        },
      };
    } else if (
      operator === "notBetween" ||
      operator === "≠" ||
      operator === "is not"
    ) {
      // Exclude records within the date range (records NOT between the dates)
      return {
        [dateField]: {
          [Op.notBetween]: [
            new Date(fromDate + " 00:00:00"),
            new Date(toDate + " 23:59:59"),
          ],
        },
      };
    }
  } else if (isDateColumn) {
    // Handle single date filtering (e.g., "2025-06-23")
    if (operator === "=" || operator === "is") {
      // For exact date match, create a range for the entire day
      const startOfDay = new Date(value + " 00:00:00");
      const endOfDay = new Date(value + " 23:59:59");

      // For related tables
      if (hasRelation) {
        addIncludeModel(tableAlias, includeModels);
        return {
          [`$${tableAlias}.${fieldName}$`]: {
            [Op.between]: [startOfDay, endOfDay],
          },
        };
      } else {
        return {
          [fieldName]: {
            [Op.between]: [startOfDay, endOfDay],
          },
        };
      }
    } else if (operator === ">") {
      conditionValue = new Date(value + " 23:59:59");
    } else if (operator === "<") {
      conditionValue = new Date(value + " 00:00:00");
    } else if (operator === "≠" || operator === "is not") {
      // For not equal, exclude the entire day
      const startOfDay = new Date(value + " 00:00:00");
      const endOfDay = new Date(value + " 23:59:59");

      // For related tables
      if (hasRelation) {
        addIncludeModel(tableAlias, includeModels);
        return {
          [`$${tableAlias}.${fieldName}$`]: {
            [Op.notBetween]: [startOfDay, endOfDay],
          },
        };
      } else {
        return {
          [fieldName]: {
            [Op.notBetween]: [startOfDay, endOfDay],
          },
        };
      }
    } else {
      conditionValue = new Date(value);
    }
  }
  // Handle other data types
  else if (fieldName === "isDone") {
    conditionValue = value === "true" || value === true;
  } else if (!isNaN(value) && value !== "" && typeof value === "string") {
    conditionValue = parseFloat(value);
  }

  // Handle related table joins
  if (hasRelation) {
    addIncludeModel(tableAlias, includeModels);

    const op = getSequelizeOperator(operator);

    // Handle special operators for related tables
    switch (operator) {
      case "contains":
        return {
          [`$${tableAlias.as}.${fieldName}$`]: { [op]: `%${conditionValue}%` },
        };
      case "startsWith":
        return {
          [`$${tableAlias.as}.${fieldName}$`]: { [op]: `${conditionValue}%` },
        };
      case "endsWith":
        return {
          [`$${tableAlias.as}.${fieldName}$`]: { [op]: `%${conditionValue}` },
        };
      case "isEmpty":
        return {
          [Op.or]: [
            { [`$${tableAlias.as}.${fieldName}$`]: { [Op.is]: null } },
            { [`$${tableAlias.as}.${fieldName}$`]: { [Op.eq]: "" } },
          ],
        };
      case "isNotEmpty":
        return {
          [Op.and]: [
            { [`$${tableAlias.as}.${fieldName}$`]: { [Op.not]: null } },
            { [`$${tableAlias.as}.${fieldName}$`]: { [Op.ne]: "" } },
          ],
        };
      default:
        return {
          [`$${tableAlias.as}.${fieldName}$`]: { [op]: conditionValue },
        };
    }
  } else {
    // Regular activity table column
    return getOperatorCondition(column, operator, conditionValue);
  }
}

// Helper function to add include models
function addIncludeModel(tableAlias, includeModels) {
  let modelConfig;

  switch (tableAlias) {
    case "LeadOrganization":
      modelConfig = {
        model: Organization,
        as: "LeadOrganization",
        required: false,
        attributes: [],
      };
      break;
    default:
      return; // No include needed for Lead Person table
  }

  // Check if this include already exists to avoid duplicates
  const existingInclude = includeModels.find(
    (inc) => inc.as === modelConfig.as
  );
  if (!existingInclude) {
    includeModels.push(modelConfig);
  }
}

// Helper function for operator conditions
function getOperatorCondition(column, operator, value) {
  const op = getSequelizeOperator(operator);

  switch (operator) {
    case "contains":
      return { [column]: { [op]: `%${value}%` } };
    case "startsWith":
      return { [column]: { [op]: `${value}%` } };
    case "endsWith":
      return { [column]: { [op]: `%${value}` } };
    case "isEmpty":
      return {
        [Op.or]: [
          { [column]: { [Op.is]: null } },
          { [column]: { [Op.eq]: "" } },
        ],
      };
    case "isNotEmpty":
      return {
        [Op.and]: [
          { [column]: { [Op.not]: null } },
          { [column]: { [Op.ne]: "" } },
        ],
      };
    case "between":
    case "notBetween":
      return value; // Return the pre-built condition
    default:
      return { [column]: { [op]: value } };
  }
}

// Helper function to convert operator strings to Sequelize operators
function getSequelizeOperator(operator) {
  switch (operator) {
    case ">":
      return Op.gt;
    case "<":
      return Op.lt;
    case "=":
      return Op.eq;
    case "is":
      return Op.eq;
    case "≠":
      return Op.ne;
    case "is not":
      return Op.ne;
    case "contains":
      return Op.like;
    case "startsWith":
      return Op.like;
    case "endsWith":
      return Op.like;
    case "isEmpty":
      return Op.or;
    case "isNotEmpty":
      return Op.and;
    case "between":
      return Op.between;
    case "notBetween":
      return Op.notBetween;
    default:
      return Op.eq;
  }
}

// Helper function to get date group expression based on durationUnit
function getDateGroupExpression(dateField, durationUnit) {
  const field = `LeadOrganization.${dateField}`;

  if (!durationUnit || durationUnit === "none") {
    return Sequelize.col(field);
  }

  switch (durationUnit.toLowerCase()) {
    case "daily":
      return Sequelize.fn("DATE_FORMAT", Sequelize.col(field), "%d/%m/%Y");

    case "weekly":
      return Sequelize.literal(
        `CONCAT('w', WEEK(${field}), ' ', YEAR(${field}))`
      );

    case "monthly":
      return Sequelize.fn("DATE_FORMAT", Sequelize.col(field), "%m/%Y");

    case "quarterly":
      return Sequelize.literal(
        `CONCAT('Q', QUARTER(${field}), ' ', YEAR(${field}))`
      );

    case "yearly":
      return Sequelize.fn("YEAR", Sequelize.col(field));

    default:
      return Sequelize.fn("DATE_FORMAT", Sequelize.col(field), "%d/%m/%Y");
  }
}

// Helper function to format date values for display
function formatDateValue(value, durationUnit) {
  if (!value) return value;

  if (!durationUnit || durationUnit === "none") return value;

  // For yearly, just return the year as string
  if (durationUnit.toLowerCase() === "yearly") {
    return value.toString();
  }

  // For other cases, return the value as is (already formatted by SQL)
  return value;
}

// Helper function for order clause
function getOrderClause(yaxis, xaxis) {
  // If xaxis is a date field, return natural order (no sorting by value)
  if (isDateField(xaxis)) {
      // For date fields, order by the date field itself to maintain chronological order
      return [[Sequelize.col(`LeadOrganization.${xaxis}`), "ASC"]];
  }
  if (yaxis === "no of organizations") {
    return [[Sequelize.fn("COUNT", Sequelize.col("leadOrganizationId")), "DESC"]];
  } else {
    return [
      [Sequelize.fn("SUM", Sequelize.col(`LeadOrganization.${yaxis}`)), "DESC"],
    ];
  }
}

async function generateExistingOrganizationPerformanceDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  existingfilters
) {
  let includeModels = [];
  const baseWhere = {};

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  let xaxisNullExcludeCondition = {};

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";


  if (shouldGroupByDuration) {
    // For date fields with duration grouping
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

  
  // Handle existingfilters if provided
  if (existingfilters && existingfilters.conditions) {
    const validConditions = existingfilters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      // Array to track include models for filtering
      const filterIncludeModels = [];

      // Process all conditions first to collect include models
      const conditions = validConditions.map((cond) => {
        return getConditionObject(
          cond.column,
          cond.operator,
          cond.value,
          filterIncludeModels
        );
      });

      // Build combined condition with logical operators
      let combinedCondition = conditions[0];

      for (let i = 1; i < conditions.length; i++) {
        const logicalOp = (
          existingfilters.logicalOperators[i - 1] || "AND"
        ).toUpperCase();

        if (logicalOp === "AND") {
          combinedCondition = { [Op.and]: [combinedCondition, conditions[i]] };
        } else {
          combinedCondition = { [Op.or]: [combinedCondition, conditions[i]] };
        }
      }

      Object.assign(baseWhere, combinedCondition);

      // Add filter-related include models to the main includeModels array
      // Avoid duplicates
      filterIncludeModels.forEach((newInclude) => {
        const exists = includeModels.some(
          (existingInclude) => existingInclude.as === newInclude.as
        );
        if (!exists) {
          includeModels.push(newInclude);
        }
      });
    }
  }

  let groupBy = [];
  let attributes = [];

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(
      existingxaxis,
      existingDurationUnit
    );
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([
      Sequelize.col("LeadOrganization.masterUserID"),
      "assignedUserId",
    ]);
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
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`LeadOrganization.${existingxaxis}`);
    attributes.push([
      Sequelize.col(`LeadOrganization.${existingxaxis}`),
      "xValue",
    ]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
    const isSegmentedByDate = isDateField(existingSegmentedBy);

    const shouldSegmentByDuration =
      isSegmentedByDate &&
      existingDurationUnit &&
      existingDurationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(
        existingSegmentedBy,
        existingDurationUnit
      );
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
      existingSegmentedBy === "Owner" ||
      (existingSegmentedBy === "assignedTo" && !assignedUserIncludeExists)
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`LeadOrganization.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadOrganization.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of organizations") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("leadOrganizationId")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadOrganization.${existingyaxis}`)),
      "yValue",
    ]);
  }

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // For segmented queries - get all results without pagination
    results = await Organization.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
    });
  } else {
    // Get all results without pagination
    results = await Organization.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
    });
  }

  // Format the results for the frontend
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};

    results.forEach((item) => {
      const xValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;
        if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
          id = item.assignedUserId || null;
        }

        groupedData[xValue] = {
          label: xValue,
          segments: [],
          id: id,
        };
      }
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
      });
    });

    formattedResults = Object.values(groupedData);

    // Calculate total for each segment group
    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
    });

    // Only sort for non-date fields
    if (!isDateFieldX) {
      formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);
    }

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      // Set proper ID based on xaxis type
      let id = null;
      if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
        id = item.assignedUserId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

// Helper function to generate organization performance data without pagination
async function generateOrganizationPerformanceDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters
) {
  let includeModels = [];
  const baseWhere = {};

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  let xaxisNullExcludeCondition = {};
  
     // Check if xaxis is a date field and durationUnit is provided
    const isDateFieldX = isDateField(xaxis);
    const shouldGroupByDuration =
      isDateFieldX && durationUnit && durationUnit !== "none";
  
  
    if (shouldGroupByDuration) {
      // For date fields with duration grouping, we'll handle this differently
      // since we're grouping by date expressions
      xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null };
    } else if (xaxis === "Owner" || xaxis === "assignedTo") {
      // For Owner/assignedTo, exclude where assignedUser is null
      xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null };
    } else if (xaxis === "Team") {
      // For Team, exclude where assignedUser.team is null
      xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null };
    } else {
      // For regular Activity columns, exclude where the column value is null
      xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null };
    }
  
    // Add the null exclusion condition to baseWhere
    Object.assign(baseWhere, xaxisNullExcludeCondition);
    
  // Handle filters if provided
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      // Array to track include models for filtering
      const filterIncludeModels = [];

      // Process all conditions first to collect include models
      const conditions = validConditions.map((cond) => {
        return getConditionObject(
          cond.column,
          cond.operator,
          cond.value,
          filterIncludeModels
        );
      });

      // Build combined condition with logical operators
      let combinedCondition = conditions[0];

      for (let i = 1; i < conditions.length; i++) {
        const logicalOp = (
          filters.logicalOperators[i - 1] || "AND"
        ).toUpperCase();

        if (logicalOp === "AND") {
          combinedCondition = { [Op.and]: [combinedCondition, conditions[i]] };
        } else {
          combinedCondition = { [Op.or]: [combinedCondition, conditions[i]] };
        }
      }

      Object.assign(baseWhere, combinedCondition);

      // Add filter-related include models to the main includeModels array
      // Avoid duplicates
      filterIncludeModels.forEach((newInclude) => {
        const exists = includeModels.some(
          (existingInclude) => existingInclude.as === newInclude.as
        );
        if (!exists) {
          includeModels.push(newInclude);
        }
      });
    }
  }

  // Handle special cases for xaxis (like Owner which needs join)
  let groupBy = [];
  let attributes = [];

  // Handle xaxis special cases
  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
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
    // For regular columns, explicitly specify the LeadOrganization table
    groupBy.push(`LeadOrganization.${xaxis}`);
    attributes.push([Sequelize.col(`LeadOrganization.${xaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
    const isSegmentedByDate = isDateField(segmentedBy);
    const shouldSegmentByDuration =
      isSegmentedByDate && durationUnit && durationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(
        segmentedBy,
        durationUnit
      );
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
      (segmentedBy === "Owner" || segmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`LeadOrganization.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadOrganization.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle yaxis
  if (yaxis === "no of organizations") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("leadOrganizationId")),
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
    // For other yaxis values, explicitly specify the LeadOrganization table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadOrganization.${yaxis}`)),
      "yValue",
    ]);
  }

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    // For segmented queries - get all results without pagination
    results = await Organization.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
    });
  } else {
    // Get all results without pagination
    results = await Organization.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadOrganization.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
    });
  }

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};

    results.forEach((item) => {
      const xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;
        if (xaxis === "Owner" || xaxis === "assignedTo") {
          id = item.assignedUserId || null;
        }

        groupedData[xValue] = {
          label: xValue,
          segments: [],
          id: id,
        };
      }
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
      });
    });

    formattedResults = Object.values(groupedData);

    // Calculate and add total for each segment group
    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
    });

    // Only sort for non-date fields
    if (!isDateFieldX) {
      formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);
    }

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, durationUnit) || "Unknown";

      // Set proper ID based on xaxis type
      let id = null;
      if (xaxis === "Owner" || xaxis === "assignedTo") {
        id = item.assignedUserId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

exports.saveOrganizationReport = async (req, res) => {
  try {
    const {
      reportId,
      dashboardIds,
      folderId,
      name,
      entity,
      type,
      description,
      xaxis,
      yaxis,
      durationUnit,
      segmentedBy,
      filters,
      graphtype,
      colors,
    } = req.body;

    const ownerId = req.adminId;
    const role = req.role;

    let reportData = null;
    let totalValue = null;
    let reportConfig = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
      if (entity === "Contact" && type === "Organization") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Contact Organization reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateOrganizationPerformanceDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            durationUnit,
            segmentedBy,
            filters
          );
          reportData = result.data;
          totalValue = result.totalValue;
          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            durationUnit,
            segmentedBy,
            filters: filters || {},
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating contact organization data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate contact organization data",
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
        graphtype: existinggraphtype,
        colors: existingcolors,
      } = existingReports.dataValues;

      const colorsParsed = JSON.parse(existingcolors);
      const config = JSON.parse(configString);

      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        durationUnit: existingDurationUnit,
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
        reportData: existingReportData,
      } = config;

      if (existingentity === "Contact" && existingtype === "Organization") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for contact organization reports",
          });
        }

        try {
          const result =
            await generateExistingOrganizationPerformanceDataForSave(
              ownerId,
              role,
              existingxaxis,
              existingyaxis,
              existingDurationUnit,
              existingSegmentedBy,
              existingfilters
            );
          reportData = result.data;
          totalValue = result.totalValue;
          reportConfig = {
            reportId,
            entity: existingentity,
            type: existingtype,
            xaxis: existingxaxis,
            yaxis: existingyaxis,
            durationUnit: existingDurationUnit,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating contact organization data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate contact organization data",
            error: error.message,
          });
        }
      }
    }

    // Validate required fields (for create only)
    if (
      !reportId &&
      (!entity || !type || !xaxis || !yaxis || !dashboardIds || !folderId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Entity, type, xaxis, yaxis, dashboardIds, and folderId are required for creating a new report",
      });
    }

    let reports = [];

    // If reportId is present → UPDATE
    if (reportId) {
      const existingReport = await Report.findOne({
        where: { reportId, ownerId },
      });

      if (!existingReport) {
        return res.status(404).json({
          success: false,
          message: "Report not found or access denied",
        });
      }

      const updateData = {
        ...(folderId !== undefined && { folderId }),
        ...(name !== undefined && { name }),
        ...(entity !== undefined && { entity }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(xaxis !== undefined ||
        yaxis !== undefined ||
        filters !== undefined ||
        segmentedBy !== undefined ||
        reportData !== undefined ||
        totalValue !== undefined
          ? {
              config: {
                xaxis: xaxis ?? existingReport.config?.xaxis,
                yaxis: yaxis ?? existingReport.config?.yaxis,
                durationUnit:
                  durationUnit ?? existingReport.config?.durationUnit,
                segmentedBy: segmentedBy ?? existingReport.config?.segmentedBy,
                filters: filters ?? existingReport.config?.filters,
                reportData: reportData ?? existingReport.config?.reportData,
                totalValue: totalValue ?? existingReport.config?.totalValue,
              },
            }
          : {}),
        ...(graphtype !== undefined && { graphtype }),
        ...(colors !== undefined && { colors }),
      };

      // Handle dashboardIds update - store as comma-separated string
      if (dashboardIds !== undefined) {
        const dashboardIdsArray = Array.isArray(dashboardIds)
          ? dashboardIds
          : [dashboardIds];
        updateData.dashboardIds = dashboardIdsArray.join(",");
      }

      await Report.update(updateData, { where: { reportId } });
      const updatedReport = await Report.findByPk(reportId);
      reports.push(updatedReport);

      return res.status(200).json({
        success: true,
        message: "Report updated successfully",
        data: { reports },
      });
    }

    // Otherwise → CREATE
    const dashboardIdsArray = Array.isArray(dashboardIds)
      ? dashboardIds
      : [dashboardIds];

    for (const dashboardId of dashboardIdsArray) {
      // Verify dashboard ownership
      const dashboard = await DASHBOARD.findOne({
        where: { dashboardId, ownerId },
      });
      if (!dashboard) {
        return res.status(404).json({
          success: false,
          message: `Dashboard ${dashboardId} not found or access denied`,
        });
      }
    }
    // Find next position
    const lastReport = await Report.findOne({
      where: { ownerId },
      order: [["position", "DESC"]],
    });
    const nextPosition = lastReport ? lastReport.position || 0 : 0;

    const configObj = {
      xaxis,
      yaxis,
      segmentedBy,
      durationUnit,
      filters: filters || {},
      reportData,
      totalValue,
    };

    const reportName = description || `${entity} ${type}`;

    const newReport = await Report.create({
      dashboardIds: dashboardIdsArray.join(","),
      folderId: folderId || null,
      entity,
      type,
      description: reportName,
      name: name || reportName,
      position: nextPosition,
      config: configObj,
      ownerId,
      graphtype,
      colors,
    });

    reports.push(newReport);

    return res.status(201).json({
      success: true,
      message: "Reports created successfully",
      data: { reports },
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

exports.getOrganizationReportSummary = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      durationUnit = null,
      segmentedBy = "none",
      filters,
      page = 1,
      limit = 500,
      search = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.body;

    const ownerId = req.adminId;
    const role = req.role;

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
        { organization: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
      ];
    }

    // Handle filters if provided
    if (filters && filters.conditions) {
          const validConditions = filters.conditions.filter(
            (cond) => cond.value !== undefined && cond.value !== ""
          );
    
          if (validConditions.length > 0) {
            const filterIncludeModels = [];
            const conditions = validConditions.map((cond) => {
              return getConditionObject(
                cond.column,
                cond.operator,
                cond.value,
                filterIncludeModels
              );
            });
    
            // Add filter includes to main includes
            filterIncludeModels.forEach((newInclude) => {
              const exists = include.some(
                (existingInclude) => existingInclude.as === newInclude.as
              );
              if (!exists) {
                include.push(newInclude);
              }
            });
    
            // Start with the first condition
            let combinedCondition = conditions[0];
    
            // Add remaining conditions with their logical operators
            for (let i = 1; i < conditions.length; i++) {
              const logicalOp = (
                filters.logicalOperators[i - 1] || "AND"
              ).toUpperCase();
    
              if (logicalOp === "AND") {
                combinedCondition = {
                  [Op.and]: [combinedCondition, conditions[i]],
                };
              } else {
                combinedCondition = {
                  [Op.or]: [combinedCondition, conditions[i]],
                };
              }
            }
    
            Object.assign(baseWhere, combinedCondition);
          }
        }

    // Build order clause
    const order = [];
    if (sortBy === "assignedUser") {
      // Sort by masterUserID since we don't have association
      order.push(["masterUserID", sortOrder]);
    } else if (sortBy === "updatedAt") {
      order.push(["updatedAt", sortOrder]);
    } else if (sortBy === "createdAt") {
      order.push(["createdAt", sortOrder]);
    } else {
      order.push([sortBy, sortOrder]);
    }

    // Get total count
    const totalCount = await Organization.count({
      where: baseWhere,
    });

    // Get paginated results
    const organizations = await Organization.findAll({
      where: baseWhere,
      order: order,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "leadOrganizationId",
        "organization",
        "organizationLabels",
        "address",
        "visibleTo",
        // "active",
        "createdAt",
        "updatedAt",
        "masterUserID", // Include masterUserID if you need it
      ],
    });

    // If you need user information, you'll need to fetch it separately
    // since there's no association between Person and MasterUser
    let userMap = {};
    if (organizations.length > 0) {
      // Get all unique user IDs from persons
      const userIds = [
        ...new Set(organizations.map((person) => person.masterUserID)),
      ];

      // Fetch users in bulk
      const users = await MasterUser.findAll({
        where: {
          masterUserID: userIds,
        },
        attributes: ["masterUserID", "name", "email"],
      });

      // Create a map for easy lookup
      userMap = users.reduce((map, user) => {
        map[user.masterUserID] = user;
        return map;
      }, {});
    }

    // Generate report data (like your existing performance report)
    let reportData = [];
    let summary = {};

    if (xaxis && yaxis && !reportId) {
      const reportResult = await generateOrganizationPerformanceData(
        ownerId,
        role,
        xaxis,
        yaxis,
        durationUnit,
        segmentedBy,
        filters,
        page,
        limit
      );
      reportData = reportResult.data;

      if (reportData.length > 0) {
        let totalValue, avgValue, maxValue, minValue;

        if (segmentedBy === "none") {
          // Non-segmented data structure
          const values = reportData.map((item) => item.value || 0);
          totalValue = values.reduce((sum, value) => sum + value, 0);
          avgValue = totalValue / reportData.length;
          maxValue = Math.max(...values);
          minValue = Math.min(...values);
        } else {
          // Segmented data structure - use totalSegmentValue for calculations
          const totalSegmentValues = reportData.map(
            (item) => item.totalSegmentValue || 0
          );
          totalValue = totalSegmentValues.reduce(
            (sum, value) => sum + value,
            0
          );
          avgValue = totalValue / reportData.length;
          maxValue = Math.max(...totalSegmentValues);
          minValue = Math.min(...totalSegmentValues);
        }

        summary = {
          totalRecords: totalCount,
          totalCategories: reportData.length,
          totalValue: totalValue,
          avgValue: parseFloat(avgValue.toFixed(2)),
          maxValue: maxValue,
          minValue: minValue,
        };
      }
    } else if (!xaxis && !yaxis && reportId) {
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
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        durationUnit: existingDurationUnit,
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateOrganizationPerformanceData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        existingDurationUnit,
        existingSegmentedBy,
        existingfilters,
        page,
        limit
      );
      reportData = reportResult.data;

      if (reportData.length > 0) {
        let totalValue, avgValue, maxValue, minValue;

        if (segmentedBy === "none") {
          // Non-segmented data structure
          const values = reportData.map((item) => item.value || 0);
          totalValue = values.reduce((sum, value) => sum + value, 0);
          avgValue = totalValue / reportData.length;
          maxValue = Math.max(...values);
          minValue = Math.min(...values);
        } else {
          // Segmented data structure - use totalSegmentValue for calculations
          const totalSegmentValues = reportData.map(
            (item) => item.totalSegmentValue || 0
          );
          totalValue = totalSegmentValues.reduce(
            (sum, value) => sum + value,
            0
          );
          avgValue = totalValue / reportData.length;
          maxValue = Math.max(...totalSegmentValues);
          minValue = Math.min(...totalSegmentValues);
        }

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

    // Format persons for response
    const formattedPersons = organizations.map((person) => {
      const user = userMap[person.masterUserID];

      return {
        id: person.leadOrganizationId,
        organization: person.organization,
        organizationLabels: person.organizationLabels,
        address: person.address,
        visibleTo: person.visibleTo,
        // active: person.active == true ? "Yes" : "No",
        updatedAt: person.updatedAt,
        createdAt: person.createdAt,
        assignedTo: user
          ? {
              id: user.masterUserID,
              name: user.name,
              email: user.email,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Organization data retrieved successfully",
      data: {
        activities: formattedPersons,
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
    console.error("Error retrieving Organization data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve Organization data",
      error: error.message,
    });
  }
};
