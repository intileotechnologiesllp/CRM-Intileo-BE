const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Deal = require("../../../models/deals/dealsModels");
const Lead = require("../../../models/leads/leadsModel");
const Deal = require("../../../models/deals/dealsModels");
const Organization = require("../../../models/leads/leadOrganizationModel");
const Person = require("../../../models/leads/leadPersonModel");
const MasterUser = require("../../../models/master/masterUserModel");
const ReportFolder = require("../../../models/insight/reportFolderModel");
const { Op, Sequelize } = require("sequelize");
const { Pipeline } = require("../../../models");

exports.createDealPerformReport = async (req, res) => {
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
      "esplProposalNo",
      "numberOfReportsPrepared",
      "organizationCountry",
      "projectLocation",
      "proposalSentDate",
    //   "ownerName",
      "sbuClass",
      "status",
      "scopeOfServiceType",
      "serviceType",
      "sourceChannel",
      "sourceChannelID",
      "sourceOrigin",
    //   "sourceOriginID",
      "contactPerson",
      "organization",
    //   "proposalValueCurrency",
      "conversionDate",
      "createdAt",
      "updatedAt",
      "creator",
      "creatorstatus"
    ];

    const yaxisArray = ["no of deals", "proposalValue", "value", "weightedValue", "productQuantity", "productAmount"];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = [
      // Lead table columns
      "esplProposalNo",
      "numberOfReportsPrepared",
      "organizationCountry",
      "projectLocation",
      "proposalSentDate",
      "ownerName",
      "SBUClass",
      "status",
      "scopeOfServiceType",
      "serviceType",
      "sourceChannel",
      "sourceChannelID",
      "sourceOrigin",
      "sourceOriginID",
      "contactPerson",
      "organization",
      "proposalValueCurrency",
      "conversionDate",
      "createdAt",
      "updatedAt",

      // Organization table columns (prefix with Organization.)
      "Organization.organization",
      "Organization.organizationLabels",
      "Organization.address",

      // Person table columns (prefix with Person.)
      "Person.contactPerson",
      "Person.postalAddress",
      "Person.email",
      "Person.phone",
      "Person.jobTitle",
      "Person.personLabels",
      "Person.organization",

      // Lead table columns (prefix with Lead.)
      "Lead.contactPerson",
      "Lead.organization",
      "Lead.title",
      "Lead.valueLabels",
      "Lead.expectedCloseDate",
      "Lead.sourceChannel",
      "Lead.sourceChannelID",
      "Lead.serviceType",
      "Lead.scopeOfServiceType",
      "Lead.phone",
      "Lead.email",
      "Lead.company",
      "Lead.proposalValue",
      "Lead.esplProposalNo",
      "Lead.projectLocation",
      "Lead.organizationCountry",
      "Lead.proposalSentDate",
      "Lead.status",
      "Lead.SBUClass",
      "Lead.sectoralSector",
      "Lead.sourceOrigin",
      "Lead.leadQuality",
      "Lead.value",
      "Lead.proposalValueCurrency",
      "Lead.valueCurrency",
    ];

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if (entity && type) {
      if (entity === "Deal" && type === "Performance") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deak Performance reports",
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
            limit,
            type
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
          console.error("Error generating deal performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal performance data",
            error: error.message,
          });
        }
      }
    } 
    else if (reportId) {
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

      if (existingentity === "Deal" && existingtype === "Performance") {
        // Validate required fields for performance reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deal Performance reports",
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
            limit,
            type
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
          console.error("Error generating deal performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal performance data",
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
  limit = 6,
  type
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
  if (existingxaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Handle existingyaxis
  if (existingyaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("dealId")),
      "yValue",
    ]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("proposalValue")),
      "yValue",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("value")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Get total count for pagination
  const totalCountResult = await Deal.findAll({
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
  const results = await Deal.findAll({
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
  limit = 6,
  type
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

  if (xaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
  }

  // Handle existingyaxis
  if (yaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("dealId")),
      "yValue",
    ]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("proposalValue")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)),
      "yValue",
    ]);
  }

  // Get total count for pagination
  const totalCountResult = await Deal.findAll({
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
  const results = await Deal.findAll({
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
// Enhanced helper function to handle related table conditions
function getConditionObject(column, operator, value, includeModels = []) {
  let conditionValue = value;

  // Check if column contains a dot (indicating a related table field)
  const hasRelation = column.includes(".");
  let tableAlias = "Deal";
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
      case "Lead":
        modelConfig = {
          model: Lead,
          as: "Lead",
          required: false, // Use false to avoid INNER JOIN issues
          attributes: [],
        };
        break;
      case "Organization":
        modelConfig = {
          model: Organization,
          as: "Organization",
          required: false,
          attributes: [],
        };
        break;
      case "Person":
        modelConfig = {
          model: Person,
          as: "Person",
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
    default:
      return { [column]: { [op]: value } };
  }
}

exports.saveDealPerformReport = async (req, res) => {
  try {
    const {
      dashboardIds,
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
        message: "Entity, type, xaxis, and yaxis are required",
      });
    }

    // Ensure dashboardIds is an array
    const dashboardIdsArray = Array.isArray(dashboardIds) ? dashboardIds : [dashboardIds];

    // Verify dashboard ownership if dashboardId is provided
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
      // Update existing report
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
      // Create new report
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


exports.getDealPerformReportSummary = async (req, res) => {
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
        { title: { [Op.like]: `%${search}%` } },
        { value: { [Op.like]: `%${search}%` } },
        { ownerName: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { pipeline: { [Op.like]: `%${search}%` } },
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
    if (sortBy === "Owner") {
      order.push([
        { model: MasterUser, as: "Owner" },
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
        as: "Owner",
        attributes: ["masterUserID", "name", "email"],
        required: false,
      },
    ];

    // Get total count
    const totalCount = await Deal.count({
      where: baseWhere,
      include: include,
    });

    // Get paginated results
    const leads = await Deal.findAll({
      where: baseWhere,
      include: include,
      order: order,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "dealId",
        "title",
        "value",
        "ownerName",
        "status",
        "createdAt",
        "expectedCloseDate"
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

    // Format activities for response
    const formattedActivities = leads.map((lead) => ({
      id: lead.dealId,
      title: lead.title,
      value: lead.value,
      ownerName: lead.ownerName,
      status: lead.status,
      createdAt: lead.createdAt,
      expectedCloseDate: lead.expectedCloseDate
        ? {
            id: lead.Owner.masterUserID,
            name: lead.Owner.name,
            email: lead.Owner.email,
          }
        : null,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Leads data retrieved successfully",
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
    console.error("Error retrieving leads data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve leads data",
      error: error.message,
    });
  }
};


exports.createDealConversionReport = async (req, res) => {
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
      "esplProposalNo",
      "numberOfReportsPrepared",
      "organizationCountry",
      "projectLocation",
      "proposalSentDate",
    //   "ownerName",
      "sbuClass",
      "status",
      "scopeOfServiceType",
      "serviceType",
      "sourceChannel",
      "sourceChannelID",
      "sourceOrigin",
    //   "sourceOriginID",
      "contactPerson",
      "organization",
    //   "proposalValueCurrency",
      "conversionDate",
      "createdAt",
      "updatedAt",
      "creator",
      "creatorstatus"
    ];

    const yaxisArray = ["no of deals", "proposalValue", "value", "weightedValue", "productQuantity", "productAmount"];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = [
      // Lead table columns
      "esplProposalNo",
      "numberOfReportsPrepared",
      "organizationCountry",
      "projectLocation",
      "proposalSentDate",
      "ownerName",
      "SBUClass",
      "status",
      "scopeOfServiceType",
      "serviceType",
      "sourceChannel",
      "sourceChannelID",
      "sourceOrigin",
      "sourceOriginID",
      "contactPerson",
      "organization",
      "proposalValueCurrency",
      "conversionDate",
      "createdAt",
      "updatedAt",

      // Organization table columns (prefix with Organization.)
      "Organization.organization",
      "Organization.organizationLabels",
      "Organization.address",

      // Person table columns (prefix with Person.)
      "Person.contactPerson",
      "Person.postalAddress",
      "Person.email",
      "Person.phone",
      "Person.jobTitle",
      "Person.personLabels",
      "Person.organization",

      // Lead table columns (prefix with Lead.)
      "Lead.contactPerson",
      "Lead.organization",
      "Lead.title",
      "Lead.valueLabels",
      "Lead.expectedCloseDate",
      "Lead.sourceChannel",
      "Lead.sourceChannelID",
      "Lead.serviceType",
      "Lead.scopeOfServiceType",
      "Lead.phone",
      "Lead.email",
      "Lead.company",
      "Lead.proposalValue",
      "Lead.esplProposalNo",
      "Lead.projectLocation",
      "Lead.organizationCountry",
      "Lead.proposalSentDate",
      "Lead.status",
      "Lead.SBUClass",
      "Lead.sectoralSector",
      "Lead.sourceOrigin",
      "Lead.leadQuality",
      "Lead.value",
      "Lead.proposalValueCurrency",
      "Lead.valueCurrency",
    ];

    // For Activity Conversion reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if (entity && type) {
      if (entity === "Deal" && type === "Conversion") {
        // Validate required fields for Conversion reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deak Conversion reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateConversionActivityPerformanceData(
            ownerId,
            role,
            xaxis,
            yaxis,
            filters,
            page,
            limit,
            type
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
          console.error("Error generating deal Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal Conversion data",
            error: error.message,
          });
        }
      }
    } 
    else if (reportId) {
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

      if (existingentity === "Deal" && existingtype === "Conversion") {
        // Validate required fields for performance reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deal Conversion reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateConversionExistingActivityPerformanceData(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingfilters,
            page,
            limit,
            type
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
          console.error("Error generating deal Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal Conversion data",
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


async function generateConversionExistingActivityPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  filters,
  page = 1,
  limit = 6,
  type
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
  if (existingxaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Handle existingyaxis
  if (existingyaxis === "no of deals") {
     attributes.push([
    Sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
    "yValue",
  ]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
    Sequelize.literal(`SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`),
    "yValue",
  ]);
  } else if (existingyaxis === "value") {
    attributes.push([
    Sequelize.literal(`SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`),
    "yValue",
  ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Lead.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Get total count for pagination
  const totalCountResult = await Lead.findAll({
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
  const results = await Lead.findAll({
    where: baseWhere,
    attributes: attributes,
    include: includeModels,
    group: groupBy,
    raw: true,
    order: [[Sequelize.literal("yValue"), "DESC"]],
    limit: limit,
    offset: offset,
  });
// console.log(results)
  // Format the results for the frontend
const formattedResults = results.map((item) => ({
  label: item.xValue || "Unknown",
  value: (existingyaxis === "no of leads" || existingyaxis === "proposalValue" || existingyaxis === "value") 
    ? parseFloat(item.yValue || 0) 
    : item.yValue || 0,
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
async function generateConversionActivityPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
  filters,
  page = 1,
  limit = 6,
  type
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

  if (xaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the lead table
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

  // Handle existingyaxis
  if (yaxis === "no of leads") {
    attributes.push([
    Sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
    "yValue",
  ]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
    Sequelize.literal(`SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`),
    "yValue",
  ]);
  } else if (yaxis === "value") {
    attributes.push([
    Sequelize.literal(`SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`),
    "yValue",
  ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
   attributes.push([
    Sequelize.literal(`SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END)`),
    "yValue",
  ]);
  }

  // Get total count for pagination
  const totalCountResult = await Lead.findAll({
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
  const results = await Lead.findAll({
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
  value: (yaxis === "no of leads" || yaxis === "proposalValue" || yaxis === "value") 
    ? parseFloat(item.yValue || 0) 
    : item.yValue || 0,
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


exports.saveDealConversionReport = async (req, res) => {
  try {
    const {
      dashboardIds,
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
        message: "Entity, type, xaxis, and yaxis are required",
      });
    }

    // Ensure dashboardIds is an array
    const dashboardIdsArray = Array.isArray(dashboardIds) ? dashboardIds : [dashboardIds];

    // Verify dashboard ownership if dashboardId is provided
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
      // Update existing report
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
      // Create new report
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

exports.getDealConversionReportSummary = async (req, res) => {
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
        { title: { [Op.like]: `%${search}%` } },
        { value: { [Op.like]: `%${search}%` } },
        { ownerName: { [Op.like]: `%${search}%` } },
        { sourceOrigin: { [Op.like]: `%${search}%` } },
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
    if (sortBy === "Owner") {
      order.push([
        { model: MasterUser, as: "Owner" },
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
        as: "Owner",
        attributes: ["masterUserID", "name", "email"],
        required: false,
      },
    ];

    // Get total count
    const totalCount = await Lead.count({
      where: baseWhere,
      include: include,
    });

    // Get paginated results
    const leads = await Lead.findAll({
      where: baseWhere,
      include: include,
      order: order,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "leadId",
        "title",
        "value",
        "ownerName",
        "status",
        "createdAt",
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

    // Format activities for response
    const formattedActivities = leads.map((lead) => ({
      id: lead.leadId,
      title: lead.title,
      value: lead.value,
      ownerName: lead.ownerName,
      status: lead.status,
      createdAt: lead.createdAt,
      assignedTo: lead.Owner
        ? {
            id: lead.Owner.masterUserID,
            name: lead.Owner.name,
            email: lead.Owner.email,
          }
        : null,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Leads data retrieved successfully",
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
    console.error("Error retrieving leads data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve leads data",
      error: error.message,
    });
  }
};