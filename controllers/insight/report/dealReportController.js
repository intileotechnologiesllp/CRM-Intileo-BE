const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Deal = require("../../../models/deals/dealsModels");
const Lead = require("../../../models/leads/leadsModel");
// const Deal = require("../../../models/deals/dealsModels");
const Organization = require("../../../models/leads/leadOrganizationModel");
const Person = require("../../../models/leads/leadPersonModel");
const MasterUser = require("../../../models/master/masterUserModel");
const ReportFolder = require("../../../models/insight/reportFolderModel");
const { Op, Sequelize } = require("sequelize");
const { Pipeline } = require("../../../models");
const { pipeline } = require("nodemailer/lib/xoauth2");

exports.createDealPerformReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      segmentedBy = "none",
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
      "creatorstatus",
    ];

    const yaxisArray = [
      "no of deals",
      "proposalValue",
      "value",
      "weightedValue",
      "productQuantity",
      "productAmount",
    ];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Deal: [
        { label: "ESPL Proposal No", value: "esplProposalNo", type: "number" },
        { label: "No of Reports", value: "numberOfReportsPrepared", type: "number" },
        { label: "Organization Country", value: "organizationCountry", type: "text" },
        { label: "Project Location", value: "projectLocation", type: "text" },
        { label: "Proposal Sent Date", value: "proposalSentDate", type: "date" },
        { label: "Owner Name", value: "ownerName", type: "text" },
        { label: "SBU Class", value: "SBUClass", type: "text" },
        { label: "Status", value: "status", type: "text" },
        { label: "Scope Of Service Type", value: "scopeOfServiceType", type: "text" },
        { label: "Service Type", value: "serviceType", type: "text" },
        { label: "Source Channel", value: "sourceChannel", type: "text" },
        { label: "Source Channel ID", value: "sourceChannelID", type: "number" },
        { label: "Source Origin", value: "sourceOrigin", type: "text" },
        { label: "Source Origin Id", value: "sourceOriginID", type: "number" },
        { label: "Contact Person", value: "contactPerson", type: "text" },
        { label: "Organization", value: "organization", type: "text" },
        { label: "Title", value: "title", type: "text" },
        { label: "Proposal Value", value: "proposalValue", type: "number" },
        { label: "Sectoral Sector", value: "sectoralSector", type: "text" },
        { label: "Lead Quality", value: "leadQuality", type: "text" },
        { label: "Value", value: "value", type: "number" },
        { label: "Proposal Value Currency", value: "proposalValueCurrency", type: "text" },
        { label: "Value Currency", value: "valueCurrency", type: "text" },
        { label: "Value Labels", value: "valueLabels", type: "text" },
        { label: "Expected Close Date", value: "expectedCloseDate", type: "date" },
      ],
      Lead: [
        { label: "Contact Person", value: "Lead.contactPerson", type: "text" },
        { label: "Organization", value: "Lead.organization", type: "text" },
        { label: "Title", value: "Lead.title" , type: "text"},
        { label: "Value Labels", value: "Lead.valueLabels", type: "text" },
        { label: "Expected Close Date", value: "Lead.expectedCloseDate", type: "date" },
        { label: "Source Channel", value: "Lead.sourceChannel", type: "text" },
        { label: "Source Channel ID", value: "Lead.sourceChannelID", type: "number" },
        { label: "Service Type", value: "Lead.serviceType", type: "text" },
        { label: "Scope Of Service Type", value: "Lead.scopeOfServiceType", type: "text" },
        { label: "Phone", value: "Lead.phone", type: "number" },
        { label: "Email", value: "Lead.email", type: "text" },
        { label: "Company", value: "Lead.company", type: "text" },
        { label: "Proposal Value", value: "Lead.proposalValue", type: "number" },
        { label: "ESPL Proposal No", value: "Lead.esplProposalNo", type: "number" },
        { label: "Project Location", value: "Lead.projectLocation", type: "text" },
        { label: "Organization Country", value: "Lead.organizationCountry", type: "text" },
        { label: "Proposal Sent Date", value: "Lead.proposalSentDate", type: "date" },
        { label: "Status", value: "Lead.status", type: "text" },
        { label: "SBU Class", value: "Lead.SBUClass", type: "text" },
        { label: "Sectoral Sector", value: "Lead.sectoralSector", type: "text" },
        { label: "Source Origin", value: "Lead.sourceOrigin", type: "text" },
        { label: "Lead Quality", value: "Lead.leadQuality", type: "text" },
        { label: "Value", value: "Lead.value", type: "number" },
        { label: "Proposal Value Currency", value: "Lead.proposalValueCurrency", type: "text"},
        { label: "Value Currency", value: "Lead.valueCurrency", type: "text" },
      ],
      Organization: [
        { label: "Organization", value: "Organization.organization", type: "text" },
        { label: "Organization Labels", value: "Organization.organizationLabels", type: "text"},
        { label: "Address", value: "Organization.address", type: "text" },
      ],
      Person: [
        { label: "Contact Person", value: "Person.contactPerson", type: "text" },
        { label: "Postal Address", value: "Person.postalAddress", type: "text" },
        { label: "Email", value: "Person.email", type: "text" },
        { label: "Phone", value: "Person.phone", type: "number" },
        { label: "Job Title", value: "Person.jobTitle", type: "text" },
        { label: "Person Labels", value: "Person.personLabels", type: "text" },
        { label: "Organization", value: "Person.organization", type: "text" },
      ],
    };

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if ((entity && type && !reportId) || (entity && type && reportId)) {
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
            segmentedBy,
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
            segmentedBy,
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

      const colors = JSON.parse(existingcolors);
      // Parse the config JSON string
      const config = JSON.parse(configString);
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        segmentedBy: existingSegmentedBy,
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
            existingSegmentedBy,
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
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors
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

async function generateExistingActivityPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingSegmentedBy,
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

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    if (existingSegmentedBy === "Owner" || existingSegmentedBy === "assignedTo") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Activity.${existingSegmentedBy}`);
      attributes.push([Sequelize.col(`Activity.${existingSegmentedBy}`), "segmentValue"]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of deals") {
    attributes.push([Sequelize.fn("COUNT", Sequelize.col("dealId")), "yValue"]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("proposalValue")),
      "yValue",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([Sequelize.fn("SUM", Sequelize.col("value")), "yValue"]);
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
  let formattedResults = []

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};
    
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = item.yValue || 0;
      
      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: []
        };
      }
      
      // Check if this segment already exists
      const existingSegment = groupedData[xValue].segments.find(
        seg => seg.labeltype === segmentValue
      );
      
      if (existingSegment) {
        existingSegment.value += yValue;
      } else {
        groupedData[xValue].segments.push({
          labeltype: segmentValue,
          value: yValue
        });
      }
    });
    
    // Convert to array
    formattedResults = Object.values(groupedData);
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: item.yValue || 0,
    }));
  }

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
  segmentedBy,
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

  // Handle segmentedBy if not "none"
  if (segmentedBy && segmentedBy !== "none") {
    if (segmentedBy === "Owner" || segmentedBy === "assignedTo") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Activity.${segmentedBy}`);
      attributes.push([Sequelize.col(`Activity.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle existingyaxis
  if (yaxis === "no of deals") {
    attributes.push([Sequelize.fn("COUNT", Sequelize.col("dealId")), "yValue"]);
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

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  
  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};
    
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = item.yValue || 0;
      
      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: []
        };
      }
      
      // Check if this segment already exists
      const existingSegment = groupedData[xValue].segments.find(
        seg => seg.labeltype === segmentValue
      );
      
      if (existingSegment) {
        existingSegment.value += yValue;
      } else {
        groupedData[xValue].segments.push({
          labeltype: segmentValue,
          value: yValue
        });
      }
    });
    
    // Convert to array
    formattedResults = Object.values(groupedData);
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: item.yValue || 0,
    }));
  }

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
      reportId,
      dashboardIds, // array
      folderId,
      name,
      entity,
      type,
      description,
      xaxis,
      yaxis,
      segmentedBy,
      filters,
      graphtype,
      colors,
    } = req.body;

    const ownerId = req.adminId;

    // Validate required fields (for create only)
    if (!reportId && (!entity || !type || !xaxis || !yaxis || !dashboardIds || !folderId)) {
      return res.status(400).json({
        success: false,
        message:
          "Entity, type, xaxis, yaxis, dashboardIds, and folderId are required for creating a new report",
      });
    }

    let reports = [];
    let reportData = null;

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
        ...(xaxis !== undefined || yaxis !== undefined || filters !== undefined || segmentedBy !== undefined
          ? {
              config: {
                xaxis: xaxis ?? existingReport.config?.xaxis,
                yaxis: yaxis ?? existingReport.config?.yaxis,
                segmentedBy: segmentedBy?? existingReport.config?.segmentedBy,
                filters: filters ?? existingReport.config?.filters,
              },
            }
          : {}),
        ...(graphtype !== undefined && { graphtype }),
        ...(colors !== undefined && { colors }),
      };

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
    const dashboardIdsArray = Array.isArray(dashboardIds) ? dashboardIds : [dashboardIds];

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

      // Find next position
      const lastReport = await Report.findOne({
        where: { dashboardId },
        order: [["position", "DESC"]],
      });
      const nextPosition = lastReport ? (lastReport.position || 0) : 0;

      const configObj = {
        xaxis,
        yaxis,
        segmentedBy,
        filters: filters || {},
      };

      const reportName = description || `${entity} ${type}`;

      const newReport = await Report.create({
        dashboardId,
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
    }

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

exports.getDealPerformReportSummary = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      segmentedBy = "none",
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
        // { ownerName: { [Op.like]: `%${search}%` } },
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
      order.push([{ model: MasterUser, as: "Owner" }, "name", sortOrder]);
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
        "status",
        "createdAt",
        "contactPerson",
        "organization",
        "expectedCloseDate",
        "sourceChannel",
        "sourceChannelId",
        "serviceType",
        "phone",
        "email",
        "proposalValue",
        "esplProposalNo",
        "projectLocation",
        "organizationCountry",
        "proposalSentDate",
        "SbuClass",
        "sectorialSector",
        "sourceOrgin",
        "currency",
        "pipeline",
        "pipelineStage",
        "label",
        "sourceRequired",
        "questionerShared",
        "nextActivityDate",
        "lastActivityDate",
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
        segmentedBy,
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateActivityPerformanceData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        existingSegmentedBy,
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
      status: lead.status,
      createdAt: lead.createdAt,
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelId: lead.sourceChannelId,
      serviceType: lead.serviceType,
      phone: lead.phone,
      email: lead.email,
      proposalValue: lead.proposalValue,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      SBUClass: lead.SBUClass,
      numberOfReportsPrepared: lead.numberOfReportsPrepared,
      sectorialSector: lead.sectorialSector,
      sourceOrigin: lead.sourceOrgin,
      currency: lead.currency,
      pipeline: lead.pipeline,
      pipelineStage: lead.pipelineStage,
      label: lead.label,
      sourceRequired: lead.sourceRequired,
      questionerShared: lead.questionerShared,
      questionerShared: lead.questionerShared,
      nextActivityDate: lead.nextActivityDate,
      lastActivityDate: lead.lastActivityDate,
      Owner: {
            id: lead.Owner.masterUserID,
            name: lead.Owner.name,
            email: lead.Owner.email,
          }
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Deals data retrieved successfully",
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
      segmentedBy = "none",
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
      "creatorstatus",
    ];

    const yaxisArray = [
      "no of deals",
      "proposalValue",
      "value",
      "weightedValue",
      "productQuantity",
      "productAmount",
    ];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Deal: [
        { label: "ESPL Proposal No", value: "esplProposalNo", type: "number" },
        { label: "No of Reports", value: "numberOfReportsPrepared", type: "number" },
        { label: "Organization Country", value: "organizationCountry", type: "text" },
        { label: "Project Location", value: "projectLocation", type: "text" },
        { label: "Proposal Sent Date", value: "proposalSentDate", type: "date" },
        { label: "Owner Name", value: "ownerName", type: "text" },
        { label: "SBU Class", value: "SBUClass", type: "text" },
        { label: "Status", value: "status", type: "text" },
        { label: "Scope Of Service Type", value: "scopeOfServiceType", type: "text" },
        { label: "Service Type", value: "serviceType", type: "text" },
        { label: "Source Channel", value: "sourceChannel", type: "text" },
        { label: "Source Channel ID", value: "sourceChannelID", type: "number" },
        { label: "Source Origin", value: "sourceOrigin", type: "text" },
        { label: "Source Origin Id", value: "sourceOriginID", type: "number" },
        { label: "Contact Person", value: "contactPerson", type: "text" },
        { label: "Organization", value: "organization", type: "text" },
        { label: "Title", value: "title", type: "text" },
        { label: "Proposal Value", value: "proposalValue", type: "number" },
        { label: "Sectoral Sector", value: "sectoralSector", type: "text" },
        { label: "Lead Quality", value: "leadQuality", type: "text" },
        { label: "Value", value: "value", type: "number" },
        { label: "Proposal Value Currency", value: "proposalValueCurrency", type: "text" },
        { label: "Value Currency", value: "valueCurrency", type: "text" },
        { label: "Value Labels", value: "valueLabels", type: "text" },
        { label: "Expected Close Date", value: "expectedCloseDate", type: "date" },
      ],
      Lead: [
        { label: "Contact Person", value: "Lead.contactPerson", type: "text" },
        { label: "Organization", value: "Lead.organization", type: "text" },
        { label: "Title", value: "Lead.title" , type: "text"},
        { label: "Value Labels", value: "Lead.valueLabels", type: "text" },
        { label: "Expected Close Date", value: "Lead.expectedCloseDate", type: "date" },
        { label: "Source Channel", value: "Lead.sourceChannel", type: "text" },
        { label: "Source Channel ID", value: "Lead.sourceChannelID", type: "number" },
        { label: "Service Type", value: "Lead.serviceType", type: "text" },
        { label: "Scope Of Service Type", value: "Lead.scopeOfServiceType", type: "text" },
        { label: "Phone", value: "Lead.phone", type: "number" },
        { label: "Email", value: "Lead.email", type: "text" },
        { label: "Company", value: "Lead.company", type: "text" },
        { label: "Proposal Value", value: "Lead.proposalValue", type: "number" },
        { label: "ESPL Proposal No", value: "Lead.esplProposalNo", type: "number" },
        { label: "Project Location", value: "Lead.projectLocation", type: "text" },
        { label: "Organization Country", value: "Lead.organizationCountry", type: "text" },
        { label: "Proposal Sent Date", value: "Lead.proposalSentDate", type: "date" },
        { label: "Status", value: "Lead.status", type: "text" },
        { label: "SBU Class", value: "Lead.SBUClass", type: "text" },
        { label: "Sectoral Sector", value: "Lead.sectoralSector", type: "text" },
        { label: "Source Origin", value: "Lead.sourceOrigin", type: "text" },
        { label: "Lead Quality", value: "Lead.leadQuality", type: "text" },
        { label: "Value", value: "Lead.value", type: "number" },
        { label: "Proposal Value Currency", value: "Lead.proposalValueCurrency", type: "text"},
        { label: "Value Currency", value: "Lead.valueCurrency", type: "text" },
      ],
      Organization: [
        { label: "Organization", value: "Organization.organization", type: "text" },
        { label: "Organization Labels", value: "Organization.organizationLabels", type: "text"},
        { label: "Address", value: "Organization.address", type: "text" },
      ],
      Person: [
        { label: "Contact Person", value: "Person.contactPerson", type: "text" },
        { label: "Postal Address", value: "Person.postalAddress", type: "text" },
        { label: "Email", value: "Person.email", type: "text" },
        { label: "Phone", value: "Person.phone", type: "number" },
        { label: "Job Title", value: "Person.jobTitle", type: "text" },
        { label: "Person Labels", value: "Person.personLabels", type: "text" },
        { label: "Organization", value: "Person.organization", type: "text" },
      ],
    };

    // For Activity Conversion reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if ((entity && type && !reportId) || (entity && type && reportId)) {
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
            segmentedBy,
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
            segmentedBy,
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

      const colors = JSON.parse(existingcolors);
      // Parse the config JSON string
      const config = JSON.parse(configString);
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        segmentedBy: existingSegmentedBy,
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
          const result =
            await generateConversionExistingActivityPerformanceData(
              ownerId,
              role,
              existingxaxis,
              existingyaxis,
              existingSegmentedBy,
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
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors
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
        segmentedBy: xaxisArray, 
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

async function generateConversionExistingActivityPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingSegmentedBy,
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

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    if (existingSegmentedBy === "Owner" || existingSegmentedBy === "assignedTo") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Activity.${existingSegmentedBy}`);
      attributes.push([Sequelize.col(`Activity.${existingSegmentedBy}`), "segmentValue"]);
    }
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
      Sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
      ),
      "yValue",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([
      Sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
      ),
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
  // console.log(results)
  // Format the results for the frontend
  // Format the results for the frontend
  let formattedResults = []

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};
    
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = item.yValue || 0;
      
      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: []
        };
      }
      
      // Check if this segment already exists
      const existingSegment = groupedData[xValue].segments.find(
        seg => seg.labeltype === segmentValue
      );
      
      if (existingSegment) {
        existingSegment.value += yValue;
      } else {
        groupedData[xValue].segments.push({
          labeltype: segmentValue,
          value: yValue
        });
      }
    });
    
    // Convert to array
    formattedResults = Object.values(groupedData);
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
       value:
      existingyaxis === "no of leads" ||
      existingyaxis === "proposalValue" ||
      existingyaxis === "value"
        ? parseFloat(item.yValue || 0)
        : item.yValue || 0,
    }));
  }

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
  segmentedBy,
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
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (segmentedBy && segmentedBy !== "none") {
    if (segmentedBy === "Owner" || segmentedBy === "assignedTo") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Activity.${segmentedBy}`);
      attributes.push([Sequelize.col(`Activity.${segmentedBy}`), "segmentValue"]);
    }
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
      Sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
      ),
      "yValue",
    ]);
  } else if (yaxis === "value") {
    attributes.push([
      Sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
      ),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END)`
      ),
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

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  
  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};
    
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = item.yValue || 0;
      
      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: []
        };
      }
      
      // Check if this segment already exists
      const existingSegment = groupedData[xValue].segments.find(
        seg => seg.labeltype === segmentValue
      );
      
      if (existingSegment) {
        existingSegment.value += yValue;
      } else {
        groupedData[xValue].segments.push({
          labeltype: segmentValue,
          value: yValue
        });
      }
    });
    
    // Convert to array
    formattedResults = Object.values(groupedData);
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
       value:
      yaxis === "no of leads" || yaxis === "proposalValue" || yaxis === "value"
        ? parseFloat(item.yValue || 0)
        : item.yValue || 0,
    }));
  }


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
      reportId,
      dashboardIds, // array
      folderId,
      name,
      entity,
      type,
      description,
      xaxis,
      yaxis,
      segmentedBy,
      filters,
      graphtype,
      colors,
    } = req.body;

    const ownerId = req.adminId;

    // Validate required fields (for create only)
    if (!reportId && (!entity || !type || !xaxis || !yaxis || !dashboardIds || !folderId)) {
      return res.status(400).json({
        success: false,
        message:
          "Entity, type, xaxis, yaxis, dashboardIds, and folderId are required for creating a new report",
      });
    }

    let reports = [];
    let reportData = null;

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
        ...(xaxis !== undefined || yaxis !== undefined || filters !== undefined || segmentedBy !== undefined
          ? {
              config: {
                xaxis: xaxis ?? existingReport.config?.xaxis,
                yaxis: yaxis ?? existingReport.config?.yaxis,
                segmentedBy: segmentedBy?? existingReport.config?.segmentedBy,
                filters: filters ?? existingReport.config?.filters,
              },
            }
          : {}),
        ...(graphtype !== undefined && { graphtype }),
        ...(colors !== undefined && { colors }),
      };

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
    const dashboardIdsArray = Array.isArray(dashboardIds) ? dashboardIds : [dashboardIds];

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

      // Find next position
      const lastReport = await Report.findOne({
        where: { dashboardId },
        order: [["position", "DESC"]],
      });
      const nextPosition = lastReport ? (lastReport.position || 0) : 0;

      const configObj = {
        xaxis,
        yaxis,
        segmentedBy,
        filters: filters || {},
      };

      const reportName = description || `${entity} ${type}`;

      const newReport = await Report.create({
        dashboardId,
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
    }

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

exports.getDealConversionReportSummary = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      segmentedBy = "none",
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
      order.push([{ model: MasterUser, as: "Owner" }, "name", sortOrder]);
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
        "dealId",
        "title",
        "value",
        "status",
        "createdAt",
        "contactPerson",
        "organization",
        "expectedCloseDate",
        "sourceChannel",
        "sourceChannelId",
        "serviceType",
        "phone",
        "email",
        "proposalValue",
        "esplProposalNo",
        "projectLocation",
        "organizationCountry",
        "proposalSentDate",
        "SbuClass",
        "sectorialSector",
        "sourceOrgin",
        "currency",
        "pipeline",
        "pipelineStage",
        "label",
        "sourceRequired",
        "questionerShared",
        "nextActivityDate",
        "lastActivityDate",
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
        segmentedBy,
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateActivityPerformanceData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        existingSegmentedBy,
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
      status: lead.status,
      createdAt: lead.createdAt,
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelId: lead.sourceChannelId,
      serviceType: lead.serviceType,
      phone: lead.phone,
      email: lead.email,
      proposalValue: lead.proposalValue,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      SBUClass: lead.SBUClass,
      numberOfReportsPrepared: lead.numberOfReportsPrepared,
      sectorialSector: lead.sectorialSector,
      sourceOrigin: lead.sourceOrgin,
      currency: lead.currency,
      pipeline: lead.pipeline,
      pipelineStage: lead.pipelineStage,
      label: lead.label,
      sourceRequired: lead.sourceRequired,
      questionerShared: lead.questionerShared,
      questionerShared: lead.questionerShared,
      nextActivityDate: lead.nextActivityDate,
      lastActivityDate: lead.lastActivityDate,
      Owner: {
            id: lead.Owner.masterUserID,
            name: lead.Owner.name,
            email: lead.Owner.email,
          }
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

exports.createDealProgressReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      segmentedBy = "none",
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
      "sbuClass",
      "status",
      "scopeOfServiceType",
      "serviceType",
      "sourceChannel",
      "sourceChannelID",
      "sourceOrigin",
      "contactPerson",
      "organization",
      "conversionDate",
      "createdAt",
      "updatedAt",
      "creator",
      "creatorstatus",
    ];

    const yaxisArray = [
      "no of deals",
      "proposalValue",
      "value",
      "weightedValue",
      "productQuantity",
      "productAmount",
    ];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Deal: [
        { label: "ESPL Proposal No", value: "esplProposalNo", type: "number" },
        { label: "No of Reports", value: "numberOfReportsPrepared", type: "number" },
        { label: "Organization Country", value: "organizationCountry", type: "text" },
        { label: "Project Location", value: "projectLocation", type: "text" },
        { label: "Proposal Sent Date", value: "proposalSentDate", type: "date" },
        { label: "Owner Name", value: "ownerName", type: "text" },
        { label: "SBU Class", value: "SBUClass", type: "text" },
        { label: "Status", value: "status", type: "text" },
        { label: "Scope Of Service Type", value: "scopeOfServiceType", type: "text" },
        { label: "Service Type", value: "serviceType", type: "text" },
        { label: "Source Channel", value: "sourceChannel", type: "text" },
        { label: "Source Channel ID", value: "sourceChannelID", type: "number" },
        { label: "Source Origin", value: "sourceOrigin", type: "text" },
        { label: "Source Origin Id", value: "sourceOriginID", type: "number" },
        { label: "Contact Person", value: "contactPerson", type: "text" },
        { label: "Organization", value: "organization", type: "text" },
        { label: "Title", value: "title", type: "text" },
        { label: "Proposal Value", value: "proposalValue", type: "number" },
        { label: "Sectoral Sector", value: "sectoralSector", type: "text" },
        { label: "Lead Quality", value: "leadQuality", type: "text" },
        { label: "Value", value: "value", type: "number" },
        { label: "Proposal Value Currency", value: "proposalValueCurrency", type: "text" },
        { label: "Value Currency", value: "valueCurrency", type: "text" },
        { label: "Value Labels", value: "valueLabels", type: "text" },
        { label: "Expected Close Date", value: "expectedCloseDate", type: "date" },
      ],
      Lead: [
        { label: "Contact Person", value: "Lead.contactPerson", type: "text" },
        { label: "Organization", value: "Lead.organization", type: "text" },
        { label: "Title", value: "Lead.title" , type: "text"},
        { label: "Value Labels", value: "Lead.valueLabels", type: "text" },
        { label: "Expected Close Date", value: "Lead.expectedCloseDate", type: "date" },
        { label: "Source Channel", value: "Lead.sourceChannel", type: "text" },
        { label: "Source Channel ID", value: "Lead.sourceChannelID", type: "number" },
        { label: "Service Type", value: "Lead.serviceType", type: "text" },
        { label: "Scope Of Service Type", value: "Lead.scopeOfServiceType", type: "text" },
        { label: "Phone", value: "Lead.phone", type: "number" },
        { label: "Email", value: "Lead.email", type: "text" },
        { label: "Company", value: "Lead.company", type: "text" },
        { label: "Proposal Value", value: "Lead.proposalValue", type: "number" },
        { label: "ESPL Proposal No", value: "Lead.esplProposalNo", type: "number" },
        { label: "Project Location", value: "Lead.projectLocation", type: "text" },
        { label: "Organization Country", value: "Lead.organizationCountry", type: "text" },
        { label: "Proposal Sent Date", value: "Lead.proposalSentDate", type: "date" },
        { label: "Status", value: "Lead.status", type: "text" },
        { label: "SBU Class", value: "Lead.SBUClass", type: "text" },
        { label: "Sectoral Sector", value: "Lead.sectoralSector", type: "text" },
        { label: "Source Origin", value: "Lead.sourceOrigin", type: "text" },
        { label: "Lead Quality", value: "Lead.leadQuality", type: "text" },
        { label: "Value", value: "Lead.value", type: "number" },
        { label: "Proposal Value Currency", value: "Lead.proposalValueCurrency", type: "text"},
        { label: "Value Currency", value: "Lead.valueCurrency", type: "text" },
      ],
      Organization: [
        { label: "Organization", value: "Organization.organization", type: "text" },
        { label: "Organization Labels", value: "Organization.organizationLabels", type: "text"},
        { label: "Address", value: "Organization.address", type: "text" },
      ],
      Person: [
        { label: "Contact Person", value: "Person.contactPerson", type: "text" },
        { label: "Postal Address", value: "Person.postalAddress", type: "text" },
        { label: "Email", value: "Person.email", type: "text" },
        { label: "Phone", value: "Person.phone", type: "number" },
        { label: "Job Title", value: "Person.jobTitle", type: "text" },
        { label: "Person Labels", value: "Person.personLabels", type: "text" },
        { label: "Organization", value: "Person.organization", type: "text" },
      ],
    };

    // For Activity Conversion reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    let reportConfig = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
      if (entity === "Deal" && type === "Progress") {
        // Validate required fields for Conversion reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message: "X-axis and Y-axis are required for Deal Progress reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateProgressActivityPerformanceData(
            ownerId,
            role,
            xaxis,
            yaxis,
            segmentedBy,
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
            segmentedBy,
            filters: filters || {},
          };
        } catch (error) {
          console.error("Error generating deal Progress data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal Progress data",
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

      const colors = JSON.parse(existingcolors);
      // Parse the config JSON string
      const config = JSON.parse(configString);
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      if (existingentity === "Deal" && existingtype === "Progress") {
        // Validate required fields for performance reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message: "X-axis and Y-axis are required for Deal Progress reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateProgressExistingActivityPerformanceData(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingSegmentedBy,
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
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors
          };
        } catch (error) {
          console.error("Error generating deal Progress data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal Progress data",
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
        segmentedBy: xaxisArray, 
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

async function generateProgressExistingActivityPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingSegmentedBy,
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
    // For regular columns, explicitly specify the Deal table
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Add pipelineStage to group by to get the breakdown
  groupBy.push("Deal.pipelineStage");
  attributes.push([Sequelize.col("Deal.pipelineStage"), "pipelineStage"]);

  
  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    if (existingSegmentedBy === "Owner" || existingSegmentedBy === "assignedTo") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Activity.${existingSegmentedBy}`);
      attributes.push([Sequelize.col(`Activity.${existingSegmentedBy}`), "segmentValue"]);
    }
  }


  // Handle existingyaxis
  if (existingyaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "yValue",
    ]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")),
      "yValue",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.value")),
      "yValue",
    ]);
  } else if (existingyaxis === "weightedValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.weightedValue")),
      "yValue",
    ]);
  } else if (existingyaxis === "productQuantity") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.productQuantity")),
      "yValue",
    ]);
  } else if (existingyaxis === "productAmount") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.productAmount")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Deal table
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
          Sequelize.fn("DISTINCT", Sequelize.col(`Deal.${existingxaxis}`))
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
  let formattedResults = []

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};
    
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = item.yValue || 0;
      
      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: []
        };
      }
      
      // Check if this segment already exists
      const existingSegment = groupedData[xValue].segments.find(
        seg => seg.labeltype === segmentValue
      );
      
      if (existingSegment) {
        existingSegment.value += yValue;
      } else {
        groupedData[xValue].segments.push({
          labeltype: segmentValue,
          value: yValue
        });
      }
    });
    
    // Convert to array
    formattedResults = Object.values(groupedData);
  } else {
    formattedResults = formatResultsWithPipelineBreakdown(
    results,
    existingxaxis,
    existingyaxis
  );
  }


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

// Helper function to format results with pipeline stage breakdown
function formatResultsWithPipelineBreakdown(results, xaxis, yaxis) {
  const groupedByXValue = {};

  // First pass: collect all pipeline stage values for each xValue
  results.forEach((item) => {
    const xValue = item.xValue || "Unknown";
    const pipelineStage = item.pipelineStage || "Unknown";
    const yValue = parseFloat(item.yValue || 0);

    if (!groupedByXValue[xValue]) {
      groupedByXValue[xValue] = {
        label: xValue,
        value: 0, // Initialize to 0
        breakdown: {},
      };
    }

    // Add to the pipeline stage breakdown
    groupedByXValue[xValue].breakdown[pipelineStage] = yValue;
  });

  // Second pass: calculate the total value for each xValue
  Object.keys(groupedByXValue).forEach((xValue) => {
    const breakdown = groupedByXValue[xValue].breakdown;

    // Sum all pipeline stage values to get the total
    groupedByXValue[xValue].value = Object.values(breakdown).reduce(
      (sum, stageValue) => sum + stageValue,
      0
    );
  });

  // Convert to array
  return Object.values(groupedByXValue);
}

// Helper function to generate activity performance data with pagination
async function generateProgressActivityPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
  segmentedBy,
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
    // For regular columns, explicitly specify the Deal table
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
  }

  // Add pipelineStage to group by to get the breakdown
  groupBy.push("Deal.pipelineStage");
  attributes.push([Sequelize.col("Deal.pipelineStage"), "pipelineStage"]);

  // Handle segmentedBy if not "none"
  if (segmentedBy && segmentedBy !== "none") {
    if (segmentedBy === "Owner" || segmentedBy === "assignedTo") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team") {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Activity.${segmentedBy}`);
      attributes.push([Sequelize.col(`Activity.${segmentedBy}`), "segmentValue"]);
    }
  }


  // Handle yaxis
  if (yaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "yValue",
    ]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")),
      "yValue",
    ]);
  } else if (yaxis === "value") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.value")),
      "yValue",
    ]);
  } else if (yaxis === "weightedValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.weightedValue")),
      "yValue",
    ]);
  } else if (yaxis === "productQuantity") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.productQuantity")),
      "yValue",
    ]);
  } else if (yaxis === "productAmount") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.productAmount")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Deal table
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
          Sequelize.fn("DISTINCT", Sequelize.col(`Deal.${xaxis}`))
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

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  
  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};
    
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = item.yValue || 0;
      
      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: []
        };
      }
      
      // Check if this segment already exists
      const existingSegment = groupedData[xValue].segments.find(
        seg => seg.labeltype === segmentValue
      );
      
      if (existingSegment) {
        existingSegment.value += yValue;
      } else {
        groupedData[xValue].segments.push({
          labeltype: segmentValue,
          value: yValue
        });
      }
    });
    
    // Convert to array
    formattedResults = Object.values(groupedData);
  } else {
    // Original format for non-segmented data
    formattedResults = formatResultsWithPipelineBreakdown(
    results,
    xaxis,
    yaxis
  );
  }

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

exports.saveDealProgressReport = async (req, res) => {
  try {
    const {
      reportId,
      dashboardIds, // array
      folderId,
      name,
      entity,
      type,
      description,
      xaxis,
      yaxis,
      segmentedBy,
      filters,
      graphtype,
      colors,
    } = req.body;

    const ownerId = req.adminId;

    // Validate required fields (for create only)
    if (!reportId && (!entity || !type || !xaxis || !yaxis || !dashboardIds || !folderId)) {
      return res.status(400).json({
        success: false,
        message:
          "Entity, type, xaxis, yaxis, dashboardIds, and folderId are required for creating a new report",
      });
    }

    let reports = [];
    let reportData = null;

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
        ...(xaxis !== undefined || yaxis !== undefined || filters !== undefined || segmentedBy !== undefined
          ? {
              config: {
                xaxis: xaxis ?? existingReport.config?.xaxis,
                yaxis: yaxis ?? existingReport.config?.yaxis,
                segmentedBy: segmentedBy?? existingReport.config?.segmentedBy,
                filters: filters ?? existingReport.config?.filters,
              },
            }
          : {}),
        ...(graphtype !== undefined && { graphtype }),
        ...(colors !== undefined && { colors }),
      };

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
    const dashboardIdsArray = Array.isArray(dashboardIds) ? dashboardIds : [dashboardIds];

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

      // Find next position
      const lastReport = await Report.findOne({
        where: { dashboardId },
        order: [["position", "DESC"]],
      });
      const nextPosition = lastReport ? (lastReport.position || 0) : 0;

      const configObj = {
        xaxis,
        yaxis,
        segmentedBy,
        filters: filters || {},
      };

      const reportName = description || `${entity} ${type}`;

      const newReport = await Report.create({
        dashboardId,
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
    }

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

exports.getDealProgressReportSummary = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      segmentedBy = "none",
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
        { pipeline: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
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
      order.push([{ model: MasterUser, as: "Owner" }, "name", sortOrder]);
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
    const deals = await Deal.findAll({
      where: baseWhere,
      include: include,
      order: order,
      limit: parseInt(limit),
      offset: offset,
       attributes: [
        "dealId",
        "title",
        "value",
        "status",
        "createdAt",
        "contactPerson",
        "organization",
        "expectedCloseDate",
        "sourceChannel",
        "sourceChannelId",
        "serviceType",
        "phone",
        "email",
        "proposalValue",
        "esplProposalNo",
        "projectLocation",
        "organizationCountry",
        "proposalSentDate",
        "SbuClass",
        "sectorialSector",
        "sourceOrgin",
        "currency",
        "pipeline",
        "pipelineStage",
        "label",
        "sourceRequired",
        "questionerShared",
        "nextActivityDate",
        "lastActivityDate",
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
        segmentedBy,
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateActivityPerformanceData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        existingSegmentedBy,
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
    const formattedActivities = deals.map((lead) => ({
      id: lead.dealId,
      title: lead.title,
      value: lead.value,
      status: lead.status,
      createdAt: lead.createdAt,
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelId: lead.sourceChannelId,
      serviceType: lead.serviceType,
      phone: lead.phone,
      email: lead.email,
      proposalValue: lead.proposalValue,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      SBUClass: lead.SBUClass,
      numberOfReportsPrepared: lead.numberOfReportsPrepared,
      sectorialSector: lead.sectorialSector,
      sourceOrigin: lead.sourceOrgin,
      currency: lead.currency,
      pipeline: lead.pipeline,
      pipelineStage: lead.pipelineStage,
      label: lead.label,
      sourceRequired: lead.sourceRequired,
      questionerShared: lead.questionerShared,
      questionerShared: lead.questionerShared,
      nextActivityDate: lead.nextActivityDate,
      lastActivityDate: lead.lastActivityDate,
      Owner: {
            id: lead.Owner.masterUserID,
            name: lead.Owner.name,
            email: lead.Owner.email,
          }
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Deals data retrieved successfully",
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
