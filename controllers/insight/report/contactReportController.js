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

exports.createPersonReport = async (req, res) => {
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
      { label: "Contact Person", value: "contactPerson", type: "Person" },
      { label: "Organization", value: "organization", type: "Person" },
      { label: "Email", value: "email", type: "Person" },
      { label: "Phone", value: "phone", type: "Person" },
      { label: "Notes", value: "notes", type: "Person" },
      { label: "Postal Address", value: "postalAddress", type: "Person" },
      { label: "Job Title", value: "jobTitle", type: "Person" },
      { label: "Person Labels", value: "personLabels", type: "Person" },
      { label: "Add On", value: "createdAt", type: "Date" },
      { label: "Updated On", value: "updatedAt", type: "Date" },
    ];

    const segmentedByOptions = [
      { label: "None", value: "none" },
      { label: "Contact Person", value: "contactPerson" },
      { label: "Organization", value: "organization" },
      { label: "Email", value: "email" },
      { label: "Phone", value: "phone" },
      { label: "Notes", value: "notes" },
      { label: "Postal Address", value: "postalAddress" },
      { label: "Job Title", value: "jobTitle" },
      { label: "Person Labels", value: "personLabels" },
    ];

    const yaxisArray = [
      { label: "No of People", value: "no of people", type: "Person" },
    ];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Person: [
        { label: "Email", value: "email", type: "text" },
        { label: "Phone", value: "phone", type: "number" },
        { label: "Notes", value: "notes", type: "text" },
        { label: "Postal Address", value: "postalAddress", type: "text" },
        { label: "Job Title", value: "jobTitle", type: "text" },
        { label: "Contact Person", value: "contactPerson", type: "text" },
        { label: "Organization", value: "organization", type: "text" },
        { label: "Person Labels", value: "personLabels", type: "text" },
        { label: "Created At", value: "createdAt", type: "date" },
        { label: "Updated At", value: "updatedAt", type: "date" },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
      Organization: [
        {
          label: "Organization",
          value: "LeadOrganization.organization",
          type: "text",
        },
        {
          label: "Organization Labels",
          value: "LeadOrganization.organizationLabels",
          type: "text",
        },
        { label: "Address", value: "LeadOrganization.address", type: "text" },
        {
          label: "Created At",
          value: "LeadOrganization.createdAt",
          type: "date",
        },
        {
          label: "Updated At",
          value: "LeadOrganization.updatedAt",
          type: "date",
        },
        {
          label: "Add on",
          value: "LeadOrganization.daterange",
          type: "daterange",
        },
      ],
    };

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    let totalValue = 0;
    let summary = null;
    let reportConfig = null;

    if (entity && type && !reportId) {
      if (entity === "Contact" && type === "Person") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Contact Person reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generatePersonPerformanceData(
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
              ...reportData.map(
                (item) => item.value || item.totalSegmentValue || 0
              )
            );
            const minValue = Math.min(
              ...reportData.map(
                (item) => item.value || item.totalSegmentValue || 0
              )
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
          console.error("Error generating Contact Person data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Contact Person data",
            error: error.message,
          });
        }
      }
    } else if ((!entity && !type && reportId) || (entity && type && reportId)) {
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

      if (existingentity === "Contact" && existingtype === "Person") {
        // Validate required fields for Person reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Contact Person reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateExistingPersonPerformanceData(
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
              ...reportData.map(
                (item) => item.value || item.totalSegmentValue || 0
              )
            );
            const minValue = Math.min(
              ...reportData.map(
                (item) => item.value || item.totalSegmentValue || 0
              )
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
          console.error("Error generating Contact Person data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Contact Person data",
            error: error.message,
          });
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

async function generateExistingPersonPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
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

  // Handle filters if provided
  // In your generateActivityPerformanceData function, modify the filter handling:
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

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  // Handle existingxaxis special cases
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
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([
      Sequelize.col("LeadPerson.masterUserID"),
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
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("LeadPerson.leadOrganizationId");
    attributes.push([
      Sequelize.col("LeadPerson.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`LeadPerson.${existingxaxis}`);
    attributes.push([Sequelize.col(`LeadPerson.${existingxaxis}`), "xValue"]);
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
      (existingSegmentedBy === "assignedTo" && assignedUserIncludeExists)
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && assignedUserIncludeExists) {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("LeadPerson.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else {
      groupBy.push(`LeadPerson.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadPerson.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of people") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("personId")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadPerson.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Pagination and Query logic
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await LeadPerson.findAll({
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
    } else if (existingxaxis === "organization") {
      countColumn = Sequelize.col("LeadPerson.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`LeadPerson.${existingxaxis}`);
    }

    totalCountResult = await LeadPerson.findAll({
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
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("LeadPerson.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`LeadPerson.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await LeadPerson.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadPerson.${existingxaxis}`), "ASC"]]
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
      } else if (existingxaxis === "organization") {
        groupCondition = { leadOrganizationId: { [Op.in]: groupKeys } };
      } else {
        groupCondition = { [existingxaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await LeadPerson.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
        ? [[Sequelize.col(`LeadPerson.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
      });
    }
  } else {
    results = await LeadPerson.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadPerson.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
      limit: limit,
      offset: offset,
    });
  }

  // --- NEW FORMATTING AND TOTALING LOGIC ---
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      let xValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;

        if (existingxaxis === "contactPerson") {
          id = item.personId || null;
        } else if (existingxaxis === "organization") {
          id = item.leadOrganizationId || null;
        } else if (
          existingxaxis === "Owner" ||
          existingxaxis === "assignedTo"
        ) {
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
    // Logic for non-segmented data
    formattedResults = results.map((item) => {
      let label =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      // Set proper ID based on xaxis type
      let id = null;
      if (existingxaxis === "contactPerson") {
        id = item.personId || null;
      } else if (existingxaxis === "organization") {
        id = item.leadOrganizationId || null;
      } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
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
async function generatePersonPerformanceData(
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

  // Handle filters if provided
  // In your generateActivityPerformanceData function, modify the filter handling:
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
  // let attributes = ["personId", "leadOrganizationId"];

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(xaxis);
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

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
    attributes.push([
      Sequelize.col("LeadPerson.masterUserID"),
      "assignedUserId",
    ]);
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
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("LeadPerson.leadOrganizationId");
    attributes.push([
      Sequelize.col("LeadPerson.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the LeadPeople table
    groupBy.push(`LeadPerson.${xaxis}`);
    attributes.push([Sequelize.col(`LeadPerson.${xaxis}`), "xValue"]);
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
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("LeadPerson.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else if (
      segmentedBy === "Owner" ||
      (segmentedBy === "assignedTo" && !assignedUserIncludeExists)
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`LeadPerson.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadPerson.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle yaxis
  if (yaxis === "no of people") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("personId")),
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
    // For other yaxis values, explicitly specify the LeadPeople table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadPerson.${yaxis}`)),
      "yValue",
    ]);
  }

  // Total count calculation
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Person.findAll({
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
      countColumn = Sequelize.col("assignedUser.name");
    } else if (xaxis === "organization") {
      countColumn = Sequelize.col("LeadPerson.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`LeadPerson.${xaxis}`);
    }

    totalCountResult = await Person.findAll({
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
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("LeadPerson.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`LeadPerson.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await LeadPerson.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: getOrderClause(yaxis, xaxis),
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
      } else if (xaxis === "organization") {
        // For organization - use proper column reference
        groupCondition = { leadOrganizationId: { [Op.in]: groupKeys } };
      } else {
        // For regular columns
        groupCondition = { [xaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await LeadPerson.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`LeadPerson.${xaxis}`), "ASC"]] 
          : [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    // Non-segmented query
    results = await LeadPerson.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
          ? [[Sequelize.col(`LeadPerson.${xaxis}`), "ASC"]] 
          : [[Sequelize.literal("yValue"), "DESC"]],
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
      let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";

      const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;
        if (xaxis === "contactPerson") {
          id = item.personId || null;
        } else if (xaxis === "organization") {
          id = item.leadOrganizationId || null;
        } else if (xaxis === "Owner" || xaxis === "assignedTo") {
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

    formattedResults = Object.values(groupedData); // Calculate and add total for each segment group

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
      if (xaxis === "contactPerson") {
        id = item.personId || null;
      } else if (xaxis === "organization") {
        id = item.leadOrganizationId || null;
      } else if (xaxis === "Owner" || xaxis === "assignedTo") {
        id = item.assignedUserId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });
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

function getConditionObject(column, operator, value, includeModels = []) {
  let conditionValue = value;

  // Check if column contains a dot (indicating a related table field)
  const hasRelation = column.includes(".");
  let tableAlias = "LeadPerson";
  let fieldName = column;

  if (hasRelation) {
    [tableAlias, fieldName] = column.split(".");
  }

  // Handle date filtering for specific date columns
  const isDateColumn =
    fieldName.includes("Date") ||
    fieldName.includes("Time") ||
    fieldName === "startDateTime" ||
    fieldName === "endDateTime" ||
    fieldName === "dueDate" ||
    fieldName === "createdAt" ||
    fieldName === "updatedAt" ||
    fieldName === "expectedCloseDate" ||
    fieldName === "proposalSentDate";

  // Handle date range filtering for "Add on" (daterange type)
  const isDateRangeFilter = fieldName === "daterange";

  if (isDateRangeFilter && Array.isArray(value)) {
    // Handle date range filter (from frontend: ["2025-06-23", "2025-06-25"])
    const [fromDate, toDate] = value;

    // Determine which date field to filter based on the table alias
    let dateField;
    switch (tableAlias) {
      case "LeadOrganization":
        dateField = "createdAt";
        break;
      default:
        dateField = "createdAt";
    }

    // For related tables, use the proper Sequelize syntax
    if (tableAlias !== "LeadPerson") {
      // Add the required include model
      addIncludeModel(tableAlias, includeModels);

      // Return the condition with proper nested syntax
      if (operator === "between" || operator === "=" || operator === "is") {
        return {
          [`$${tableAlias}.${dateField}$`]: {
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
        return {
          [`$${tableAlias}.${dateField}$`]: {
            [Op.notBetween]: [
              new Date(fromDate + " 00:00:00"),
              new Date(toDate + " 23:59:59"),
            ],
          },
        };
      }
    } else {
      // For Activity table
      if (operator === "between" || operator === "=" || operator === "is") {
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
        return {
          [dateField]: {
            [Op.notBetween]: [
              new Date(fromDate + " 00:00:00"),
              new Date(toDate + " 23:59:59"),
            ],
          },
        };
      }
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

    // Use proper Sequelize syntax for related table conditions
    switch (operator) {
      case "contains":
        return {
          [`$${tableAlias}.${fieldName}$`]: { [op]: `%${conditionValue}%` },
        };
      case "startsWith":
        return {
          [`$${tableAlias}.${fieldName}$`]: { [op]: `${conditionValue}%` },
        };
      case "endsWith":
        return {
          [`$${tableAlias}.${fieldName}$`]: { [op]: `%${conditionValue}` },
        };
      case "isEmpty":
        return {
          [Op.or]: [
            { [`$${tableAlias}.${fieldName}$`]: { [Op.is]: null } },
            { [`$${tableAlias}.${fieldName}$`]: { [Op.eq]: "" } },
          ],
        };
      case "isNotEmpty":
        return {
          [Op.and]: [
            { [`$${tableAlias}.${fieldName}$`]: { [Op.not]: null } },
            { [`$${tableAlias}.${fieldName}$`]: { [Op.ne]: "" } },
          ],
        };
      default:
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: conditionValue } };
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
  const field = `LeadPerson.${dateField}`;

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
    return [[Sequelize.col(`LeadPerson.${xaxis}`), "ASC"]];
  }
  if (yaxis === "no of people") {
    return [[Sequelize.fn("COUNT", Sequelize.col("personId")), "DESC"]];
  } else {
    return [
      [Sequelize.fn("SUM", Sequelize.col(`LeadPerson.${yaxis}`)), "DESC"],
    ];
  }
}

async function generateExistingPersonPerformanceDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  filters
) {
  let includeModels = [];
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

  let groupBy = [];
  let attributes = [];

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  // Handle existingxaxis special cases
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
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([
      Sequelize.col("LeadPerson.masterUserID"),
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
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("LeadPerson.leadOrganizationId");
    attributes.push([
      Sequelize.col("LeadPerson.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`LeadPerson.${existingxaxis}`);
    attributes.push([Sequelize.col(`LeadPerson.${existingxaxis}`), "xValue"]);
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
      (existingSegmentedBy === "assignedTo" && assignedUserIncludeExists)
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && assignedUserIncludeExists) {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("LeadPerson.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else {
      groupBy.push(`LeadPerson.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadPerson.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of people") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("personId")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadPerson.${existingyaxis}`)),
      "yValue",
    ]);
  }

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // For segmented queries - get all results without pagination
    results = await LeadPerson.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadPerson.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
    });
  } else {
    // Get all results without pagination
    results = await LeadPerson.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadPerson.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
    });
  }

  // Formatting and totaling logic
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      let xValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;

        if (existingxaxis === "contactPerson") {
          id = item.personId || null;
        } else if (existingxaxis === "organization") {
          id = item.leadOrganizationId || null;
        } else if (
          existingxaxis === "Owner" ||
          existingxaxis === "assignedTo"
        ) {
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
    // Logic for non-segmented data
    formattedResults = results.map((item) => {
      let label =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      // Set proper ID based on xaxis type
      let id = null;
      if (existingxaxis === "contactPerson") {
        id = item.personId || null;
      } else if (existingxaxis === "organization") {
        id = item.leadOrganizationId || null;
      } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
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

// Helper function to generate activity performance data without pagination
async function generatePersonPerformanceDataForSave(
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

  let groupBy = [];
  let attributes = [];

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(xaxis);
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

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
    attributes.push([
      Sequelize.col("LeadPerson.masterUserID"),
      "assignedUserId",
    ]);
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
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("LeadPerson.leadOrganizationId");
    attributes.push([
      Sequelize.col("LeadPerson.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the LeadPeople table
    groupBy.push(`LeadPerson.${xaxis}`);
    attributes.push([Sequelize.col(`LeadPerson.${xaxis}`), "xValue"]);
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
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("LeadPerson.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else if (
      segmentedBy === "Owner" ||
      (segmentedBy === "assignedTo" && !assignedUserIncludeExists)
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`LeadPerson.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`LeadPerson.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle yaxis
  if (yaxis === "no of people") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("personId")),
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
    // For other yaxis values, explicitly specify the LeadPeople table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadPerson.${yaxis}`)),
      "yValue",
    ]);
  }

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    // For segmented queries - get all results without pagination
    results = await LeadPerson.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadPerson.${xaxis}`), "ASC"]] 
        : [[Sequelize.literal("yValue"), "DESC"]],
    });
  } else {
    // Non-segmented query - get all results without pagination
    results = await LeadPerson.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`LeadPerson.${xaxis}`), "ASC"]] 
        : [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};

    results.forEach((item) => {
      let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";

      const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set proper ID based on xaxis type
        let id = null;
        if (xaxis === "contactPerson") {
          id = item.personId || null;
        } else if (xaxis === "organization") {
          id = item.leadOrganizationId || null;
        } else if (xaxis === "Owner" || xaxis === "assignedTo") {
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
      if (xaxis === "contactPerson") {
        id = item.personId || null;
      } else if (xaxis === "organization") {
        id = item.leadOrganizationId || null;
      } else if (xaxis === "Owner" || xaxis === "assignedTo") {
        id = item.assignedUserId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

exports.savePersonReport = async (req, res) => {
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
      if (entity === "Contact" && type === "Person") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Contact Person reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generatePersonPerformanceDataForSave(
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
            segmentedBy,
            durationUnit,
            filters: filters || {},
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating contact person data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate contact person data",
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
        segmentedBy: existingSegmentedBy,
        durationUnit: existingDurationUnit,
        filters: existingfilters,
        reportData: existingReportData,
      } = config;

      if (existingentity === "Contact" && existingtype === "Person") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for contact person reports",
          });
        }

        try {
          const result = await generateExistingPersonPerformanceDataForSave(
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
            segmentedBy: existingSegmentedBy,
            durationUnit: existingDurationUnit,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating contact person data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate contact person data",
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
                segmentedBy: segmentedBy ?? existingReport.config?.segmentedBy,
                durationUnit:
                  durationUnit ?? existingReport.config?.durationUnit,
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

exports.getPersonReportSummary = async (req, res) => {
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
        { contactPerson: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } },
        { jobTitle: { [Op.like]: `%${search}%` } },
        { postalAddress: { [Op.like]: `%${search}%` } },
      ];
    }

    // Initialize include array for main query (empty for now)
    const include = [];

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
    const totalCount = await Person.count({
      where: baseWhere,
      include: include.length > 0 ? include : undefined,
    });

    // Get paginated results
    const persons = await Person.findAll({
      where: baseWhere,
      include: include.length > 0 ? include : undefined,
      order: order,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "personId",
        "contactPerson",
        "organization",
        "email",
        "phone",
        "notes",
        "postalAddress",
        "birthday",
        "jobTitle",
        "personLabels",
        "createdAt",
        "updatedAt",
        "masterUserID",
      ],
    });

    // Get user information separately since there's no association
    let userMap = {};
    if (persons.length > 0) {
      // Get all unique user IDs from persons
      const userIds = [
        ...new Set(
          persons.map((person) => person.masterUserID).filter(Boolean)
        ),
      ];

      if (userIds.length > 0) {
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
    }

    // Generate report data (like your existing performance report)
    let reportData = [];
    let summary = {};

    if (xaxis && yaxis && !reportId) {
      const reportResult = await generatePersonPerformanceData(
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

      if (!existingReports) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

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

      const reportResult = await generateExistingPersonPerformanceData(
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

        if (existingSegmentedBy === "none") {
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
    } else {
      // Default summary when no report data is generated
      summary = {
        totalRecords: totalCount,
        totalCategories: 0,
        totalValue: 0,
        avgValue: 0,
        maxValue: 0,
        minValue: 0,
      };
    }

    // Format persons for response
    const formattedPersons = persons.map((person) => {
      const user = userMap[person.masterUserID];

      return {
        id: person.personId,
        contactPerson: person.contactPerson,
        organization: person.organization,
        updatedAt: person.updatedAt,
        createdAt: person.createdAt,
        email: person.email,
        phone: person.phone,
        notes: person.notes,
        postalAddress: person.postalAddress,
        birthday: person.birthday,
        jobTitle: person.jobTitle,
        personLabels: person.personLabels,
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
      message: "Persons data retrieved successfully",
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
    console.error("Error retrieving Persons data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve Persons data",
      error: error.message,
    });
  }
};

