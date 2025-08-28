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

exports.createPersonReport = async (req, res) => {
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
      "contactPerson",
      "organization",
      "email",
      "phone",
      "notes",
      "postalAddress",
      "jobTitle",
      "personLabels",
      "organiztion",
    ];

    const yaxisArray = ["no of people"];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = [
      "contactPerson",
      "organization",
      "email",
      "phone",
      "notes",
      "postalAddress",
      "jobTitle",
      "personLabels",
      "organiztion",


      // Organization table columns (prefix with Organization.)
      "LeadOrganization.organization",
      "LeadOrganization.organizationLabels",
      "LeadOrganization.address",

    ];

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
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
            filters: filters || {},
          };
        } catch (error) {
          console.error("Error generating Contact Person data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Contact Person data",
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
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
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
            entity: existingentity,
            type: existingtype,
            xaxis: existingxaxis,
            yaxis: existingyaxis,
            filters: existingfilters || {},
          };
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
      pagination: paginationInfo,
      config: reportConfig,
      availableOptions: {
        xaxis: xaxisArray,
        yaxis: yaxisArray,
        filters: availableFilterColumns
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

async function generateExistingActivityPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  filters,
  page = 1,
  limit = 6
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
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`LeadPerson.${existingxaxis}`);
    attributes.push([Sequelize.col(`LeadPerson.${existingxaxis}`), "xValue"]);
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

  // Get total count for pagination
  const totalCountResult = await Person.findAll({
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
  const results = await Person.findAll({
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
};

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
    // For regular columns, explicitly specify the LeadPeople table
    groupBy.push(`LeadPerson.${xaxis}`);
    attributes.push([Sequelize.col(`LeadPerson.${xaxis}`), "xValue"]);
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

  // Get total count for pagination
  const totalCountResult = await Person.findAll({
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
  const results = await Person.findAll({
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
};

// Helper function to convert operator strings to Sequelize operators
function getConditionObject(column, operator, value, includeModels = []) {
  let conditionValue = value;

  // Check if column contains a dot (indicating a related table field)
  const hasRelation = column.includes(".");
  let tableAlias = "LeadPerson";
  let fieldName = column;

  if (hasRelation) {
    [tableAlias, fieldName] = column.split(".");
  }

  // Handle different data types
  if (fieldName === "isDone") {
    conditionValue = value === "true" || value === true;
  } else if (fieldName.includes("Date") || fieldName.includes("Time")) {
    conditionValue = new Date(value);
  } else if (!isNaN(value) && value !== "" && typeof value === "string") {
    conditionValue = parseFloat(value);
  }

  // Handle related table joins
  if (hasRelation) {
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
        // If it's not a recognized table, treat it as Activity column
        return getOperatorCondition(column, operator, conditionValue);
    }

    // Check if this include already exists to avoid duplicates
    const existingInclude = includeModels.find(
      (inc) => inc.as === modelConfig.as
    );
    if (!existingInclude) {
      includeModels.push(modelConfig);
    }

    // Return the condition with proper table reference
    return Sequelize.where(
      Sequelize.col(`${modelConfig.as}.${fieldName}`),
      getSequelizeOperator(operator),
      conditionValue
    );
  } else {
    // Regular activity table column
    return getOperatorCondition(column, operator, conditionValue);
  }
};

// Helper function to convert operator strings to Sequelize operators
function getSequelizeOperator(operator) {
  switch (operator) {
    case ">":
      return Op.gt;
    case "<":
      return Op.lt;
    case "=":
      return Op.eq;
    case "≠":
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
    default:
      return Op.eq;
  }
};

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
    default:
      return { [column]: { [op]: value } };
  }
};

exports.savePersonReport = async (req, res) => {
  try {
    const {
      dashboardIds, // Now expecting an array
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
    if (!entity || !type || !xaxis || !yaxis || !dashboardIds || !folderId) {
      return res.status(400).json({
        success: false,
        message: "Entity, type, xaxis, yaxis, dashboardIds, and folderId are required",
      });
    }

    // Ensure dashboardIds is an array
    const dashboardIdsArray = Array.isArray(dashboardIds) ? dashboardIds : [dashboardIds];

    // Verify dashboard ownership for all provided dashboard IDs
    for (const dashboardId of dashboardIdsArray) {
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

    // Check if report already exists with same configuration (xaxis and yaxis)
    const allReports = await Report.findAll({
      where: {
        ownerId,
        entity,
        type,
      },
    });

    // Find report with matching xaxis and yaxis in config
    const existingReport = allReports.find((report) => {
      try {
        const config =
          typeof report.config === "string"
            ? JSON.parse(report.config)
            : report.config;

        return config.xaxis === xaxis && config.yaxis === yaxis;
      } catch (error) {
        console.error("Error parsing config:", error);
        return false;
      }
    });

    let reportData = null;
    let reports = [];

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
      // Update existing report for each dashboard
      const updateData = {
        ...(folderId !== undefined && { folderId }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        config: configObj,
      };

      await Report.update(updateData, {
        where: { reportId: existingReport.reportId },
      });

      const updatedReport = await Report.findByPk(existingReport.reportId);
      reports.push(updatedReport);
    } else {
      // Create new report for each dashboard
      const reportName = description || `${entity} ${type}`;

      for (const dashboardId of dashboardIdsArray) {
        // Get next position for each dashboard
        const lastReport = await Report.findOne({
          where: { dashboardId },
          order: [["position", "DESC"]],
        });
        const nextPosition = lastReport ? (lastReport.position || 0) : 0;

        const report = await Report.create({
          dashboardId,
          folderId: folderId || null,
          entity,
          type,
          description: reportName,
          name: name || reportName,
          position: nextPosition,
          config: configObj,
          ownerId,
        });
        
        reports.push(report);
      }
    }

    res.status(existingReport ? 200 : 201).json({
      success: true,
      message: existingReport
        ? "Report updated successfully"
        : "Reports created successfully",
      data: {
        reports: reports.map(report => ({
          ...report.toJSON(),
          config: report.config,
          reportData,
        })),
      },
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
      filters,
      page = 1,
      limit = 200,
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
    const order = [[sortBy, sortOrder]];

    // Get total count
    const totalCount = await Person.count({
      where: baseWhere,
    });

    // Get paginated results
    const persons = await Person.findAll({
      where: baseWhere,
      order: order,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "personId",
        "contactPerson",
        "organization",
        "createdAt",
        "updatedAt",
        "masterUserID" // Include masterUserID if you need it
      ],
    });

    // If you need user information, you'll need to fetch it separately
    // since there's no association between Person and MasterUser
    let userMap = {};
    if (persons.length > 0) {
      // Get all unique user IDs from persons
      const userIds = [...new Set(persons.map(person => person.masterUserID))];
      
      // Fetch users in bulk
      const users = await MasterUser.findAll({
        where: {
          masterUserID: userIds
        },
        attributes: ["masterUserID", "name", "email"]
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
        filters: existingfilters,
      } = config;

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

    // Format persons for response
    const formattedPersons = persons.map((person) => {
      const user = userMap[person.masterUserID];
      
      return {
        id: person.personId,
        contactPerson: person.contactPerson,
        organization: person.organization,
        updatedAt: person.updatedAt,
        createdAt: person.createdAt,
        assignedTo: user ? {
          id: user.masterUserID,
          name: user.name,
          email: user.email,
        } : null,
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
// exports.getPersonReportSummary = async (req, res) => {
//   try {
//     const {
//       reportId,
//       entity,
//       type,
//       xaxis,
//       yaxis,
//       filters,
//       page = 1,
//       limit = 200,
//       search = "",
//       sortBy = "createdAt",
//       sortOrder = "DESC",
//     } = req.body;

//     const ownerId = req.adminId;
//     const role = req.role;

//     // Validate required fields
//     // if (!entity || !type) {
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: "Entity and type are required",
//     //   });
//     // }

//     // Calculate offset for pagination
//     const offset = (page - 1) * limit;

//     // Base where condition
//     const baseWhere = {};

//     // If user is not admin, filter by ownerId
//     if (role !== "admin") {
//       baseWhere.masterUserID = ownerId;
//     }

//     // Handle search
//     if (search) {
//       baseWhere[Op.or] = [
//         { contactPerson: { [Op.like]: `%${search}%` } },
//         { organization: { [Op.like]: `%${search}%` } },
//         { jobTitle: { [Op.like]: `%${search}%` } },
//         { postalAddress: { [Op.like]: `%${search}%` } },
//         // { "$assignedUser.name$": { [Op.like]: `%${search}%` } },
//       ];
//     }

//     // Handle filters if provided
//     if (filters && filters.conditions) {
//       const validConditions = filters.conditions.filter(
//         (cond) => cond.value !== undefined && cond.value !== ""
//       );

//       if (validConditions.length > 0) {
//         // Start with the first condition
//         let combinedCondition = getConditionObject(
//           validConditions[0].column,
//           validConditions[0].operator,
//           validConditions[0].value
//         );

//         // Add remaining conditions with their logical operators
//         for (let i = 1; i < validConditions.length; i++) {
//           const currentCondition = getConditionObject(
//             validConditions[i].column,
//             validConditions[i].operator,
//             validConditions[i].value
//           );

//           const logicalOp = (
//             filters.logicalOperators[i - 1] || "AND"
//           ).toUpperCase();

//           if (logicalOp === "AND") {
//             combinedCondition = {
//               [Op.and]: [combinedCondition, currentCondition],
//             };
//           } else {
//             combinedCondition = {
//               [Op.or]: [combinedCondition, currentCondition],
//             };
//           }
//         }

//         Object.assign(baseWhere, combinedCondition);
//       }
//     }

//     // Build order clause
//     const order = [];
//     if (sortBy === "assignedUser") {
//       order.push([
//         { model: MasterUser, as: "assignedUser" },
//         "name",
//         sortOrder,
//       ]);
//     } else if (sortBy === "dueDate") {
//       order.push(["endDateTime", sortOrder]);
//     } else if (sortBy === "createdAt") {
//       order.push(["createdAt", sortOrder]);
//     } else {
//       order.push([sortBy, sortOrder]);
//     }

//     // Include assigned user
//     const include = [
//       {
//         model: MasterUser,
//         as: "assignedUser",
//         attributes: ["masterUserID", "name", "email"],
//         required: false,
//       },
//     ];

//     // Get total count
//     const totalCount = await Person.count({
//       where: baseWhere,
//       include: include,
//     });

//     // Get paginated results
//     const persons = await Person.findAll({
//       where: baseWhere,
//       include: include,
//       order: order,
//       limit: parseInt(limit),
//       offset: offset,
//       attributes: [
//         "personId",
//         "contactPerson",
//         "organization",
//         "createdAt",
//         "updatedAt",
//       ],
//     });

//     // Generate report data (like your existing performance report)
//     let reportData = [];
//     let summary = {};

//     if (xaxis && yaxis && !reportId) {
//       const reportResult = await generateActivityPerformanceData(
//         ownerId,
//         role,
//         xaxis,
//         yaxis,
//         filters,
//         page,
//         limit
//       );
//       reportData = reportResult.data;

//       // Calculate summary statistics
//       if (reportData.length > 0) {
//         const totalValue = reportData.reduce(
//           (sum, item) => sum + (item.value || 0),
//           0
//         );
//         const avgValue = totalValue / reportData.length;
//         const maxValue = Math.max(...reportData.map((item) => item.value || 0));
//         const minValue = Math.min(...reportData.map((item) => item.value || 0));

//         summary = {
//           totalRecords: totalCount,
//           totalCategories: reportData.length,
//           totalValue: totalValue,
//           avgValue: parseFloat(avgValue.toFixed(2)),
//           maxValue: maxValue,
//           minValue: minValue,
//         };
//       }
//     } else if (!xaxis && !yaxis && reportId) {
//       const existingReports = await Report.findOne({
//         where: { reportId },
//       });

//       const {
//         entity: existingentity,
//         type: existingtype,
//         config: configString,
//       } = existingReports.dataValues;

//       // Parse the config JSON string
//       const config = JSON.parse(configString);
//       const {
//         xaxis: existingxaxis,
//         yaxis: existingyaxis,
//         filters: existingfilters,
//       } = config;

//       const reportResult = await generateActivityPerformanceData(
//         ownerId,
//         role,
//         existingxaxis,
//         existingyaxis,
//         existingfilters,
//         page,
//         limit
//       );
//       reportData = reportResult.data;

//       // Calculate summary statistics
//       if (reportData.length > 0) {
//         const totalValue = reportData.reduce(
//           (sum, item) => sum + (item.value || 0),
//           0
//         );
//         const avgValue = totalValue / reportData.length;
//         const maxValue = Math.max(...reportData.map((item) => item.value || 0));
//         const minValue = Math.min(...reportData.map((item) => item.value || 0));

//         summary = {
//           totalRecords: totalCount,
//           totalCategories: reportData.length,
//           totalValue: totalValue,
//           avgValue: parseFloat(avgValue.toFixed(2)),
//           maxValue: maxValue,
//           minValue: minValue,
//         };
//       }
//     }

//     // Format activities for response
//     const formattedPersons = persons.map((person) => ({
//       id: person.personId,
//       contactPerson: person.contactPerson,
//       organization: person.organization,
//       updatedAt: person.updatedAt,
//       createdAt: person.createdAt,
//       assignedTo: person.assignedUser
//         ? {
//             id: person.assignedUser.masterUserID,
//             name: person.assignedUser.name,
//             email: person.assignedUser.email,
//           }
//         : null,
//     }));

//     const totalPages = Math.ceil(totalCount / limit);

//     res.status(200).json({
//       success: true,
//       message: "Persons data retrieved successfully",
//       data: {
//         activities: formattedPersons,
//         reportData: reportData,
//         summary: summary,
//       },
//       pagination: {
//         currentPage: parseInt(page),
//         totalPages: totalPages,
//         totalItems: totalCount,
//         itemsPerPage: parseInt(limit),
//         hasNextPage: page < totalPages,
//         hasPrevPage: page > 1,
//       },
//     });
//   } catch (error) {
//     console.error("Error retrieving Persons data:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve Persons data",
//       error: error.message,
//     });
//   }
// };


exports.createOrganizationReport = async (req, res) => {
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
      "organization",
      "organizationLabels",
      "address",
    ];

    const yaxisArray = ["no of organizations"];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = [

      // Organization table columns (prefix with Organization.)
      "organization",
      "organizationLabels",
      "address",

    ];

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
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
            filters: filters || {},
          };
        } catch (error) {
          console.error("Error generating Contact Organization data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Contact Organization data",
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
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
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

        try {
          // Generate data with pagination
          const result = await generateExistingOrganizationPerformanceData(
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
            entity: existingentity,
            type: existingtype,
            xaxis: existingxaxis,
            yaxis: existingyaxis,
            filters: existingfilters || {},
          };
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

    return res.status(200).json({
      success: true,
      message: "Data generated successfully",
      data: reportData,
      pagination: paginationInfo,
      config: reportConfig,
      availableOptions: {
        xaxis: xaxisArray,
        yaxis: yaxisArray,
        filters: availableFilterColumns
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

async function generateExistingOrganizationPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  filters,
  page = 1,
  limit = 6
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
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`LeadOrganization.${existingxaxis}`);
    attributes.push([Sequelize.col(`LeadOrganization.${existingxaxis}`), "xValue"]);
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

  // Get total count for pagination
  const totalCountResult = await Organization.findAll({
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
  const results = await Organization.findAll({
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
};

// Helper function to generate activity performance data with pagination
async function generateOrganizationPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
  filters,
  page = 1,
  limit = 6
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
    // For regular columns, explicitly specify the LeadPeople table
    groupBy.push(`LeadOrganization.${xaxis}`);
    attributes.push([Sequelize.col(`LeadOrganization.${xaxis}`), "xValue"]);
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
    // For other yaxis values, explicitly specify the LeadPeople table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`LeadOrganization.${yaxis}`)),
      "yValue",
    ]);
  }

  // Get total count for pagination
  const totalCountResult = await Organization.findAll({
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
  const results = await Organization.findAll({
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
};

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

  // Handle different data types
  if (fieldName === "isDone") {
    conditionValue = value === "true" || value === true;
  } else if (fieldName.includes("Date") || fieldName.includes("Time")) {
    conditionValue = new Date(value);
  } else if (!isNaN(value) && value !== "" && typeof value === "string") {
    conditionValue = parseFloat(value);
  }

  // Handle related table joins
if (hasRelation) {
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
        // If it's not a recognized table, treat it as Activity column
        return getOperatorCondition(column, operator, conditionValue);
    }

    // Check if this include already exists to avoid duplicates
    const existingInclude = includeModels.find(
      (inc) => inc.as === modelConfig.as
    );
    if (!existingInclude) {
      includeModels.push(modelConfig);
    }

    // Return the condition with proper table reference
    return Sequelize.where(
      Sequelize.col(`${modelConfig.as}.${fieldName}`),
      getSequelizeOperator(operator),
      conditionValue
    );
  } else {
    // Regular activity table column
    return getOperatorCondition(column, operator, conditionValue);
  }
};

// Helper function to convert operator strings to Sequelize operators
function getSequelizeOperator(operator) {
  switch (operator) {
    case ">":
      return Op.gt;
    case "<":
      return Op.lt;
    case "=":
      return Op.eq;
    case "≠":
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
    default:
      return Op.eq;
  }
};

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
    default:
      return { [column]: { [op]: value } };
  }
};

exports.saveOrganizationReport = async (req, res) => {
  try {
    const {
      dashboardIds, // Now expecting an array
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
    if (!entity || !type || !xaxis || !yaxis || !dashboardIds || !folderId) {
      return res.status(400).json({
        success: false,
        message: "Entity, type, xaxis, yaxis, dashboardIds, and folderId are required",
      });
    }

    // Ensure dashboardIds is an array
    const dashboardIdsArray = Array.isArray(dashboardIds) ? dashboardIds : [dashboardIds];

    // Verify dashboard ownership for all provided dashboard IDs
    for (const dashboardId of dashboardIdsArray) {
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

    // Check if report already exists with same configuration (xaxis and yaxis)
    const allReports = await Report.findAll({
      where: {
        ownerId,
        entity,
        type,
      },
    });

    // Find report with matching xaxis and yaxis in config
    const existingReport = allReports.find((report) => {
      try {
        const config =
          typeof report.config === "string"
            ? JSON.parse(report.config)
            : report.config;

        return config.xaxis === xaxis && config.yaxis === yaxis;
      } catch (error) {
        console.error("Error parsing config:", error);
        return false;
      }
    });

    let reportData = null;
    let reports = [];

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
      // Update existing report for each dashboard
      const updateData = {
        ...(folderId !== undefined && { folderId }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        config: configObj,
      };

      await Report.update(updateData, {
        where: { reportId: existingReport.reportId },
      });

      const updatedReport = await Report.findByPk(existingReport.reportId);
      reports.push(updatedReport);
    } else {
      // Create new report for each dashboard
      const reportName = description || `${entity} ${type}`;

      for (const dashboardId of dashboardIdsArray) {
        // Get next position for each dashboard
        const lastReport = await Report.findOne({
          where: { dashboardId },
          order: [["position", "DESC"]],
        });
        const nextPosition = lastReport ? (lastReport.position || 0) : 0;

        const report = await Report.create({
          dashboardId,
          folderId: folderId || null,
          entity,
          type,
          description: reportName,
          name: name || reportName,
          position: nextPosition,
          config: configObj,
          ownerId,
        });
        
        reports.push(report);
      }
    }

    res.status(existingReport ? 200 : 201).json({
      success: true,
      message: existingReport
        ? "Report updated successfully"
        : "Reports created successfully",
      data: {
        reports: reports.map(report => ({
          ...report.toJSON(),
          config: report.config,
          reportData,
        })),
      },
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
      filters,
      page = 1,
      limit = 200,
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
    const order = [[sortBy, sortOrder]];

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
        "createdAt",
        "updatedAt",
        "masterUserID" // Include masterUserID if you need it
      ],
    });

    // If you need user information, you'll need to fetch it separately
    // since there's no association between Person and MasterUser
    let userMap = {};
    if (organizations.length > 0) {
      // Get all unique user IDs from persons
      const userIds = [...new Set(organizations.map(person => person.masterUserID))];
      
      // Fetch users in bulk
      const users = await MasterUser.findAll({
        where: {
          masterUserID: userIds
        },
        attributes: ["masterUserID", "name", "email"]
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
        filters: existingfilters,
      } = config;

      const reportResult = await generateOrganizationPerformanceData(
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

    // Format persons for response
    const formattedPersons = organizations.map((person) => {
      const user = userMap[person.masterUserID];
      
      return {
        id: person.personId,
        contactPerson: person.contactPerson,
        organization: person.organization,
        updatedAt: person.updatedAt,
        createdAt: person.createdAt,
        assignedTo: user ? {
          id: user.masterUserID,
          name: user.name,
          email: user.email,
        } : null,
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