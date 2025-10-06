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
const { getLeadConditionObject } = require("../../../utils/conditionObject/lead");
const { getActivityConditionObject } = require("../../../utils/conditionObject/activity");
const { getDealConditionObject } = require("../../../utils/conditionObject/deal");
const { getPersonConditionObject } = require("../../../utils/conditionObject/createPerson");
const LeadPerson = require("../../../models/leads/leadPersonModel");


exports.createActivityReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      filters,
      segmentedBy = "none",
      page = 1,
      limit = 8,
    } = req.body;
    const ownerId = req.adminId;
    const role = req.role;

    // Define available options for xaxis and yaxis
    const xaxisArray = [
      "Owner",
      "status",
      "type",
      "subject",
      "location",
      "priority",
      "contactPerson",
      "organization",
      "startDateTime",
      "endDateTime",
      "createdAt",
    ];

    const segmentedByOptions = [
      "none",
      "Owner",
      "status",
      "type",
      "subject",
      "location",
      "priority",
      "contactPerson",
      "organization",
    ];

    const yaxisArray = ["no of activities", "duration"];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Activity: [
        { label: "Subject", value: "subject", type: "text" },
        { label: "Type", value: "type", type: "text" },
        { label: "Priority", value: "priority", type: "text" },
        { label: "Status", value: "status", type: "text" },
        { label: "Location", value: "location", type: "text" },
        { label: "Contact Person", value: "contactPerson", type: "text" },
        { label: "Organization", value: "organization", type: "text" },
        { label: "Is Done", value: "isDone", type: "number" },
        { label: "Start Date Time", value: "startDateTime", type: "date" },
        { label: "End Date Time", value: "endDateTime", type: "date" },
        { label: "Created At", value: "createdAt", type: "date" },
        { label: "Updated At", value: "updatedAt", type: "date" },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
      Deal: [
        { label: "Title", value: "ActivityDeal.title", type: "text" },
        { label: "Value", value: "ActivityDeal.value", type: "text" },
        { label: "Currency", value: "ActivityDeal.currency", type: "text" },
        { label: "Pipeline", value: "ActivityDeal.pipeline", type: "text" },
        {
          label: "Pipeline Stage",
          value: "ActivityDeal.pipelineStage",
          type: "text",
        },
        { label: "Label", value: "ActivityDeal.label", type: "text" },
        {
          label: "Expected Close Date",
          value: "ActivityDeal.expectedCloseDate",
          type: "date",
        },
        {
          label: "Source Channel",
          value: "ActivityDeal.sourceChannel",
          type: "text",
        },
        {
          label: "Service Type",
          value: "ActivityDeal.serviceType",
          type: "text",
        },
        {
          label: "Proposal Value",
          value: "ActivityDeal.proposalValue",
          type: "number",
        },
        {
          label: "Proposal Currency",
          value: "ActivityDeal.proposalCurrency",
          type: "text",
        },
        {
          label: "ESPL Proposal No",
          value: "ActivityDeal.esplProposalNo",
          type: "number",
        },
        {
          label: "Project Location",
          value: "ActivityDeal.projectLocation",
          type: "text",
        },
        {
          label: "Organization Country",
          value: "ActivityDeal.organizationCountry",
          type: "text",
        },
        {
          label: "Proposal Sent Date",
          value: "ActivityDeal.proposalSentDate",
          type: "date",
        },
        {
          label: "Source Required",
          value: "ActivityDeal.sourceRequired",
          type: "text",
        },
        {
          label: "Questioner Shared",
          value: "ActivityDeal.questionerShared",
          type: "number",
        },
        {
          label: "Sectorial Sector",
          value: "ActivityDeal.sectorialSector",
          type: "text",
        },
        { label: "SBU Class", value: "ActivityDeal.sbuClass", type: "text" },
        { label: "Phone", value: "ActivityDeal.phone", type: "number" },
        { label: "Email", value: "ActivityDeal.email", type: "text" },
        {
          label: "Source Origin",
          value: "ActivityDeal.sourceOrgin",
          type: "text",
        },
        { label: "Status", value: "ActivityDeal.status", type: "number" },
        {
          label: "Product Name",
          value: "ActivityDeal.productName",
          type: "text",
        },
        {
          label: "Weighted Value",
          value: "ActivityDeal.weightedValue",
          type: "number",
        },
        {
          label: "Probability",
          value: "ActivityDeal.probability",
          type: "text",
        },
        { label: "Stage", value: "ActivityDeal.stage", type: "text" },
        {
          label: "Lost Reason",
          value: "ActivityDeal.lostReason",
          type: "text",
        },
        {
          label: "Archive Status",
          value: "ActivityDeal.archiveStatus",
          type: "number",
        },
        { label: "Created At", value: "ActivityDeal.createdAt", type: "date" },
        { label: "Updated At", value: "ActivityDeal.updatedAt", type: "date" },
        { label: "Add on", value: "ActivityDeal.daterange", type: "daterange" },
      ],
      Lead: [
        {
          label: "Contact Person",
          value: "ActivityLead.contactPerson",
          type: "text",
        },
        {
          label: "Organization",
          value: "ActivityLead.organization",
          type: "text",
        },
        { label: "Title", value: "ActivityLead.title", type: "text" },
        {
          label: "Value Labels",
          value: "ActivityLead.valueLabels",
          type: "text",
        },
        {
          label: "Expected Close Date",
          value: "ActivityLead.expectedCloseDate",
          type: "date",
        },
        {
          label: "Source Channel",
          value: "ActivityLead.sourceChannel",
          type: "text",
        },
        {
          label: "Source Channel ID",
          value: "ActivityLead.sourceChannelID",
          type: "number",
        },
        {
          label: "Service Type",
          value: "ActivityLead.serviceType",
          type: "text",
        },
        {
          label: "Scope Of Service Type",
          value: "ActivityLead.scopeOfServiceType",
          type: "text",
        },
        { label: "Phone", value: "ActivityLead.phone", type: "number" },
        { label: "Email", value: "ActivityLead.email", type: "text" },
        { label: "Company", value: "ActivityLead.company", type: "text" },
        {
          label: "Proposal Value",
          value: "ActivityLead.proposalValue",
          type: "number",
        },
        {
          label: "ESPL Proposal No",
          value: "ActivityLead.esplProposalNo",
          type: "number",
        },
        {
          label: "Project Location",
          value: "ActivityLead.projectLocation",
          type: "text",
        },
        {
          label: "Organization Country",
          value: "ActivityLead.organizationCountry",
          type: "text",
        },
        {
          label: "Proposal Sent Date",
          value: "ActivityLead.proposalSentDate",
          type: "date",
        },
        { label: "Status", value: "ActivityLead.status", type: "number" },
        { label: "SBU Class", value: "ActivityLead.SBUClass", type: "text" },
        {
          label: "Sectoral Sector",
          value: "ActivityLead.sectoralSector",
          type: "text",
        },
        {
          label: "Source Origin",
          value: "ActivityLead.sourceOrigin",
          type: "text",
        },
        {
          label: "Lead Quality",
          value: "ActivityLead.leadQuality",
          type: "text",
        },
        { label: "Value", value: "ActivityLead.value", type: "number" },
        {
          label: "Proposal Value Currency",
          value: "ActivityLead.proposalValueCurrency",
          type: "text",
        },
        {
          label: "Value Currency",
          value: "ActivityLead.valueCurrency",
          type: "text",
        },
        { label: "Created At", value: "ActivityLead.createdAt", type: "date" },
        { label: "Updated At", value: "ActivityLead.updatedAt", type: "date" },
        { label: "Add on", value: "ActivityLead.daterange", type: "daterange" },
      ],
      Organization: [
        {
          label: "Organization",
          value: "ActivityOrganization.organization",
          type: "text",
        },
        {
          label: "Organization Labels",
          value: "ActivityOrganization.organizationLabels",
          type: "text",
        },
        {
          label: "Address",
          value: "ActivityOrganization.address",
          type: "text",
        },
        {
          label: "Created At",
          value: "ActivityOrganization.createdAt",
          type: "date",
        },
        {
          label: "Updated At",
          value: "ActivityOrganization.updatedAt",
          type: "date",
        },
        {
          label: "Add on",
          value: "ActivityOrganization.daterange",
          type: "daterange",
        },
      ],
      Person: [
        {
          label: "Contact Person",
          value: "ActivityPerson.contactPerson",
          type: "text",
        },
        {
          label: "Postal Address",
          value: "ActivityPerson.postalAddress",
          type: "text",
        },
        { label: "Email", value: "ActivityPerson.email", type: "text" },
        { label: "Phone", value: "ActivityPerson.phone", type: "number" },
        { label: "Job Title", value: "ActivityPerson.jobTitle", type: "text" },
        {
          label: "Person Labels",
          value: "ActivityPerson.personLabels",
          type: "text",
        },
        {
          label: "Organization",
          value: "ActivityPerson.organization",
          type: "text",
        },
        {
          label: "Created At",
          value: "ActivityPerson.createdAt",
          type: "date",
        },
        {
          label: "Updated At",
          value: "ActivityPerson.updatedAt",
          type: "date",
        },
        {
          label: "Add on",
          value: "ActivityPerson.daterange",
          type: "daterange",
        },
      ],
    };

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
            segmentedBy,
            filters,
            page,
            limit
          );
          reportData = result.data;
          paginationInfo = result.pagination;
          totalValue = result.totalValue;
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
          reportConfig = {
            entity,
            type,
            xaxis,
            yaxis,
            segmentedBy,
            filters: filters || {},
            reportData,
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
    } else if ((entity && type && reportId) || (!entity && !type && reportId)) {
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
exports.createActivityReportDrillDown = async (req, res) => {
  try {
    const {
      xaxis,
      yaxis,
      filters,
      segmentedBy = "none",
      page = 1,
      limit = 8,
      fieldName,
      fieldValue,
      id,
      moduleId
    } = req.body;
    const ownerId = req.adminId;
    const role = req.role;

    const result = await generateActivityPerformanceDataForDrillDown(
      ownerId,
      role,
      filters,
      fieldName,
      fieldValue,
      id,
      moduleId
    );

    return res.status(200).json({
      success: true,
      message: "Data generated successfully",
      data: result?.data,
      pagination: result?.data?.length,
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

exports.getInsightReportsData = async (req, res) => {
  try {
    // your Activity model

    function buildWhere(data) {
      const where = {};

      // main fieldName condition
      where[data.fieldName] = data.fieldValue;

      // loop over conditions
      if (Array.isArray(data.conditions)) {
        data.conditions.forEach((cond) => {
          let op;

          switch (cond.operator) {
            case "=":
              op = Op.eq;
              break;
            case "!=":
              op = Op.ne;
              break;
            case ">":
              op = Op.gt;
              break;
            case "<":
              op = Op.lt;
              break;
            case ">=":
              op = Op.gte;
              break;
            case "<=":
              op = Op.lte;
              break;
            case "IN":
              op = Op.in;
              break;
            case "NOT IN":
              op = Op.notIn;
              break;
            case "LIKE":
              op = Op.like;
              break;
            default:
              throw new Error(`Unsupported operator: ${cond.operator}`);
          }

          where[cond.column] = { [op]: cond.value };
        });
      }

      return where;
    }
    const where = buildWhere(data);

    console.log(where);
    // const activities = await Activity.findAll({
    //   where,
    //   raw: true, // plain objects instead of Sequelize instances
    // });

    return res.status(200).json({
      success: true,
      message: "Data generated successfully",
      data: reportData,
      // totalValue: activities,
      totalValue: where,
    });
  } catch {}
};

async function generateExistingActivityPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingSegmentedBy,
  existingfilters,
  page = 1,
  limit = 8
) {
  let includeModels = [];
  const offset = (page - 1) * limit;
  const baseWhere = {};

  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  // --- (Filter handling code remains the same) ---
  if (existingfilters && existingfilters.conditions) {
    const validConditions = existingfilters.conditions.filter(
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

  // --- (Attribute and GroupBy setup remains the same) ---
  if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else {
    groupBy.push(`Activity.${existingxaxis}`);
    attributes.push([Sequelize.col(`Activity.${existingxaxis}`), "xValue"]);
  }

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
      groupBy.push(`Activity.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Activity.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  if (existingyaxis === "no of activities") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("activityId")),
      "yValue",
    ]);
  } else if (existingyaxis === "duration") {
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
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Activity.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // --- (Pagination and Query logic remains the same) ---
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

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const paginatedGroups = await Activity.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        existingyaxis === "no of activities"
          ? [Sequelize.fn("COUNT", Sequelize.col("activityId")), "DESC"]
          : existingyaxis === "duration"
          ? [
              Sequelize.fn(
                "AVG",
                Sequelize.fn(
                  "TIMESTAMPDIFF",
                  Sequelize.literal("HOUR"),
                  Sequelize.col("startDateTime"),
                  Sequelize.col("endDateTime")
                )
              ),
              "DESC",
            ]
          : [
              Sequelize.fn("SUM", Sequelize.col(`Activity.${existingyaxis}`)),
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

      results = await Activity.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Activity.findAll({
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

  // --- NEW FORMATTING AND TOTALING LOGIC ---
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
    // Logic for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return final response with totals
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
async function generateActivityPerformanceData(
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
  const offset = (page - 1) * limit;
  const baseWhere = {};

  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

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

      // console.log(conditions, "CONDITIONs");
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
  let attributes = ["personId", "leadOrganizationId"];

  if (xaxis === "Owner" || xaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else {
    groupBy.push(`Activity.${xaxis}`);
    attributes.push([Sequelize.col(`Activity.${xaxis}`), "xValue"]);
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
      groupBy.push(`Activity.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`Activity.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  if (yaxis === "no of activities") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("activityId")),
      "yValue",
    ]);
  } else if (yaxis === "duration") {
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
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Activity.${yaxis}`)),
      "yValue",
    ]);
  }

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

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    const paginatedGroups = await Activity.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        yaxis === "no of activities"
          ? [Sequelize.fn("COUNT", Sequelize.col("activityId")), "DESC"]
          : yaxis === "duration"
          ? [
              Sequelize.fn(
                "AVG",
                Sequelize.fn(
                  "TIMESTAMPDIFF",
                  Sequelize.literal("HOUR"),
                  Sequelize.col("startDateTime"),
                  Sequelize.col("endDateTime")
                )
              ),
              "DESC",
            ]
          : [Sequelize.fn("SUM", Sequelize.col(`Activity.${yaxis}`)), "DESC"],
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
        : ["Activity", groupBy[0]];
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

      results = await Activity.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: [...groupBy],
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Activity.findAll({
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

  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      const xValue = item.xValue === null ? "Unknown" : item.xValue;
      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        if (xaxis == "contactPerson") {
          groupedData[xValue] = {
            label: xValue,
            segments: [],
            id: item?.personId || null,
          };
        } else if (xaxis == "organization") {
          groupedData[xValue] = {
            label: xValue,
            segments: [],
            id: item?.leadOrganizationId || null,
          };
        } else {
          groupedData[xValue] = { label: xValue, segments: [], id: null };
        }
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
    formattedResults = results.map((item) => {
      if (xaxis == "contactPerson") {
        return {
          label: item.xValue || "Unknown",
          value: Number(item.yValue) || 0,
          id: item?.personId || null,
        };
      } else if (xaxis == "organization") {
        return {
          label: item.xValue || "Unknown",
          value: Number(item.yValue) || 0,
          id: item?.leadOrganizationId || null,
        };
      } else {
        return {
          label: item.xValue || "Unknown",
          value: Number(item.yValue) || 0,
          id: null,
        };
      }
    }); // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // let finalResult = formattedResults
  // if(xaxis == "startDateTime" || xaxis == "endDateTime"){
  //   const formattedData = Object.values(
  //     formattedResults.reduce((acc, { label, value }) => {
  //       const date = new Date(label).toISOString().split('T')[0]; // Extract YYYY-MM-DD
  //       acc[date] = acc[date] || { label: date, value: 0, id: null };
  //       acc[date].value += value;
  //       return acc;
  //     }, {})
  //   ).sort((a, b) => new Date(a.label) - new Date(b.label)); // Sort by date

  //   // console
  //   finalResult = formattedData
  // }

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

async function generateActivityPerformanceDataForDrillDown(
  ownerId,
  role,
  filters,
  name,
  value,
  id,
  entity
) {
  let includeModels = [];
  const baseWhere = {};

  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  let groupBy = [];
  let attributes = [];

  const conditionObjFunc = {
    0: getActivityConditionObject,
    1: getLeadConditionObject,
    2: getDealConditionObject,
    3: getPersonConditionObject,
    4: getPersonConditionObject
  }
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      const filterIncludeModels = [];
      const conditions = validConditions.map((cond) => {
        return conditionObjFunc[entity](
          cond.column,
          cond.operator,
          cond.value,
          filterIncludeModels
        );
      });

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

  const entityData = {
    0: Activity,
    1: Lead,
    2: Deal,
    3: LeadPerson,
    4: Organization
  }

  const tableName = entityData[entity]
  const columnNames = Object.keys(tableName.rawAttributes);
  attributes = [...attributes, ...columnNames];

  let results;
  
  let addIncludeModel = includeModels;
  if(entity != 4 && entity != 3){
    if(entity == 1){
      addIncludeModel = [...includeModels,
       {
        model: MasterUser,
        as: 'Owner', // For masterUserID
        attributes: ['masterUserID', 'name'],
      }]
    }else if(entity == 2){
      addIncludeModel = [...includeModels,
       {
        model: MasterUser,
        as: 'Owner', // For masterUserID
        attributes: ['masterUserID', 'name'],
      }]
    }
    else{
      addIncludeModel = [...includeModels,
        {
      model: MasterUser,
      as: 'assignedUser', // For masterUserID
      attributes: ['masterUserID', 'name'],
    },
    {
      model: MasterUser,
      as: 'assignee', // For assignedTo
      attributes: [ 'masterUserID', 'name'],
    }]
  }
  }else{
    if(entity == 4){
      addIncludeModel = [...includeModels,
        {
          model: MasterUser,
          as: 'MasterUser',
          required: false, // LEFT JOIN
        },
      ]
    }
  }

  results = await tableName.findAll({
    where: baseWhere,
    attributes: attributes,
    include: [...addIncludeModel],
    groupBy: groupBy
  });
  
  // console.log(results)
  // Recursive flatten function
  function flattenObject(obj, parentKey = "", res = {}) {
    for (let key in obj) {
      const newKey = parentKey ? `${parentKey}_${key}` : key;
      
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      flattenObject(obj[key], newKey, res);
    } else {
      res[newKey] = obj[key];
    } 
  }
  return res;
}

const flattened = JSON.parse(JSON.stringify(results, null, 2)).map(item => flattenObject(item));

const formattedResults = flattened.filter((item) => {
  if (name === "startDateTime") {
    /* for date only comparison */
    // const dateTimeString = value;
    // const dateOnly = dateTimeString.split('T')[0];

    // const dateTimeString2 = item?.startDateTime;
    // const dateOnly2 = dateTimeString2.split('T')[0];
    return (
      new Date(value).getTime() === new Date(item?.startDateTime).getTime()
    );
  }

  if (name === "endDateTime") {
    return (
      new Date(value).getTime() === new Date(item?.endDateTime).getTime()
    );
  }
  if (name === "Owner") {
    return (
      item["assignedUser_name"]?.toLowerCase() == value?.toLowerCase()
    );
  }

  // Handle string fields safely
  if (typeof item[name] === "string" && typeof value === "string") {
    // console.log(item[name], value)
    if (item[name].toLowerCase() !== value.toLowerCase()) return false;
  } else {
    if (item[name] !== value) return false;
  }

  /**
   * id based matching of person and organization
   * maybe uncommented in future
   */
  // Extra checks
  // if (name === "contactPerson" && item.personId !== id) return false;
  // if (entity != 4 && name === "organization" && item.leadOrganizationId !== id) return false;

  return true;
});


return {
  data: formattedResults,
  totalValue: formattedResults?.length
};
}

// Enhanced helper function to handle related table conditions and date filtering
// function getConditionObject(column, operator, value, includeModels = []) {
//   let conditionValue = value;

//   // Check if column contains a dot (indicating a related table field)
//   const hasRelation = column.includes(".");
//   let tableAlias = "Activity";
//   let fieldName = column;

//   if (hasRelation) {
//     [tableAlias, fieldName] = column.split(".");
//   }

//   // Handle date filtering for specific date columns
//   const isDateColumn =
//     fieldName.includes("Date") ||
//     fieldName.includes("Time") ||
//     fieldName === "startDateTime" ||
//     fieldName === "endDateTime" ||
//     fieldName === "dueDate" ||
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
//           { startDateTime: { [Op.gte]: new Date(fromDate + " 00:00:00") } },
//           { startDateTime: { [Op.lte]: new Date(toDate + " 23:59:59") } },
//         ],
//       };
//     } else if (operator === "notBetween" || operator === "≠" || operator === "is not") {
//       // Exclude records within the date range (records NOT between the dates)
//       return {
//         [Op.or]: [
//           { startDateTime: { [Op.lt]: new Date(fromDate + " 00:00:00") } },
//           { startDateTime: { [Op.gt]: new Date(toDate + " 23:59:59") } },
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
//       case "ActivityDeal":
//         modelConfig = {
//           model: Deal,
//           as: "ActivityDeal",
//           required: false,
//           attributes: [],
//         };
//         break;
//       case "ActivityLead":
//         modelConfig = {
//           model: Lead,
//           as: "ActivityLead",
//           required: false,
//           attributes: [],
//         };
//         break;
//       case "ActivityOrganization":
//         modelConfig = {
//           model: Organization,
//           as: "ActivityOrganization",
//           required: false,
//           attributes: [],
//         };
//         break;
//       case "ActivityPerson":
//         modelConfig = {
//           model: Person,
//           as: "ActivityPerson",
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
  let tableAlias = "Activity";
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
      case "ActivityDeal":
      case "ActivityLead":
      case "ActivityOrganization":
      case "ActivityPerson":
        dateField = "createdAt";
        break;
      default:
        dateField = "startDateTime";
    }

    // For related tables, use the proper Sequelize syntax
    if (tableAlias !== "Activity") {
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
    case "ActivityDeal":
      modelConfig = {
        model: Deal,
        as: "ActivityDeal",
        required: false,
        attributes: [],
      };
      break;
    case "ActivityLead":
      modelConfig = {
        model: Lead,
        as: "ActivityLead",
        required: false,
        attributes: [],
      };
      break;
    case "ActivityOrganization":
      modelConfig = {
        model: Organization,
        as: "ActivityOrganization",
        required: false,
        attributes: [],
      };
      break;
    case "ActivityPerson":
      modelConfig = {
        model: Person,
        as: "ActivityPerson",
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

async function generateExistingActivityPerformanceDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingSegmentedBy,
  existingfilters
) {
  let includeModels = [];
  const baseWhere = {};

  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  // --- Filter handling code ---
  if (existingfilters && existingfilters.conditions) {
    const validConditions = existingfilters.conditions.filter(
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

  // --- Attribute and GroupBy setup ---
  if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else {
    groupBy.push(`Activity.${existingxaxis}`);
    attributes.push([Sequelize.col(`Activity.${existingxaxis}`), "xValue"]);
  }

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
      groupBy.push(`Activity.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Activity.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  if (existingyaxis === "no of activities") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("activityId")),
      "yValue",
    ]);
  } else if (existingyaxis === "duration") {
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
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Activity.${existingyaxis}`)),
      "yValue",
    ]);
  }

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Get all groups without pagination
    const allGroups = await Activity.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        existingyaxis === "no of activities"
          ? [Sequelize.fn("COUNT", Sequelize.col("activityId")), "DESC"]
          : existingyaxis === "duration"
          ? [
              Sequelize.fn(
                "AVG",
                Sequelize.fn(
                  "TIMESTAMPDIFF",
                  Sequelize.literal("HOUR"),
                  Sequelize.col("startDateTime"),
                  Sequelize.col("endDateTime")
                )
              ),
              "DESC",
            ]
          : [
              Sequelize.fn("SUM", Sequelize.col(`Activity.${existingyaxis}`)),
              "DESC",
            ],
      ],
      raw: true,
    });

    const groupKeys = allGroups.map((g) => g.groupKey);

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

      results = await Activity.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    // Simple query without segmentation
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // --- FORMATTING AND TOTALING LOGIC ---
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
    // Logic for non-segmented data
    formattedResults = results.map((item) => ({
      label: item.xValue || "Unknown",
      value: Number(item.yValue) || 0,
    }));

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  // Return final response with totals
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

// Helper function to generate activity performance data without pagination
async function generateActivityPerformanceDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  segmentedBy,
  filters
) {
  let includeModels = [];
  const baseWhere = {};

  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

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

  if (xaxis === "Owner" || xaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else {
    groupBy.push(`Activity.${xaxis}`);
    attributes.push([Sequelize.col(`Activity.${xaxis}`), "xValue"]);
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
      groupBy.push(`Activity.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`Activity.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  if (yaxis === "no of activities") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("activityId")),
      "yValue",
    ]);
  } else if (yaxis === "duration") {
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
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Activity.${yaxis}`)),
      "yValue",
    ]);
  }

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    // Get all groups without pagination
    const allGroups = await Activity.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        yaxis === "no of activities"
          ? [Sequelize.fn("COUNT", Sequelize.col("activityId")), "DESC"]
          : yaxis === "duration"
          ? [
              Sequelize.fn(
                "AVG",
                Sequelize.fn(
                  "TIMESTAMPDIFF",
                  Sequelize.literal("HOUR"),
                  Sequelize.col("startDateTime"),
                  Sequelize.col("endDateTime")
                )
              ),
              "DESC",
            ]
          : [Sequelize.fn("SUM", Sequelize.col(`Activity.${yaxis}`)), "DESC"],
      ],
      raw: true,
    });

    const groupKeys = allGroups.map((g) => g.groupKey);

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

      results = await Activity.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    // Simple query without segmentation
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

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

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

exports.saveActivityReport = async (req, res) => {
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
    let totalValue = null;
    let reportConfig = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
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
          // You need to implement these functions
          const result = await generateActivityPerformanceDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
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
            filters: filters || {},
            reportData,
            totalValue,
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

      if (existingentity === "Activity" && existingtype === "Performance") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Activity Performance reports",
          });
        }

        try {
          // You need to implement this function
          const result = await generateExistingActivityPerformanceDataForSave(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
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
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
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

    // UPDATE
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

    // CREATE - Single record with comma-separated dashboardIds
    const dashboardIdsArray = Array.isArray(dashboardIds)
      ? dashboardIds
      : [dashboardIds];

    // Validate that all dashboardIds belong to the owner
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

    // Get the last report position (you might want to adjust this logic)
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

    // Create single report with comma-separated dashboardIds
    const newReport = await Report.create({
      dashboardIds: dashboardIdsArray.join(","), // Store as comma-separated string
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
      message: "Report created successfully",
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
        { subject: { [Op.like]: `%${search}%` } },
        { type: { [Op.like]: `%${search}%` } },
        { priority: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { "$assignedUser.name$": { [Op.like]: `%${search}%` } },
      ];
    }

    // Initialize include array for main query
    const include = [
      {
        model: MasterUser,
        as: "assignedUser",
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
        "location",
        "status",
        "description",
        "notes",
        "isDone",
        "contactPerson",
        "email",
        "organization",
        "dueDate",
        "startDateTime",
        "endDateTime",
        "createdAt",
        "updatedAt",
      ],
    });

    // Generate report data
    let reportData = [];
    let summary = {};

    // For report generation, we need separate include handling
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
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateExistingActivityPerformanceData(
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
    const formattedActivities = activities.map((activity) => ({
      id: activity.activityId,
      subject: activity.subject,
      type: activity.type,
      priority: activity.priority,
      status: activity.status,
      startDateTime: activity.startDateTime,
      endDateTime: activity.endDateTime,
      createdAt: activity.createdAt,
      location: activity.location,
      description: activity.description,
      notes: activity.notes,
      isDone: activity.isDone == true ? "Yes" : "No",
      contactPerson: activity.contactPerson,
      email: activity.email,
      organization: activity.organization,
      dueDate: activity.dueDate,
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
// exports.getActivityReportSummary = async (req, res) => {
//   try {
//     const {
//       reportId,
//       entity,
//       type,
//       xaxis,
//       yaxis,
//       segmentedBy = "none",
//       filters,
//       page = 1,
//       limit = 200,
//       search = "",
//       sortBy = "createdAt",
//       sortOrder = "DESC",
//     } = req.body;

//     const ownerId = req.adminId;
//     const role = req.role;

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
//         { subject: { [Op.like]: `%${search}%` } },
//         { type: { [Op.like]: `%${search}%` } },
//         { priority: { [Op.like]: `%${search}%` } },
//         { status: { [Op.like]: `%${search}%` } },
//         { "$assignedUser.name$": { [Op.like]: `%${search}%` } },
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
//     const totalCount = await Activity.count({
//       where: baseWhere,
//       include: include,
//     });

//     // Get paginated results
//     const activities = await Activity.findAll({
//       where: baseWhere,
//       include: include,
//       order: order,
//       limit: parseInt(limit),
//       offset: offset,
//       attributes: [
//         "activityId",
//         "subject",
//         "type",
//         "priority",
//         "location",
//         "status",
//         "description",
//         "notes",
//         "isDone",
//         "contactPerson",
//         "email",
//         "organization",
//         "dueDate",
//         "startDateTime",
//         "endDateTime",
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
//         segmentedBy,
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
//         segmentedBy: existingSegmentedBy,
//         filters: existingfilters,
//       } = config;

//       const reportResult = await generateExistingActivityPerformanceData(
//         ownerId,
//         role,
//         existingxaxis,
//         existingyaxis,
//         existingSegmentedBy,
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
//     const formattedActivities = activities.map((activity) => ({
//       id: activity.activityId,
//       subject: activity.subject,
//       type: activity.type,
//       priority: activity.priority,
//       status: activity.status,
//       startDateTime: activity.startDateTime,
//       endDateTime: activity.endDateTime,
//       createdAt: activity.createdAt,
//       location: activity.location,
//       description: activity.description,
//       notes: activity.notes,
//       isDone: activity.isDone == true ? "Yes" : "No",
//       contactPerson: activity.contactPerson,
//       email: activity.email,
//       organization: activity.organization,
//       dueDate: activity.dueDate,
//       assignedTo: activity.assignedUser
//         ? {
//             id: activity.assignedUser.masterUserID,
//             name: activity.assignedUser.name,
//             email: activity.assignedUser.email,
//           }
//         : null,
//     }));

//     const totalPages = Math.ceil(totalCount / limit);

//     res.status(200).json({
//       success: true,
//       message: "Activities data retrieved successfully",
//       data: {
//         activities: formattedActivities,
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
//     console.error("Error retrieving activities data:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve activities data",
//       error: error.message,
//     });
//   }
// };
