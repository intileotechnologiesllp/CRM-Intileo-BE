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
const {
  getLeadConditionObject,
} = require("../../../utils/conditionObject/lead");
const {
  getActivityConditionObject,
} = require("../../../utils/conditionObject/activity");
const {
  getDealConditionObject,
} = require("../../../utils/conditionObject/deal");
const {
  getPersonConditionObject,
} = require("../../../utils/conditionObject/createPerson");
const LeadPerson = require("../../../models/leads/leadPersonModel");
const { Goal, Dashboard } = require("../../../models");
const { groupActivitiesWithStats } = require("../../../utils/conditionObject/dateGrouping");

exports.createActivityReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      durationUnit = null,
      filters,
      segmentedBy = "none",
      page = 1,
      limit = 8,
    } = req.body;
    const ownerId = req.adminId;
    const role = req.role;

    // Define available options for xaxis and yaxis
    const xaxisArray = [
      { label: "Subject", value: "subject", type: "Activity" },
      { label: "Priority", value: "priority", type: "Activity" },
      { label: "Status", value: "status", type: "Activity" },
      { label: "Location", value: "location", type: "Activity" },
      { label: "Contact Person", value: "contactPerson", type: "Activity" },
      { label: "Organization", value: "organization", type: "Activity" },
      { label: "Type", value: "type", type: "Activity" },
      { label: "Owner", value: "Owner", type: "Activity" },
      { label: "Start Date", value: "startDateTime", type: "Date" },
      { label: "End Date", value: "endDateTime", type: "Date" },
      { label: "Due Date", value: "dueDate", type: "Date" },
      { label: "Add On", value: "createdAt", type: "Date" },
      { label: "Marked as Done Time", value: "markedAsDoneTime", type: "Date" },
    ];

    const segmentedByOptions = [
      { label: "None", value: "none" },
      { label: "Subject", value: "subject" },
      { label: "Priority", value: "priority" },
      { label: "Status", value: "status" },
      { label: "Location", value: "location" },
      { label: "Contact Person", value: "contactPerson" },
      { label: "Organization", value: "organization" },
      { label: "Type", value: "type" },
      { label: "Owner", value: "Owner" },
    ];

    const yaxisArray = [
      {
        label: "No of Activities",
        value: "no of activities",
        type: "Activity",
      },
      { label: "Duration", value: "duration", type: "Activity" },
    ];

    // Available filter columns
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

    // Initialize variables
    let reportData = null;
    let paginationInfo = null;
    let totalValue = 0;
    let summary = null;
    let reportConfig = null;

    // Handle new report creation
    if ((entity && type && !reportId)) {
      if (entity === "Activity" && type === "Performance") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Activity Performance reports",
          });
        }

        // Generate data with pagination
        const result = await generateActivityPerformanceData(
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
        
        // Calculate summary if data exists
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
      }
    } 

    // Handle existing report without updates
    else if ((entity && type && reportId) || (!entity && !type && reportId)) {
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
        entity: existingEntity,
        type: existingType,
        config: configString,
        graphtype: existingGraphType,
        colors: existingColors,
      } = existingReports.dataValues;

      const colors = JSON.parse(existingColors);
      const config = JSON.parse(configString);
      
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        durationUnit: existingDurationUnit,
        segmentedBy: existingSegmentedBy,
        filters: existingFilters,
      } = config;

        // Generate data with pagination using existing parameters
        const result = await generateExistingActivityPerformanceData(
          ownerId,
          role,
          existingxaxis,
          existingyaxis,
          existingDurationUnit,
          existingSegmentedBy,
          existingFilters,
          page,
          limit
        );
        
        reportData = result.data;
        paginationInfo = result.pagination;
        totalValue = result.totalValue;
        
        reportConfig = {
          reportId,
          entity: existingEntity,
          type: existingType,
          xaxis: existingxaxis,
          yaxis: existingyaxis,
          durationUnit: existingDurationUnit,
          segmentedBy: existingSegmentedBy,
          filters: existingFilters || {},
          graphtype: existingGraphType,
          colors: colors,
          reportData,
        };
        
        // Calculate summary if data exists
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

async function generateActivityPerformanceData(
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
  const offset = (page - 1) * limit;
  const baseWhere = {};

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
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

  // Filter handling
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

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([Sequelize.col("Activity.masterUserID"), "assignedUserId"]);
  } else if (xaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else if (xaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "ActivityOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.leadOrganizationId");
    attributes.push([
      Sequelize.col("Activity.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([
      Sequelize.col("ActivityOrganization.organization"),
      "xValue",
    ]);
  } else {
    groupBy.push(`Activity.${xaxis}`);
    attributes.push([Sequelize.col(`Activity.${xaxis}`), "xValue"]);
  }

  // Handle segmentedBy with durationUnit consideration
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
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "ActivityPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.personId");
      attributes.push([
        Sequelize.col("ActivityPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "ActivityOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.leadOrganizationId");
      attributes.push([
        Sequelize.col("ActivityOrganization.organization"),
        "segmentValue",
      ]);
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
      groupBy.push(`Activity.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`Activity.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Y-axis calculation
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

  // Total count calculation
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Activity.findAll({
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
    } else if (xaxis === "contactPerson") {
      countColumn = Sequelize.col("Activity.personId");
    } else if (xaxis === "organization") {
      countColumn = Sequelize.col("Activity.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Activity.${xaxis}`);
    }

    totalCountResult = await Activity.findAll({
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
      } else if (xaxis === "contactPerson") {
        groupColumn = Sequelize.col("Activity.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Activity.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Activity.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Activity.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${xaxis}`), "ASC"]]
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
        // For regular Activity columns
        groupCondition = { [xaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await Activity.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        // Only apply value-based sorting for non-date fields
        order: isDateFieldX
          ? [[Sequelize.col(`Activity.${xaxis}`), "ASC"]]
          : [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    // Non-segmented query
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      // Only apply value-based sorting for non-date fields
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${xaxis}`), "ASC"]]
        : [[Sequelize.literal("yValue"), "DESC"]],
      limit: limit,
      offset: offset,
    });
  }

  // Format results with durationUnit consideration - FIXED to include IDs
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
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
      formattedResults.sort(
        (a, b) => b.totalSegmentValue - a.totalSegmentValue
      );
    }

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
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

    // Calculate the grand total
    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

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

// Helper function for existing activity performance data
async function generateExistingActivityPerformanceData(
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
  const offset = (page - 1) * limit;
  const baseWhere = {};

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
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

  // Filter handling code
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
    attributes.push([Sequelize.col("Activity.masterUserID"), "assignedUserId"]);
  } else if (existingxaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else if (existingxaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "ActivityOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.leadOrganizationId");
    attributes.push([
      Sequelize.col("Activity.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([
      Sequelize.col("ActivityOrganization.organization"),
      "xValue",
    ]);
  } else {
    groupBy.push(`Activity.${existingxaxis}`);
    attributes.push([Sequelize.col(`Activity.${existingxaxis}`), "xValue"]);
  }

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
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "ActivityPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.personId");
      attributes.push([
        Sequelize.col("ActivityPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "ActivityOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.leadOrganizationId");
      attributes.push([
        Sequelize.col("ActivityOrganization.organization"),
        "segmentValue",
      ]);
    } else if (
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
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

  // Pagination and Query logic
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Activity.findAll({
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
    } else if (existingxaxis === "contactPerson") {
      countColumn = Sequelize.col("Activity.personId");
    } else if (existingxaxis === "organization") {
      countColumn = Sequelize.col("Activity.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Activity.${existingxaxis}`);
    }

    totalCountResult = await Activity.findAll({
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
      } else if (existingxaxis === "contactPerson") {
        groupColumn = Sequelize.col("Activity.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("Activity.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Activity.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Activity.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${existingxaxis}`), "ASC"]]
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
      } else if (existingxaxis === "contactPerson") {
        groupCondition = { personId: { [Op.in]: groupKeys } };
      } else if (existingxaxis === "organization") {
        groupCondition = { leadOrganizationId: { [Op.in]: groupKeys } };
      } else {
        groupCondition = { [existingxaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await Activity.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        // Only apply value-based sorting for non-date fields
        order: isDateFieldX
          ? [[Sequelize.col(`Activity.${existingxaxis}`), "ASC"]]
          : [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      // Only apply value-based sorting for non-date fields
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${existingxaxis}`), "ASC"]]
        : [[Sequelize.literal("yValue"), "DESC"]],
      limit: limit,
      offset: offset,
    });
  }

  // Formatting and totaling logic with durationUnit support - FIXED to include IDs
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
      formattedResults.sort(
        (a, b) => b.totalSegmentValue - a.totalSegmentValue
      );
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

// Helper function to check if xaxis is a date field
function isDateField(xaxis) {
  const dateFields = [
    "startDateTime",
    "endDateTime",
    "createdAt",
    "dueDate",
    "markedAsDoneTime",
  ];
  return dateFields.includes(xaxis);
}

// Helper function to get date group expression based on durationUnit
function getDateGroupExpression(dateField, durationUnit) {
  const field = `Activity.${dateField}`;

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
    return [[Sequelize.col(`Activity.${xaxis}`), "ASC"]];
  }

  if (yaxis === "no of activities") {
    return [[Sequelize.fn("COUNT", Sequelize.col("activityId")), "DESC"]];
  } else if (yaxis === "duration") {
    return [
      [
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
      ],
    ];
  } else {
    return [[Sequelize.fn("SUM", Sequelize.col(`Activity.${yaxis}`)), "DESC"]];
  }
}

// Existing helper functions (keep your existing implementations)
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
    fieldName === "dueDate" ||
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
      moduleId,
      isDate,
      dateType,
      weekName
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
      moduleId,
      isDate
    );

    let dateData = null
    if(isDate){
      const resp = groupActivitiesWithStats(result?.data, dateType);
      const filterDate = resp.filter((idx)=>{
        return idx.period == weekName
      })
      dateData = filterDate[0]?.activities || []
    }

    return res.status(200).json({
      success: true,
      message: "Data generated successfully",
      data: dateData ? dateData : result?.data,
      // week: dateData,
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

async function generateActivityPerformanceDataForDrillDown(
  ownerId,
  role,
  filters,
  name,
  value,
  id,
  entity,
  isDate
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
    4: getPersonConditionObject,
  };
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
    4: Organization,
    5: Deal,
    6: Lead,
    7: Goal,
  };

  const tableName = entityData[entity];
  const columnNames = Object.keys(tableName.rawAttributes);
  attributes = [...attributes, ...columnNames];

  let results;

  let addIncludeModel = includeModels;
  if (entity != 4 && entity != 3) {
    if (entity == 1 || entity == 6) {
      addIncludeModel = [
        ...includeModels,
        {
          model: MasterUser,
          as: "Owner", // For masterUserID
          attributes: ["masterUserID", "name"],
        },
      ];
    } else if (entity == 2 || entity == 5) {
      addIncludeModel = [
        ...includeModels,
        {
          model: MasterUser,
          as: "Owner", // For masterUserID
          attributes: ["masterUserID", "name"],
        },
      ];
    } else if (entity == 7) {
      addIncludeModel = [
        ...includeModels,
        {
          model: Dashboard,
          as: "Dashboard", // For masterUserID
          attributes: ["dashboard", "name", "folder", "type"],
        },
      ];
    } else {
      addIncludeModel = [
        ...includeModels,
        {
          model: MasterUser,
          as: "assignedUser", // For masterUserID
          attributes: ["masterUserID", "name"],
        },
        {
          model: MasterUser,
          as: "assignee", // For assignedTo
          attributes: ["masterUserID", "name"],
        },
      ];
    }
  } else {
    if (entity == 4) {
      addIncludeModel = [
        ...includeModels,
        {
          model: MasterUser,
          as: "MasterUser",
          required: false, // LEFT JOIN
        },
      ];
    }
  }

  results = await tableName.findAll({
    where: baseWhere,
    attributes: attributes,
    include: [...addIncludeModel],
    groupBy: groupBy,
  });

  // console.log(results)
  // Recursive flatten function
  function flattenObject(obj, parentKey = "", res = {}) {
    for (let key in obj) {
      const newKey = parentKey ? `${parentKey}_${key}` : key;

      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        flattenObject(obj[key], newKey, res);
      } else {
        res[newKey] = obj[key];
      }
    }
    return res;
  }

  const flattened = JSON.parse(JSON.stringify(results, null, 2)).map((item) =>
    flattenObject(item)
  );

 const formattedResults = flattened.filter((item) => {
  if (isDate) {
    return item;
  }

  if (name === "Owner") {
    return item["assignedUser_name"]?.toLowerCase() == value?.toLowerCase();
  }
  
  // Handle contactPerson - compare with personId
  if (name === "contactPerson") {
    return item.personId === id; // Compare personId with the provided id
  }
  
  // Handle organization - compare with leadOrganizationId
  if (name === "organization") {
    if (entity != 4) {
      return item.leadOrganizationId === id; // Compare leadOrganizationId with the provided id
    }
    // If entity is 4, use the string comparison below
  }

  // Handle string fields safely
  if (typeof item[name] === "string" && typeof value === "string") {
    if (item[name].toLowerCase() !== value.toLowerCase()) return false;
  } else {
    if (item[name] !== value) return false;
  }

  return true;
});

  let dealConvertion = formattedResults;
  if (entity == 5 || entity == 6) {
    let convertion = [];
    for (let i = 0; i < formattedResults?.length; i++) {
      if (
        formattedResults[i].status == "won" ||
        formattedResults[i]?.status == "lost"
      ) {
        convertion.push(formattedResults[i]);
      }
    }

    dealConvertion = convertion;
  }

  return {
    // format: flattened,
    data: dealConvertion,
    totalValue: formattedResults?.length,
  };
}

async function generateExistingActivityPerformanceDataForSave(
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

  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

   let xaxisNullExcludeCondition = {};

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration = isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  if (shouldGroupByDuration) {
    // For date fields with duration grouping
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null };
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);


  // Filter handling code
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
    attributes.push([Sequelize.col("Activity.masterUserID"), "assignedUserId"]);
  } else if (existingxaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else if (existingxaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "ActivityOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.leadOrganizationId");
    attributes.push([
      Sequelize.col("Activity.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([
      Sequelize.col("ActivityOrganization.organization"),
      "xValue",
    ]);
  } else {
    groupBy.push(`Activity.${existingxaxis}`);
    attributes.push([Sequelize.col(`Activity.${existingxaxis}`), "xValue"]);
  }

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
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "ActivityPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.personId");
      attributes.push([
        Sequelize.col("ActivityPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "ActivityOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.leadOrganizationId");
      attributes.push([
        Sequelize.col("ActivityOrganization.organization"),
        "segmentValue",
      ]);
    } else if (
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
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
    // For segmented queries - get all results without pagination
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      // Only apply value-based sorting for non-date fields
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${existingxaxis}`), "ASC"]]
        : [[Sequelize.literal("yValue"), "DESC"]],
    });
  } else {
    // Get all results without pagination
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      // Only apply value-based sorting for non-date fields
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${existingxaxis}`), "ASC"]]
        : [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // Formatting and totaling logic with durationUnit support - FIXED to include IDs
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
      formattedResults.sort(
        (a, b) => b.totalSegmentValue - a.totalSegmentValue
      );
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
  durationUnit,
  segmentedBy,
  filters
) {
  let includeModels = [];
  const baseWhere = {};

  if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

   let xaxisNullExcludeCondition = {};

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(xaxis);
  const shouldGroupByDuration = isDateFieldX && durationUnit && durationUnit !== "none";

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
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

  // Filter handling
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


  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.name");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([Sequelize.col("Activity.masterUserID"), "assignedUserId"]);
  } else if (xaxis === "Team") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: [],
    });
    groupBy.push("assignedUser.team");
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else if (xaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "ActivityOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.leadOrganizationId");
    attributes.push([
      Sequelize.col("Activity.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([
      Sequelize.col("ActivityOrganization.organization"),
      "xValue",
    ]);
  } else {
    groupBy.push(`Activity.${xaxis}`);
    attributes.push([Sequelize.col(`Activity.${xaxis}`), "xValue"]);
  }

  // Handle segmentedBy with durationUnit consideration
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
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "ActivityPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.personId");
      attributes.push([
        Sequelize.col("ActivityPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "ActivityOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Activity.leadOrganizationId");
      attributes.push([
        Sequelize.col("ActivityOrganization.organization"),
        "segmentValue",
      ]);
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
      groupBy.push(`Activity.${segmentedBy}`);
      attributes.push([
        Sequelize.col(`Activity.${segmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Y-axis calculation
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
    // For segmented queries, get all results without pagination
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      // Only apply value-based sorting for non-date fields
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${xaxis}`), "ASC"]]
        : [[Sequelize.literal("yValue"), "DESC"]],
    });
  } else {
    // Non-segmented query - get all results without pagination
    results = await Activity.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      // Only apply value-based sorting for non-date fields
      order: isDateFieldX
        ? [[Sequelize.col(`Activity.${xaxis}`), "ASC"]]
        : [[Sequelize.literal("yValue"), "DESC"]],
    });
  }

  // Format results with durationUnit consideration - FIXED to include IDs
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
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
      formattedResults.sort(
        (a, b) => b.totalSegmentValue - a.totalSegmentValue
      );
    }

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
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
      durationUnit,
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
        durationUnit: existingDurationUnit,
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
      durationUnit,
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
        durationUnit,
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
        durationUnit: existingDurationUnit,
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      const reportResult = await generateExistingActivityPerformanceData(
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
