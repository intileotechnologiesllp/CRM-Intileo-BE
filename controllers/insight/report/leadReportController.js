const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Deal = require("../../../models/deals/dealsModels");
const Lead = require("../../../models/leads/leadsModel");
const Organization = require("../../../models/leads/leadOrganizationModel");
const Person = require("../../../models/leads/leadPersonModel");
const MasterUser = require("../../../models/master/masterUserModel");
const ReportFolder = require("../../../models/insight/reportFolderModel");
const { Op, Sequelize } = require("sequelize");

exports.createLeadPerformReport = async (req, res) => {
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
      limit = 8,
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
      "creator",
      "creatorstatus",
    ];
    
     const segmentedByOptions = [
      "none",
      "esplProposalNo",
      "numberOfReportsPrepared",
      "organizationCountry",
      "projectLocation",
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
      "creator",
      "creatorstatus",
    ];

    const yaxisArray = ["no of leads", "proposalValue", "value"];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Lead: [
        { label: "ESPL Proposal No", value: "esplProposalNo", type: "number" },
        {
          label: "No of Reports",
          value: "numberOfReportsPrepared",
          type: "number",
        },
        {
          label: "Organization Country",
          value: "organizationCountry",
          type: "text",
        },
        { label: "Project Location", value: "projectLocation", type: "text" },
        {
          label: "Proposal Sent Date",
          value: "proposalSentDate",
          type: "date",
        },
        { label: "Owner Name", value: "ownerName", type: "text" },
        { label: "SBU Class", value: "SBUClass", type: "text" },
        { label: "Status", value: "status", type: "text" },
        {
          label: "Scope Of Service Type",
          value: "scopeOfServiceType",
          type: "text",
        },
        { label: "Service Type", value: "serviceType", type: "text" },
        { label: "Source Channel", value: "sourceChannel", type: "text" },
        {
          label: "Source Channel ID",
          value: "sourceChannelID",
          type: "number",
        },
        { label: "Source Origin", value: "sourceOrigin", type: "text" },
        { label: "Source Origin Id", value: "sourceOriginID", type: "number" },
        { label: "Contact Person", value: "contactPerson", type: "text" },
        { label: "Organization", value: "organization", type: "text" },
        { label: "Title", value: "title", type: "text" },
        { label: "Proposal Value", value: "proposalValue", type: "number" },
        { label: "Sectoral Sector", value: "sectoralSector", type: "text" },
        { label: "Lead Quality", value: "leadQuality", type: "text" },
        { label: "Value", value: "value", type: "number" },
        {
          label: "Proposal Value Currency",
          value: "proposalValueCurrency",
          type: "text",
        },
        { label: "Value Currency", value: "valueCurrency", type: "text" },
        { label: "Value Labels", value: "valueLabels", type: "text" },
        {
          label: "Expected Close Date",
          value: "expectedCloseDate",
          type: "date",
        },
        { label: "Created At", value: "createdAt", type: "date" },
        { label: "Updated At", value: "updatedAt", type: "date" },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
      // Deal: [
      //   { label: "Title", value: "LeadDeals.title", type: "text" },
      //   { label: "Value", value: "LeadDeals.value", type: "text" },
      //   { label: "Currency", value: "LeadDeals.currency", type: "text" },
      //   { label: "Pipeline", value: "LeadDeals.pipeline", type: "text" },
      //   {
      //     label: "Pipeline Stage",
      //     value: "LeadDeals.pipelineStage",
      //     type: "text",
      //   },
      //   { label: "Label", value: "LeadDeals.label", type: "text" },
      //   {
      //     label: "Expected Close Date",
      //     value: "LeadDeals.expectedCloseDate",
      //     type: "date",
      //   },
      //   {
      //     label: "Source Channel",
      //     value: "LeadDeals.sourceChannel",
      //     type: "text",
      //   },
      //   {
      //     label: "Service Type",
      //     value: "LeadDeals.serviceType",
      //     type: "text",
      //   },
      //   {
      //     label: "Proposal Value",
      //     value: "LeadDeals.proposalValue",
      //     type: "number",
      //   },
      //   {
      //     label: "Proposal Currency",
      //     value: "LeadDeals.proposalCurrency",
      //     type: "text",
      //   },
      //   {
      //     label: "ESPL Proposal No",
      //     value: "LeadDeals.esplProposalNo",
      //     type: "number",
      //   },
      //   {
      //     label: "Project Location",
      //     value: "LeadDeals.projectLocation",
      //     type: "text",
      //   },
      //   {
      //     label: "Organization Country",
      //     value: "LeadDeals.organizationCountry",
      //     type: "text",
      //   },
      //   {
      //     label: "Proposal Sent Date",
      //     value: "LeadDeals.proposalSentDate",
      //     type: "date",
      //   },
      //   {
      //     label: "Source Required",
      //     value: "LeadDeals.sourceRequired",
      //     type: "text",
      //   },
      //   {
      //     label: "Questioner Shared",
      //     value: "LeadDeals.questionerShared",
      //     type: "number",
      //   },
      //   {
      //     label: "Sectorial Sector",
      //     value: "LeadDeals.sectorialSector",
      //     type: "text",
      //   },
      //   { label: "SBU Class", value: "LeadDeals.sbuClass", type: "text" },
      //   { label: "Phone", value: "LeadDeals.phone", type: "number" },
      //   { label: "Email", value: "LeadDeals.email", type: "text" },
      //   {
      //     label: "Source Origin",
      //     value: "LeadDeals.sourceOrgin",
      //     type: "text",
      //   },
      //   { label: "Status", value: "LeadDeals.status", type: "number" },
      //   {
      //     label: "Product Name",
      //     value: "LeadDeals.productName",
      //     type: "text",
      //   },
      //   {
      //     label: "Weighted Value",
      //     value: "LeadDeals.weightedValue",
      //     type: "number",
      //   },
      //   {
      //     label: "Probability",
      //     value: "LeadDeals.probability",
      //     type: "text",
      //   },
      //   { label: "Stage", value: "LeadDeals.stage", type: "text" },
      //   {
      //     label: "Lost Reason",
      //     value: "LeadDeals.lostReason",
      //     type: "text",
      //   },
      //   {
      //     label: "Archive Status",
      //     value: "LeadDeals.archiveStatus",
      //     type: "number",
      //   },
      // ],
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
        { label: "Created At", value: "LeadOrganization.createdAt", type: "date" },
        { label: "Updated At", value: "LeadOrganization.updatedAt", type: "date" },
        { label: "Add on", value: "LeadOrganization.daterange", type: "daterange" },
      ],
      Person: [
        {
          label: "Contact Person",
          value: "LeadPerson.contactPerson",
          type: "text",
        },
        {
          label: "Postal Address",
          value: "LeadPerson.postalAddress",
          type: "text",
        },
        { label: "Email", value: "LeadPerson.email", type: "text" },
        { label: "Phone", value: "LeadPerson.phone", type: "number" },
        { label: "Job Title", value: "LeadPerson.jobTitle", type: "text" },
        {
          label: "Person Labels",
          value: "LeadPerson.personLabels",
          type: "text",
        },
        {
          label: "Organization",
          value: "LeadPerson.organization",
          type: "text",
        },
        { label: "Created At", value: "LeadPerson.createdAt", type: "date" },
        { label: "Updated At", value: "LeadPerson.updatedAt", type: "date" },
        { label: "Add on", value: "LeadPerson.daterange", type: "daterange" },
      ],
    };

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if ((entity && type && !reportId)) {
      if (entity === "Lead" && type === "Performance") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Lead Performance reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateLeadPerformanceData(
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
          totalValue = result.totalValue;
          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            segmentedBy,
            filters: filters || {},
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
          console.error("Error generating lead performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead performance data",
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      if (existingentity === "Lead" && existingtype === "Performance") {
        // Validate required fields for performance reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Lead Performance reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateExistingLeadPerformanceData(
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
          totalValue = result.totalValue;
          reportConfig = {
            reportId,
            entity: existingentity,
            type: existingtype,
            xaxis: existingxaxis,
            yaxis: existingyaxis,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors || {},
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
          console.error("Error generating lead performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead performance data",
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

async function generateExistingLeadPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
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
    groupBy.push(`Lead.${existingxaxis}`);
    attributes.push([Sequelize.col(`Lead.${existingxaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );
    if (
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo" ||
        existingSegmentedBy === "Team") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
    }

    if (
      existingSegmentedBy === "Owner" ||
      existingSegmentedBy === "assignedTo"
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Lead.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Lead.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of leads") {
    attributes.push([Sequelize.fn("COUNT", Sequelize.col("leadId")), "yValue"]);
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

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const paginatedGroups = await Lead.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        existingyaxis === "no of leads"
          ? [Sequelize.fn("COUNT", Sequelize.col("leadId")), "DESC"]
          : existingyaxis === "proposalValue"
          ? [Sequelize.fn("SUM", Sequelize.col("proposalValue")), "DESC"]
          : [
              Sequelize.fn("SUM", Sequelize.col(`Lead.${existingyaxis}`)),
              "DESC",
            ],
      ],
      limit: limit,
      offset: offset,
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };
      const whereColumn = groupBy[0].includes(".")
        ? `$${groupBy[0]}$`
        : groupBy[0];

      const nonNullGroupKeys = groupKeys.filter((key) => key !== null);
      const hasNullGroupKey = groupKeys.some((key) => key === null);

      const orConditions = [];
      if (nonNullGroupKeys.length > 0) {
        orConditions.push({ [whereColumn]: { [Op.in]: nonNullGroupKeys } });
      }
      if (hasNullGroupKey) {
        orConditions.push({ [whereColumn]: { [Op.is]: null } });
      }

      if (orConditions.length > 0) {
        const groupKeyCondition = { [Op.or]: orConditions };
        finalWhere[Op.and] = finalWhere[Op.and]
          ? [...finalWhere[Op.and], groupKeyCondition]
          : [groupKeyCondition];
      }

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
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
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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

    // Sort groups based on their total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

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
async function generateLeadPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
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
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );
    if (
      (segmentedBy === "Owner" ||
        segmentedBy === "assignedTo" ||
        segmentedBy === "Team") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
    }

    if (segmentedBy === "Owner" || segmentedBy === "assignedTo") {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Lead.${segmentedBy}`);
      attributes.push([Sequelize.col(`Lead.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle existingyaxis
  if (yaxis === "no of leads") {
    attributes.push([Sequelize.fn("COUNT", Sequelize.col("leadId")), "yValue"]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("proposalValue")),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Lead.${yaxis}`)),
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

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    const paginatedGroups = await Lead.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        yaxis === "no of leads"
          ? [Sequelize.fn("COUNT", Sequelize.col("leadId")), "DESC"]
          : yaxis === "proposalValue"
          ? [Sequelize.fn("SUM", Sequelize.col("proposalValue")), "DESC"]
          : [Sequelize.fn("SUM", Sequelize.col(`Lead.${yaxis}`)), "DESC"],
      ],
      limit: limit,
      offset: offset,
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };
      const [groupModel, groupColumn] = groupBy[0].includes(".")
        ? groupBy[0].split(".")
        : ["Lead", groupBy[0]];
      const whereColumn = groupBy[0].includes(".")
        ? `$${groupBy[0]}$`
        : groupColumn;

      const nonNullGroupKeys = groupKeys.filter((key) => key !== null);
      const hasNullGroupKey = groupKeys.some((key) => key === null);

      const orConditions = [];
      if (nonNullGroupKeys.length > 0) {
        orConditions.push({ [whereColumn]: { [Op.in]: nonNullGroupKeys } });
      }
      if (hasNullGroupKey) {
        orConditions.push({ [whereColumn]: { [Op.is]: null } });
      }
      if (orConditions.length > 0) {
        const groupKeyCondition = { [Op.or]: orConditions };
        finalWhere[Op.and] = finalWhere[Op.and]
          ? [...finalWhere[Op.and], groupKeyCondition]
          : [groupKeyCondition];
      }

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
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
      const xValue = item.xValue === null ? "Unknown" : item.xValue;
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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
    }); // Sort groups based on their total value

    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue); // Calculate the grand total

    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    })); // Calculate the grand total
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

// function getConditionObject(column, operator, value, includeModels = []) {
//   let conditionValue = value;

//   // Check if column contains a dot (indicating a related table field)
//   const hasRelation = column.includes(".");
//   let tableAlias = "Lead";
//   let fieldName = column;

//   if (hasRelation) {
//     [tableAlias, fieldName] = column.split(".");
//   }

//   // Handle date filtering for specific date columns
//   const isDateColumn =
//     fieldName.includes("Date") ||
//     fieldName.includes("Time") ||
//     fieldName === "expectedCloseDate" ||
//     fieldName === "proposalSentDate" ||
//     fieldName === "createdAt" ||
//     fieldName === "updatedAt";

//   // Handle date range filtering for "Add on" (daterange type)
//   const isDateRangeFilter = fieldName === "daterange";
  
//   if (isDateRangeFilter && Array.isArray(value)) {
//     // Handle date range filter (from frontend: ["2025-06-23", "2025-06-25"])
//     const [fromDate, toDate] = value;

//     if (operator === "between" || operator === "=" || operator === "is") {
//       // Include records within the date range
//       return {
//         [Op.and]: [
//           { createdAt: { [Op.gte]: new Date(fromDate + " 00:00:00") } },
//           { createdAt: { [Op.lte]: new Date(toDate + " 23:59:59") } },
//         ],
//       };
//     } else if (operator === "notBetween" || operator === "≠" || operator === "is not") {
//       // Exclude records within the date range (records NOT between the dates)
//       return {
//         [Op.or]: [
//           { createdAt: { [Op.lt]: new Date(fromDate + " 00:00:00") } },
//           { createdAt: { [Op.gt]: new Date(toDate + " 23:59:59") } },
//         ],
//       };
//     }
//   } else if (isDateColumn) {
//     // Handle single date filtering (e.g., "2025-06-23")
//     if (operator === "=" || operator === "is") {
//       // For exact date match, create a range for the entire day
//       const startOfDay = new Date(value + " 00:00:00");
//       const endOfDay = new Date(value + " 23:59:59");

//       return {
//         [column]: {
//           [Op.between]: [startOfDay, endOfDay],
//         },
//       };
//     } else if (operator === ">") {
//       conditionValue = new Date(value + " 23:59:59");
//     } else if (operator === "<") {
//       conditionValue = new Date(value + " 00:00:00");
//     } else if (operator === "≠" || operator === "is not") {
//       // For not equal, exclude the entire day
//       const startOfDay = new Date(value + " 00:00:00");
//       const endOfDay = new Date(value + " 23:59:59");

//       return {
//         [column]: {
//           [Op.notBetween]: [startOfDay, endOfDay],
//         },
//       };
//     } else {
//       conditionValue = new Date(value);
//     }
//   }
//   // Handle other data types
//   else if (fieldName === "isDone") {
//     conditionValue = value === "true" || value === true;
//   } else if (!isNaN(value) && value !== "" && typeof value === "string") {
//     conditionValue = parseFloat(value);
//   }

//   // Handle related table joins
//   if (hasRelation) {
//     let modelConfig;

//     switch (tableAlias) {
//       case "DealLeads":
//         modelConfig = {
//           model: Deal,
//           as: "DealLeads",
//           required: false, // Use false to avoid INNER JOIN issues
//           attributes: [],
//         };
//         break;
//       case "LeadOrganization":
//         modelConfig = {
//           model: Organization,
//           as: "LeadOrganization",
//           required: false,
//           attributes: [],
//         };
//         break;
//       case "LeadPerson":
//         modelConfig = {
//           model: Person,
//           as: "LeadPerson",
//           required: false,
//           attributes: [],
//         };
//         break;
//       default:
//         // If it's not a recognized table, treat it as Activity column
//         return getOperatorCondition(column, operator, conditionValue);
//     }

//     // Check if this include already exists to avoid duplicates
//     const existingInclude = includeModels.find(
//       (inc) => inc.as === modelConfig.as
//     );
//     if (!existingInclude) {
//       includeModels.push(modelConfig);
//     }

//     // FIX: Return a plain object instead of Sequelize.where()
//     // This creates a condition object that can be properly combined
//     const op = getSequelizeOperator(operator);
    
//     // Handle special operators for related tables
//     switch (operator) {
//       case "contains":
//         return { [`$${modelConfig.as}.${fieldName}$`]: { [op]: `%${conditionValue}%` } };
//       case "startsWith":
//         return { [`$${modelConfig.as}.${fieldName}$`]: { [op]: `${conditionValue}%` } };
//       case "endsWith":
//         return { [`$${modelConfig.as}.${fieldName}$`]: { [op]: `%${conditionValue}` } };
//       case "isEmpty":
//         return {
//           [Op.or]: [
//             { [`$${modelConfig.as}.${fieldName}$`]: { [Op.is]: null } },
//             { [`$${modelConfig.as}.${fieldName}$`]: { [Op.eq]: "" } },
//           ],
//         };
//       case "isNotEmpty":
//         return {
//           [Op.and]: [
//             { [`$${modelConfig.as}.${fieldName}$`]: { [Op.not]: null } },
//             { [`$${modelConfig.as}.${fieldName}$`]: { [Op.ne]: "" } },
//           ],
//         };
//       default:
//         return { [`$${modelConfig.as}.${fieldName}$`]: { [op]: conditionValue } };
//     }
//   } else {
//     // Regular activity table column
//     return getOperatorCondition(column, operator, conditionValue);
//   }
// }

function getConditionObject(column, operator, value, includeModels = []) {
  let conditionValue = value;

  // Check if column contains a dot (indicating a related table field)
  const hasRelation = column.includes(".");
  let tableAlias = "Lead";
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
    switch(tableAlias) {
      case "LeadOrganization":
      case "LeadPerson":
        dateField = "createdAt";
        break;
      default:
        dateField = "createdAt";
    }
    
    // For related tables, use the proper Sequelize syntax
    if (tableAlias !== "Lead") {
      // Add the required include model
      addIncludeModel(tableAlias, includeModels);
      
      // Return the condition with proper nested syntax
      if (operator === "between" || operator === "=" || operator === "is") {
        return {
          [`$${tableAlias}.${dateField}$`]: {
            [Op.between]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
        };
      } else if (operator === "notBetween" || operator === "≠" || operator === "is not") {
        return {
          [`$${tableAlias}.${dateField}$`]: {
            [Op.notBetween]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
        };
      }
    } else {
      // For Activity table
      if (operator === "between" || operator === "=" || operator === "is") {
        return {
          [dateField]: {
            [Op.between]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
        };
      } else if (operator === "notBetween" || operator === "≠" || operator === "is not") {
        return {
          [dateField]: {
            [Op.notBetween]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
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
            [Op.between]: [startOfDay, endOfDay]
          }
        };
      } else {
        return {
          [fieldName]: {
            [Op.between]: [startOfDay, endOfDay]
          }
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
            [Op.notBetween]: [startOfDay, endOfDay]
          }
        };
      } else {
        return {
          [fieldName]: {
            [Op.notBetween]: [startOfDay, endOfDay]
          }
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
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: `%${conditionValue}%` } };
      case "startsWith":
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: `${conditionValue}%` } };
      case "endsWith":
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: `%${conditionValue}` } };
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
    case "LeadPerson":
      modelConfig = {
        model: Person,
        as: "LeadPerson",
        required: false,
        attributes: [],
      };
      break;
    default:
      return; // No include needed for Activity table
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

// Helper function for operator conditions
// function getOperatorCondition(column, operator, value) {
//   const op = getSequelizeOperator(operator);

//   switch (operator) {
//     case "contains":
//       return { [column]: { [op]: `%${value}%` } };
//     case "startsWith":
//       return { [column]: { [op]: `${value}%` } };
//     case "endsWith":
//       return { [column]: { [op]: `%${value}` } };
//     case "isEmpty":
//       return {
//         [Op.or]: [
//           { [column]: { [Op.is]: null } },
//           { [column]: { [Op.eq]: "" } },
//         ],
//       };
//     case "isNotEmpty":
//       return {
//         [Op.and]: [
//           { [column]: { [Op.not]: null } },
//           { [column]: { [Op.ne]: "" } },
//         ],
//       };
//     case "between":
//     case "notBetween":
//       // These cases are handled in the main function above
//       return value; // Return the pre-built condition
//     default:
//       return { [column]: { [op]: value } };
//   }
// }

async function generateExistingLeadPerformanceDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingSegmentedBy,
  filters
) {
  let includeModels = [];
  
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
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    groupBy.push(`Lead.${existingxaxis}`);
    attributes.push([Sequelize.col(`Lead.${existingxaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );
    if (
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo" ||
        existingSegmentedBy === "Team") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
    }

    if (
      existingSegmentedBy === "Owner" ||
      existingSegmentedBy === "assignedTo"
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Lead.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Lead.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of leads") {
    attributes.push([Sequelize.fn("COUNT", Sequelize.col("leadId")), "yValue"]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("proposalValue")),
      "yValue",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([Sequelize.fn("SUM", Sequelize.col("value")), "yValue"]);
  } else {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Lead.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Get total count
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

  // Get all results without pagination
  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // Format the results for the frontend
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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

    // Sort groups based on their total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return all data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
    totalCount: totalCount,
  };
}

// Helper function to generate activity performance data without pagination
async function generateLeadPerformanceDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  segmentedBy,
  filters
) {
  let includeModels = [];

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
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "creatorstatus") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );
    if (
      (segmentedBy === "Owner" ||
        segmentedBy === "assignedTo" ||
        segmentedBy === "Team") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
    }

    if (segmentedBy === "Owner" || segmentedBy === "assignedTo") {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Lead.${segmentedBy}`);
      attributes.push([Sequelize.col(`Lead.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle yaxis
  if (yaxis === "no of leads") {
    attributes.push([Sequelize.fn("COUNT", Sequelize.col("leadId")), "yValue"]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("proposalValue")),
      "yValue",
    ]);
  } else {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Lead.${yaxis}`)),
      "yValue",
    ]);
  }

  // Get total count
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

  // Get all results without pagination
  let results;

  if (segmentedBy && segmentedBy !== "none") {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      const xValue = item.xValue === null ? "Unknown" : item.xValue;
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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

    // Sort groups based on their total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return all data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
    totalCount: totalCount,
  };
}

exports.saveLeadPerformReport = async (req, res) => {
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
    const role = req.role;

    let reportData = null;
    let paginationInfo = null;
    let totalValue = null;
    let reportConfig = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
      if (entity === "Lead" && type === "Performance") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Lead Performance reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateLeadPerformanceDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            segmentedBy,
            filters
          );
          reportData = result.data;
          paginationInfo = result.pagination;
          totalValue = result.totalValue;
          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            segmentedBy,
            filters: filters || {},
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating lead performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead performance data",
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
        filters: existingfilters,
        reportData: existingReportData,
      } = config;

      if (existingentity === "Lead" && existingtype === "Performance") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for lead Performance reports",
          });
        }

        try {
          const result = await generateExistingLeadPerformanceDataForSave(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingSegmentedBy,
            existingfilters
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
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating lead performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead performance data",
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
        updateData.dashboardIds = dashboardIdsArray.join(',');
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
        filters: filters || {},
        reportData,
        totalValue,
      };

      const reportName = description || `${entity} ${type}`;

      const newReport = await Report.create({
        dashboardIds: dashboardIdsArray.join(','),
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

exports.updateLeadPerformReport = async (req, res) => {
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

exports.deleteLeadPerformReport = async (req, res) => {
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

exports.getLeadPerformReportSummary = async (req, res) => {
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
        { title: { [Op.like]: `%${search}%` } },
        { value: { [Op.like]: `%${search}%` } },
        { ownerName: { [Op.like]: `%${search}%` } },
        { sourceOrigin: { [Op.like]: `%${search}%` } },
      ];
    }

    // Initialize include array for main query
    const include = [
      {
        model: MasterUser,
        as: "Owner",
        attributes: ["masterUserID", "name", "email"],
        required: false,
      },
    ];

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
        "contactPerson",
        "organization",
        "valueLabels",
        "expectedCloseDate",
        "sourceChannel",
        "sourceChannelId",
        "serviceType",
        "scopeOfServiceType",
        "phone",
        "email",
        "company",
        "proposalValue",
        "proposalValueCurrency",
        "esplProposalNo",
        "projectLocation",
        "organizationCountry",
        "proposalSentDate",
        "SBUClass",
        "numberOfReportsPrepared",
        "sectoralSector",
        "sourceOrigin",
        "sourceOriginID",
        "valueCurrency",
      ],
    });

    // Generate report data (like your existing performance report)
    let reportData = [];
    let summary = {};

    if (xaxis && yaxis && !reportId) {
      const reportResult = await generateLeadPerformanceData(
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
      }if (reportData.length > 0) {
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateExistingLeadPerformanceData(
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

    // Format activities for response
    const formattedActivities = leads.map((lead) => ({
      id: lead.leadId,
      title: lead.title,
      value: lead.value,
      ownerName: lead.ownerName,
      status: lead.status,
      createdAt: lead.createdAt,
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      valueLabels: lead.valueLabels,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelId: lead.sourceChannelId,
      serviceType: lead.serviceType,
      scopeOfServiceType: lead.scopeOfServiceType,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      proposalValue: lead.proposalValue,
      proposalValueCurrency: lead.proposalValueCurrency,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      SBUClass: lead.SBUClass,
      numberOfReportsPrepared: lead.numberOfReportsPrepared,
      sectoralSector: lead.sectoralSector,
      sourceOrigin: lead.sourceOrigin,
      sourceOriginID: lead.sourceOriginID,
      valueCurrency: lead.valueCurrency,
      dealId: lead.dealId ? "won" : "pending",
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

exports.createLeadConversionReport = async (req, res) => {
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
      limit = 8,
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
      "creator",
      "creatorstatus",
    ];

    const segmentedByOptions = [
      "none",
      "esplProposalNo",
      "numberOfReportsPrepared",
      "organizationCountry",
      "projectLocation",
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
      "creator",
      "creatorstatus",  
    ];

    const yaxisArray = ["no of leads", "proposalValue", "value"];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Lead: [
        { label: "ESPL Proposal No", value: "esplProposalNo", type: "number" },
        {
          label: "No of Reports",
          value: "numberOfReportsPrepared",
          type: "number",
        },
        {
          label: "Organization Country",
          value: "organizationCountry",
          type: "text",
        },
        { label: "Project Location", value: "projectLocation", type: "text" },
        {
          label: "Proposal Sent Date",
          value: "proposalSentDate",
          type: "date",
        },
        { label: "Owner Name", value: "ownerName", type: "text" },
        { label: "SBU Class", value: "SBUClass", type: "text" },
        { label: "Status", value: "status", type: "text" },
        {
          label: "Scope Of Service Type",
          value: "scopeOfServiceType",
          type: "text",
        },
        { label: "Service Type", value: "serviceType", type: "text" },
        { label: "Source Channel", value: "sourceChannel", type: "text" },
        {
          label: "Source Channel ID",
          value: "sourceChannelID",
          type: "number",
        },
        { label: "Source Origin", value: "sourceOrigin", type: "text" },
        { label: "Source Origin Id", value: "sourceOriginID", type: "number" },
        { label: "Contact Person", value: "contactPerson", type: "text" },
        { label: "Organization", value: "organization", type: "text" },
        { label: "Title", value: "title", type: "text" },
        { label: "Proposal Value", value: "proposalValue", type: "number" },
        { label: "Sectoral Sector", value: "sectoralSector", type: "text" },
        { label: "Lead Quality", value: "leadQuality", type: "text" },
        { label: "Value", value: "value", type: "number" },
        {
          label: "Proposal Value Currency",
          value: "proposalValueCurrency",
          type: "text",
        },
        { label: "Value Currency", value: "valueCurrency", type: "text" },
        { label: "Value Labels", value: "valueLabels", type: "text" },
        {
          label: "Expected Close Date",
          value: "expectedCloseDate",
          type: "date",
        },
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
      ],
      Person: [
        {
          label: "Contact Person",
          value: "LeadPerson.contactPerson",
          type: "text",
        },
        {
          label: "Postal Address",
          value: "LeadPerson.postalAddress",
          type: "text",
        },
        { label: "Email", value: "LeadPerson.email", type: "text" },
        { label: "Phone", value: "LeadPerson.phone", type: "number" },
        { label: "Job Title", value: "LeadPerson.jobTitle", type: "text" },
        {
          label: "Person Labels",
          value: "LeadPerson.personLabels",
          type: "text",
        },
        {
          label: "Organization",
          value: "LeadPerson.organization",
          type: "text",
        },
      ],
    };

    // For Activity Conversion reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if ((entity && type && !reportId)) {
      if (entity === "Lead" && type === "Conversion") {
        // Validate required fields for Conversion reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Lead Conversion reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateLeadConversionData(
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
          totalValue = result.totalValue;
          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            segmentedBy,
            filters: filters || {},
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
          console.error("Error generating lead Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead Conversion data",
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      if (existingentity === "Lead" && existingtype === "Conversion") {
        // Validate required fields for Conversion reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Lead Conversion reports",
          });
        }

        try {
          // Generate data with pagination
          const result =
            await generateExistingLeadConversionData(
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
          totalValue = result.totalValue;
          reportConfig = {
            reportId,
            entity: existingentity,
            type: existingtype,
            xaxis: existingxaxis,
            yaxis: existingyaxis,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors || {},
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
          console.error("Error generating lead Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead Conversion data",
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
        segmentedByOptions: segmentedByOptions
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

async function generateExistingLeadConversionData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
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
    groupBy.push(`Lead.${existingxaxis}`);
    attributes.push([Sequelize.col(`Lead.${existingxaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    if (
      existingSegmentedBy === "Owner" ||
      existingSegmentedBy === "assignedTo"
    ) {
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
      groupBy.push(`Lead.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Lead.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of leads") {
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

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const paginatedGroups = await Lead.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        existingyaxis === "no of leads"
          ? [
              Sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
              "DESC",
            ]
          : existingyaxis === "proposalValue"
          ? [
              Sequelize.literal(
                `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
              ),
              "DESC",
            ]
          : existingyaxis === "value"
          ? [
              Sequelize.literal(
                `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
              ),
              "DESC",
            ]
          : [
              Sequelize.fn("SUM", Sequelize.col(`Lead.${existingyaxis}`)),
              "DESC",
            ],
      ],
      limit: limit,
      offset: offset,
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };
      const whereColumn = groupBy[0].includes(".")
        ? `$${groupBy[0]}$`
        : groupBy[0];

      const nonNullGroupKeys = groupKeys.filter((key) => key !== null);
      const hasNullGroupKey = groupKeys.some((key) => key === null);

      const orConditions = [];
      if (nonNullGroupKeys.length > 0) {
        orConditions.push({ [whereColumn]: { [Op.in]: nonNullGroupKeys } });
      }
      if (hasNullGroupKey) {
        orConditions.push({ [whereColumn]: { [Op.is]: null } });
      }

      if (orConditions.length > 0) {
        const groupKeyCondition = { [Op.or]: orConditions };
        finalWhere[Op.and] = finalWhere[Op.and]
          ? [...finalWhere[Op.and], groupKeyCondition]
          : [groupKeyCondition];
      }

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
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
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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

    // Sort groups based on their total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

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
async function generateLeadConversionData(
  ownerId,
  role,
  xaxis,
  yaxis,
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

  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );
    if (
      (segmentedBy === "Owner" ||
        segmentedBy === "assignedTo" ||
        segmentedBy === "Team") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
    }

    if (segmentedBy === "Owner" || segmentedBy === "assignedTo") {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Lead.${segmentedBy}`);
      attributes.push([Sequelize.col(`Lead.${segmentedBy}`), "segmentValue"]);
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

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    const paginatedGroups = await Lead.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        yaxis === "no of leads"
          ? [Sequelize.fn("COUNT", Sequelize.col("leadId")), "DESC"]
          : yaxis === "proposalValue"
          ? [Sequelize.fn("SUM", Sequelize.col("proposalValue")), "DESC"]
          : [Sequelize.fn("SUM", Sequelize.col(`Lead.${yaxis}`)), "DESC"],
      ],
      limit: limit,
      offset: offset,
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };
      const [groupModel, groupColumn] = groupBy[0].includes(".")
        ? groupBy[0].split(".")
        : ["Lead", groupBy[0]];
      const whereColumn = groupBy[0].includes(".")
        ? `$${groupBy[0]}$`
        : groupColumn;

      const nonNullGroupKeys = groupKeys.filter((key) => key !== null);
      const hasNullGroupKey = groupKeys.some((key) => key === null);

      const orConditions = [];
      if (nonNullGroupKeys.length > 0) {
        orConditions.push({ [whereColumn]: { [Op.in]: nonNullGroupKeys } });
      }
      if (hasNullGroupKey) {
        orConditions.push({ [whereColumn]: { [Op.is]: null } });
      }
      if (orConditions.length > 0) {
        const groupKeyCondition = { [Op.or]: orConditions };
        finalWhere[Op.and] = finalWhere[Op.and]
          ? [...finalWhere[Op.and], groupKeyCondition]
          : [groupKeyCondition];
      }

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
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
      const xValue = item.xValue === null ? "Unknown" : item.xValue;
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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
    }); // Sort groups based on their total value

    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue); // Calculate the grand total

    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    })); // Calculate the grand total
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

async function generateExistingLeadConversionDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingSegmentedBy,
  filters
) {
  let includeModels = [];
  
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
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    groupBy.push(`Lead.${existingxaxis}`);
    attributes.push([Sequelize.col(`Lead.${existingxaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    if (
      existingSegmentedBy === "Owner" ||
      existingSegmentedBy === "assignedTo"
    ) {
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
      groupBy.push(`Lead.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Lead.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of leads") {
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
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Lead.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Get total count
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

  // Get all results without pagination
  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // Format the results for the frontend
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      const xValue = item.xValue || "Unknown";
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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

    // Sort groups based on their total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return all data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
    totalCount: totalCount,
  };
}

// Helper function to generate conversion activity performance data without pagination
async function generateLeadConversionDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  segmentedBy,
  filters
) {
  let includeModels = [];

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
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "creatorstatus") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else {
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );
    if (
      (segmentedBy === "Owner" ||
        segmentedBy === "assignedTo" ||
        segmentedBy === "Team") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
    }

    if (segmentedBy === "Owner" || segmentedBy === "assignedTo") {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else {
      groupBy.push(`Lead.${segmentedBy}`);
      attributes.push([Sequelize.col(`Lead.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle yaxis
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
    attributes.push([
      Sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END)`
      ),
      "yValue",
    ]);
  }

  // Get total count
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

  // Get all results without pagination
  let results;

  if (segmentedBy && segmentedBy !== "none") {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      const xValue = item.xValue === null ? "Unknown" : item.xValue;
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = { label: xValue, segments: [] };
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

    // Sort groups based on their total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return all data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
    totalCount: totalCount,
  };
}

exports.saveLeadConversionReport = async (req, res) => {
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
    const role = req.role;

    let reportData = null;
    let paginationInfo = null;
    let totalValue = null;
    let reportConfig = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
      if (entity === "Lead" && type === "Conversion") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Lead Conversion reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateLeadConversionDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            segmentedBy,
            filters
          );
          reportData = result.data;
          paginationInfo = result.pagination;
          totalValue = result.totalValue;
          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            segmentedBy,
            filters: filters || {},
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating Lead Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Lead Conversion data",
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
        filters: existingfilters,
        reportData: existingReportData,
      } = config;

      if (existingentity === "Lead" && existingtype === "Conversion") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Lead Conversion reports",
          });
        }

        try {
          const result =
            await generateExistingLeadConversionDataForSave(
              ownerId,
              role,
              existingxaxis,
              existingyaxis,
              existingSegmentedBy,
              existingfilters
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
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating Lead Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Lead Conversion data",
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
        updateData.dashboardIds = dashboardIdsArray.join(',');
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
        filters: filters || {},
        reportData,
        totalValue,
      };

      const reportName = description || `${entity} ${type}`;

      const newReport = await Report.create({
        dashboardIds: dashboardIdsArray.join(','),
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

exports.getLeadConversionReportSummary = async (req, res) => {
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
      limit = 500,
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

    // Initialize include array for main query
    const include = [
      {
        model: MasterUser,
        as: "Owner",
        attributes: ["masterUserID", "name", "email"],
        required: false,
      },
    ];

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
        "contactPerson",
        "organization",
        "valueLabels",
        "expectedCloseDate",
        "sourceChannel",
        "sourceChannelId",
        "serviceType",
        "scopeOfServiceType",
        "phone",
        "email",
        "company",
        "proposalValue",
        "proposalValueCurrency",
        "esplProposalNo",
        "projectLocation",
        "organizationCountry",
        "proposalSentDate",
        "SBUClass",
        "numberOfReportsPrepared",
        "sectoralSector",
        "sourceOrigin",
        "sourceOriginID",
        "valueCurrency",
      ],
    });

    // Generate report data (like your existing performance report)
    let reportData = [];
    let summary = {};

    if (xaxis && yaxis && !reportId) {
      const reportResult = await generateLeadConversionData(
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateExistingLeadConversionData(
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

    // Format activities for response
    const formattedActivities = leads.map((lead) => ({
      id: lead.leadId,
      title: lead.title,
      value: lead.value,
      ownerName: lead.ownerName,
      status: lead.status,
      createdAt: lead.createdAt,
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      valueLabels: lead.valueLabels,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelId: lead.sourceChannelId,
      serviceType: lead.serviceType,
      scopeOfServiceType: lead.scopeOfServiceType,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      proposalValue: lead.proposalValue,
      proposalValueCurrency: lead.proposalValueCurrency,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      SBUClass: lead.SBUClass,
      numberOfReportsPrepared: lead.numberOfReportsPrepared,
      sectoralSector: lead.sectoralSector,
      sourceOrigin: lead.sourceOrigin,
      sourceOriginID: lead.sourceOriginID,
      valueCurrency: lead.valueCurrency,
      dealId: lead.dealId ? "won" : "pending",
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
