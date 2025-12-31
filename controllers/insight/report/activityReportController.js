const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Deal = require("../../../models/deals/dealsModels");
const Lead = require("../../../models/leads/leadsModel");
const Organization = require("../../../models/leads/leadOrganizationModel");
const Person = require("../../../models/leads/leadPersonModel");
const MasterUser = require("../../../models/master/masterUserModel");
const Activity = require("../../../models/activity/activityModel");
const ReportFolder = require("../../../models/insight/reportFolderModel");
const Email = require("../../../models/email/emailModel")
const { Op, Sequelize } = require("sequelize");
const { Pipeline } = require("../../../models");
const { PipelineStage } = require("../../../models");
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
  const { Report, MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization } = req.models;
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
      { label: "Add On", value: "startDateTime", type: "Date" },
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
          limit,
          MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
          limit,
          MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
  limit = 8,
  MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    // For Owner/assignedTo, exclude where assignedUser is null
    xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "Team") {
    // For Team, exclude where assignedUser.team is null
    xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null,  [Op.ne]: "" };
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
          filterIncludeModels,
          Lead, Deal, LeadOrganization, LeadPerson
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
      model: LeadPerson,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    includeModels.push({
      model: LeadOrganization,
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
        model: LeadPerson,
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
        model: LeadOrganization,
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
      // Merge segments with the same labeltype
      if (!groupedData[xValue].segments[segmentValue]) {
        groupedData[xValue].segments[segmentValue] = 0;
      }
      groupedData[xValue].segments[segmentValue] += yValue;
    });

    // Convert segments object to array
    formattedResults = Object.values(groupedData).map((group) => {
      const segmentsArray = Object.entries(group.segments).map(
        ([labeltype, value]) => ({
          labeltype,
          value,
        })
      );

      return {
        ...group,
        segments: segmentsArray,
        totalSegmentValue: segmentsArray.reduce(
          (sum, seg) => sum + seg.value,
          0
        ),
      };
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
  limit = 8,
  MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null,  [Op.ne]: "" };
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
          filterIncludeModels,
          Lead, Deal, LeadOrganization, LeadPerson
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
      model: LeadPerson,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    includeModels.push({
      model: LeadOrganization,
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
        model: LeadPerson,
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
        model: LeadOrganization,
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
      // Merge segments with the same labeltype
      if (!groupedData[xValue].segments[segmentValue]) {
        groupedData[xValue].segments[segmentValue] = 0;
      }
      groupedData[xValue].segments[segmentValue] += yValue;
    });

    // Convert segments object to array
    formattedResults = Object.values(groupedData).map((group) => {
      const segmentsArray = Object.entries(group.segments).map(
        ([labeltype, value]) => ({
          labeltype,
          value,
        })
      );

      return {
        ...group,
        segments: segmentsArray,
        totalSegmentValue: segmentsArray.reduce(
          (sum, seg) => sum + seg.value,
          0
        ),
      };
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
      return Sequelize.literal(`
        CONCAT(
          ELT(MONTH(${field}), 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'),
          ' ',
          YEAR(${field})
        )
     `);


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

  // For monthly, you might want to ensure proper capitalization
  // The SQL DATE_FORMAT with %b returns abbreviated month names like "Jan", "Feb", etc.
  // You can add additional formatting here if needed
  if (durationUnit.toLowerCase() === "monthly" && value) {
    // If you want to ensure proper formatting, you can parse and reformat
    // But typically the SQL function already returns "Jan 2025" format
    return value;
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
function getConditionObject(column, operator, value, includeModels = [], Lead, Deal, LeadOrganization, LeadPerson) {
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
      addIncludeModel(tableAlias, includeModels, Lead, Deal, LeadOrganization, LeadPerson);

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
function addIncludeModel(tableAlias, includeModels, Lead, Deal, LeadOrganization, LeadPerson) {
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
        model: LeadOrganization,
        as: "ActivityOrganization",
        required: false,
        attributes: [],
      };
      break;
    case "ActivityPerson":
      modelConfig = {
        model: LeadPerson,
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
  const { Report, MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization, PipelineStage, Email } = req.models;
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
      weekName,
      pipelineId,
      pipelineStage
    } = req.body;
    const ownerId = req.adminId;
    const role = req.role;
    const {masterUserId, startDate, endDate} = req.query;
   

      if ((startDate && endDate) ) {
        let startDateCondition = {};
        let endDateCondition = {};
        if(startDate){
          startDateCondition = {
              "column": "startDateTime",
              "operator": "is",
              "value": startDate
          }
        }
        if(endDate){
          endDateCondition = {
              "column": "startDateTime",
              "operator": "is",
              "value": endDate
          }
        }
        filters = config.filters ? {...config.filters,
              condition: [
               startDateCondition,
               endDateCondition
              ]
            } : {
              condition: [
                startDateCondition,
                endDateCondition
              ]
            }
      }
    // ==================================================================================
    // NEW: Handle Deal Progress Drilldown (moduleId === 2) with stage breakdown
    // ==================================================================================

    // for Deal Progress use moduleId 8
    if (moduleId == 8 || parseInt(moduleId) === 8) {
      // console.log('🎯 [createActivityReportDrillDown] Routing to Deal Progress Drilldown');
      
      const dealResult = await generateDealProgressDrillDownForActivity(
        ownerId,
        role,
        filters,
        fieldName,
        fieldValue,
        id,
        pipelineId,
        pipelineStage,
        page,
        limit,
        masterUserId,
        Activity,  LeadPerson, Deal, Lead, LeadOrganization , MasterUser, Dashboard, PipelineStage, Email
      );

      return res.status(200).json({
        success: true,
        message: "Data generated successfully",
        data: dealResult.data,
        breakdown: dealResult.breakdown,
        summary: dealResult.summary,
        pagination: dealResult.pagination,
      });
    }

    // ==================================================================================
    // NEW: Handle Email Drilldown (moduleId === 8) with folder/user breakdown
    // ==================================================================================
// for Email Performance use moduleId 9

    if (moduleId == 9 || parseInt(moduleId) === 9) {
      // console.log('📧 [createActivityReportDrillDown] Routing to Email Drilldown');
      
      const emailResult = await generateEmailDrillDownForActivity(
        ownerId,
        role,
        filters,
        fieldName,
        fieldValue,
        id,
        page,
        limit,
        masterUserId,
        Activity, LeadPerson, Deal, Lead, LeadOrganization, MasterUser, Dashboard, PipelineStage, Email
      );

      return res.status(200).json({
        success: true,
        message: "Email data generated successfully",
        data: emailResult.data,
        breakdown: emailResult.breakdown,
        summary: emailResult.summary,
        pagination: emailResult.pagination,
      });
    }

    // ==================================================================================
    // EXISTING: Handle all other module types (Activity, Lead, Person, etc.)
    // ==================================================================================
    const result = await generateActivityPerformanceDataForDrillDown(
      ownerId,
      role,
      filters,
      fieldName,
      fieldValue,
      id,
      moduleId,
      isDate,
      masterUserId,
      Activity,  LeadPerson, Deal, Lead, LeadOrganization, MasterUser, Dashboard, PipelineStage, Email
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

exports.saveCoordinates = async (req, res) =>{
  const { Dashboard } = req.models;
   try {
    const {dashboardId, coordinates} = req.body;

    const [updated] = await Dashboard.update({coordinates:coordinates }, {
      where: { dashboardId }
    });

    if (updated === 0) {
      return { success: false, message: "No record found or nothing to update" };
    }

    const updatedRecord = await Dashboard.findByPk(dashboardId);

    res.status(200).json({
      success: true,
      message: "Updated successfully",
      data: updatedRecord
    });
  } catch (error) {
    console.error("Update error:", error);
    return { success: false, message: error.message };
  }
}

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
  isDate,
  masterUserId,
  Activity, LeadPerson, Deal, Lead, LeadOrganization, MasterUser, Dashboard, PipelineStage, Email
) {
  let includeModels = [];
  const baseWhere = {};

  if (masterUserId) {
    baseWhere.masterUserID = masterUserId;
  }else if (role !== "admin") {
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
    4: LeadOrganization,
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

// Helper function to generate deal progress drilldown data with stage breakdown for Activity Report API
async function generateDealProgressDrillDownForActivity(
  ownerId,
  role,
  filters,
  fieldName,
  fieldValue,
  id,
  pipelineId,
  pipelineStage,
  page = 1,
  limit = 50,
  masterUserId,
  Activity, LeadPerson, Deal, Lead, LeadOrganization, MasterUser, Dashboard, PipelineStage, Email

) {
  const baseWhere = {};

  // console.log('📊 [generateDealProgressDrillDownForActivity] Starting data generation');

  // Role-based filtering
  if (masterUserId) {
    baseWhere.masterUserID = masterUserId;
  }else if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  // Pipeline filtering
  if (pipelineId) {
    baseWhere.pipelineId = pipelineId;
  } else {
    baseWhere.pipelineId = { [Op.ne]: null };
  }

  // Ensure valid stage data
  baseWhere.stageId = { [Op.ne]: null };

  // Apply report filters if provided
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      const conditions = validConditions.map((cond) => {
        return getDealConditionObject(cond.column, cond.operator, cond.value, []);
      });

      let combinedCondition = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        const logicalOp = (filters.logicalOperators[i - 1] || "AND").toUpperCase();
        if (logicalOp === "AND") {
          combinedCondition = { [Op.and]: [combinedCondition, conditions[i]] };
        } else {
          combinedCondition = { [Op.or]: [combinedCondition, conditions[i]] };
        }
      }
      Object.assign(baseWhere, combinedCondition);
    }
  }

  // Apply field-specific filtering based on clicked dimension
  console.log('🎯 [generateDealProgressDrillDownForActivity] Applying field filter:', { fieldName, fieldValue, id });

  let includeModels = [];

  // Add PipelineStage join for stage names
  includeModels.push({
    model: PipelineStage,
    as: "stageData",
    attributes: ["stageName", "stageOrder"],
    required: true,
    where: {
      stageName: { [Op.ne]: null }
    }
  });

  // Apply field-specific WHERE conditions based on fieldName
  if (fieldName === "creator") {
    // Filter by creator (masterUserID)
    if (id) {
      baseWhere.masterUserID = id;
    } else if (fieldValue) {
      // Need to join with MasterUser to filter by name
      includeModels.push({
        model: MasterUser,
        as: "Owner",
        attributes: ["masterUserID", "name", "email"],
        required: true,
        where: {
          name: fieldValue
        }
      });
    }
  } else if (fieldName === "creatorstatus") {
    // Filter by creator status
    includeModels.push({
      model: MasterUser,
      as: "Owner",
      attributes: ["masterUserID", "name", "email", "creatorstatus"],
      required: true,
      where: {
        creatorstatus: fieldValue
      }
    });
  } else if (fieldName === "contactPerson") {
    // Filter by person ID
    if (id) {
      baseWhere.personId = id;
    }
    includeModels.push({
      model: LeadPerson,
      as: "Person",
      attributes: ["personId", "contactPerson", "email", "phone"],
      required: false
    });
  } else if (fieldName === "organization") {
    // Filter by organization ID
    if (id) {
      baseWhere.leadOrganizationId = id;
    }
    includeModels.push({
      model: LeadOrganization,
      as: "Organization",
      attributes: ["leadOrganizationId", "organization", "address"],
      required: false
    });
  } else if (fieldName === "pipelineStage") {
    // Filter by specific pipeline stage using stageData
    includeModels = includeModels.map(inc => {
      if (inc.as === "stageData") {
        return {
          ...inc,
          where: {
            stageName: fieldValue,
            stageName: { [Op.ne]: null }
          }
        };
      }
      return inc;
    });
  } else {
    // Regular Deal column filtering (serviceType, status, etc.)
    if (fieldValue) {
      baseWhere[fieldName] = fieldValue;
    }
  }

  // If specific pipeline stage is provided for breakdown drilldown
  if (pipelineStage) {
    console.log('🔍 [generateDealProgressDrillDownForActivity] Filtering by specific stage:', pipelineStage);
    includeModels = includeModels.map(inc => {
      if (inc.as === "stageData") {
        return {
          ...inc,
          where: {
            stageName: pipelineStage
          }
        };
      }
      return inc;
    });
  }

  // Add Owner include if not already added
  const hasOwnerInclude = includeModels.some(inc => inc.as === "Owner");
  if (!hasOwnerInclude) {
    includeModels.push({
      model: MasterUser,
      as: "Owner",
      attributes: ["masterUserID", "name", "email"],
      required: false
    });
  }

  // Add Pipeline include for pipeline name
  includeModels.push({
    model: Pipeline,
    as: "pipelineData",
    attributes: ["pipelineId", "pipelineName"],
    required: false
  });

  console.log('🔍 [generateDealProgressDrillDownForActivity] Final WHERE conditions:', JSON.stringify(baseWhere, null, 2));

  // ==================================================================================
  // STEP 1: Fetch ALL deals for accurate stage breakdown COUNT calculation
  // ==================================================================================
  // CRITICAL: Fetch ALL deals first to calculate accurate stage counts
  // This is similar to how createDealProgressReport calculates the breakdown
  const allDealsForBreakdown = await Deal.findAll({
    where: baseWhere,
    include: includeModels,
    order: [
      ["stageData", "stageOrder", "ASC"],
      ["createdAt", "DESC"]
    ]
    // NO LIMIT/OFFSET here - we need ALL deals for accurate COUNT calculation
  });

  console.log('📦 [generateDealProgressDrillDownForActivity] Total matching deals for breakdown:', allDealsForBreakdown.length);

  // ==================================================================================
  // STEP 2: Calculate pipeline stage breakdown with COUNT - LIKE createDealProgressReport
  // ==================================================================================
  // This creates the breakdown object: {"Proposal Made": 1, "Contact Made": 1}
  const stageBreakdown = {};
  let totalValue = 0;
  let totalProposalValue = 0;

  allDealsForBreakdown.forEach(deal => {
    const stageName = deal.stageData?.stageName || "Unknown";
    
    if (stageName !== "Unknown") {
      if (!stageBreakdown[stageName]) {
        stageBreakdown[stageName] = {
          count: 0,           // This is the COUNT(dealId) for this stage
          totalValue: 0,
          totalProposalValue: 0
        };
      }
      
      // Increment COUNT for this stage - KEY COUNT CALCULATION
      stageBreakdown[stageName].count += 1;
      stageBreakdown[stageName].totalValue += parseFloat(deal.value || 0);
      stageBreakdown[stageName].totalProposalValue += parseFloat(deal.proposalValue || 0);
      
      totalValue += parseFloat(deal.value || 0);
      totalProposalValue += parseFloat(deal.proposalValue || 0);
    }
  });

  console.log('📊 [generateDealProgressDrillDownForActivity] Stage breakdown calculated:', stageBreakdown);

  // ==================================================================================
  // STEP 3: Now paginate for display (if needed for specific stage drilldown)
  // ==================================================================================
  let paginatedDeals = allDealsForBreakdown;
  
  // If drilling into specific pipeline stage, filter to that stage only
  if (pipelineStage) {
    console.log('🔍 [generateDealProgressDrillDownForActivity] Filtering to specific stage:', pipelineStage);
    paginatedDeals = allDealsForBreakdown.filter(
      deal => deal.stageData?.stageName === pipelineStage
    );
  }

  // Apply pagination to display data
  const totalCount = paginatedDeals.length;
  const offset = (page - 1) * limit;
  const deals = paginatedDeals.slice(offset, offset + limit);

  console.log('📦 [generateDealProgressDrillDownForActivity] Paginated deals:', deals.length, 'of', totalCount);

  // Format deals for response
  const formattedDeals = deals.map(deal => ({
    dealId: deal.dealId,
    title: deal.title,
    value: deal.value,
    proposalValue: deal.proposalValue,
    currency: deal.currency,
    status: deal.status,
    pipeline: deal.pipelineData?.pipelineName || deal.pipeline,
    pipelineId: deal.pipelineId,
    pipelineStage: deal.stageData?.stageName || deal.pipelineStage,
    stageOrder: deal.stageData?.stageOrder || 0,
    stageId: deal.stageId,
    contactPerson: deal.contactPerson,
    organization: deal.organization,
    serviceType: deal.serviceType,
    sourceChannel: deal.sourceChannel,
    sourceOrigin: deal.sourceOrgin,
    expectedCloseDate: deal.expectedCloseDate,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    Owner: deal.Owner ? {
      id: deal.Owner.masterUserID,
      name: deal.Owner.name,
      email: deal.Owner.email
    } : null,
    Person: deal.Person ? {
      personId: deal.Person.personId,
      contactPerson: deal.Person.contactPerson,
      email: deal.Person.email,
      phone: deal.Person.phone
    } : null,
    Organization: deal.Organization ? {
      leadOrganizationId: deal.Organization.leadOrganizationId,
      organization: deal.Organization.organization,
      address: deal.Organization.address
    } : null
  }));

  // ==================================================================================
  // STEP 5: Format stage breakdown for response - LIKE createDealProgressReport output
  // ==================================================================================
  // This creates the breakdown array similar to the parent report
  // Example: [{"stage": "Proposal Made", "count": 1}, {"stage": "Contact Made", "count": 1}]
  const formattedBreakdown = Object.entries(stageBreakdown).map(([stageName, data]) => ({
    stage: stageName,
    count: data.count,              // COUNT(dealId) for this stage
    totalValue: parseFloat(data.totalValue.toFixed(2)),
    totalProposalValue: parseFloat(data.totalProposalValue.toFixed(2)),
    percentage: ((data.count / allDealsForBreakdown.length) * 100).toFixed(2)
  })).sort((a, b) => b.count - a.count);

  // ==================================================================================
  // STEP 6: Calculate summary statistics
  // ==================================================================================
  const summary = {
    totalDeals: allDealsForBreakdown.length,     // Total COUNT from ALL deals
    displayedDeals: deals.length,                 // Paginated count
    totalValue: parseFloat(totalValue.toFixed(2)),
    totalProposalValue: parseFloat(totalProposalValue.toFixed(2)),
    averageValue: allDealsForBreakdown.length > 0 
      ? parseFloat((totalValue / allDealsForBreakdown.length).toFixed(2)) 
      : 0,
    averageProposalValue: allDealsForBreakdown.length > 0 
      ? parseFloat((totalProposalValue / allDealsForBreakdown.length).toFixed(2)) 
      : 0,
    stagesCount: Object.keys(stageBreakdown).length,
    fieldName: fieldName,
    fieldValue: fieldValue,
    pipelineStage: pipelineStage || null
  };

  console.log('✅ [generateDealProgressDrillDownForActivity] Summary:', summary);
  console.log('✅ [generateDealProgressDrillDownForActivity] Breakdown:', formattedBreakdown);

  return {
    data: formattedDeals,
    breakdown: formattedBreakdown,
    summary: summary,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount,
      itemsPerPage: parseInt(limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    }
  };
}

// Helper function to generate email drilldown data for Activity Report API
async function generateEmailDrillDownForActivity(
  ownerId,
  role,
  filters,
  fieldName,
  fieldValue,
  id,
  page = 1,
  limit = 50,
  masterUserId,
  Activity, LeadPerson, Deal, Lead, LeadOrganization, MasterUser, Dashboard, PipelineStage, Email
) {
  const baseWhere = {};

  // console.log('📧 [generateEmailDrillDownForActivity] Starting email drilldown generation');
  // console.log('📧 Field:', { fieldName, fieldValue, id });

  // Role-based filtering
  if (masterUserId) {
    baseWhere.masterUserID = masterUserId;
  }else if (role !== "admin") {
    baseWhere.masterUserID = ownerId;
  }

  // Apply report filters if provided
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    if (validConditions.length > 0) {
      const conditions = validConditions.map((cond) => {
        return getEmailConditionObject(cond.column, cond.operator, cond.value);
      });

      let combinedCondition = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        const logicalOp = (filters.logicalOperators[i - 1] || "AND").toUpperCase();
        if (logicalOp === "AND") {
          combinedCondition = { [Op.and]: [combinedCondition, conditions[i]] };
        } else {
          combinedCondition = { [Op.or]: [combinedCondition, conditions[i]] };
        }
      }
      Object.assign(baseWhere, combinedCondition);
    }
  }

  // Apply field-specific filtering based on clicked dimension
  console.log('🎯 [generateEmailDrillDownForActivity] Applying field filter:', { fieldName, fieldValue, id });

  let includeModels = [];

  // Add MasterUser join for user names
  includeModels.push({
    model: MasterUser,
    as: "MasterUser",
    attributes: ["masterUserID", "name", "email"],
    required: false
  });

  // Folder mapping for friendly names
  const folderMap = {
    "Incoming Mails": "inbox",
    "Outgoing Mails": "sent",
    "Drafts": "drafts",
    "Outbox": "outbox",
    "Archive": "archive",
    "Trash": "trash",
    "inbox": "inbox",
    "sent": "sent",
    "drafts": "drafts",
    "outbox": "outbox",
    "archive": "archive",
    "trash": "trash"
  };

  // Apply field-specific WHERE conditions based on fieldName
  // IMPORTANT: Changed from if-else to independent if statements to support MULTIPLE filters
  
  // Filter by USER (masterUserID)
  if (fieldName === "masterUserID" || fieldName === "User") {
    if (id) {
      baseWhere.masterUserID = id;
    } else if (fieldValue) {
      // Need to join with MasterUser to filter by name
      includeModels = includeModels.map(inc => {
        if (inc.as === "MasterUser") {
          return {
            ...inc,
            required: true,
            where: {
              name: fieldValue
            }
          };
        }
        return inc;
      });
    }
  }

  // Filter by FOLDER (can work TOGETHER with user filter)
  // Check if fieldValue looks like a folder name (inbox, sent, etc.)
  if (fieldValue && folderMap[fieldValue.toLowerCase()]) {
    baseWhere.folder = folderMap[fieldValue.toLowerCase()];
    console.log('🗂️ [generateEmailDrillDownForActivity] Added folder filter:', baseWhere.folder);
  }
  // Also handle when fieldName explicitly specifies folder
  else if (fieldName === "folder" || fieldName === "Email Direction") {
    if (fieldValue) {
      baseWhere.folder = folderMap[fieldValue] || fieldValue;
    }
  }

  // Filter by SUBJECT
  if (fieldName === "subject" && fieldValue) {
    baseWhere.subject = fieldValue;
  }

  // Handle any other field names (generic fallback)
  if (fieldName && fieldValue && 
      fieldName !== "masterUserID" && 
      fieldName !== "User" && 
      fieldName !== "folder" && 
      fieldName !== "Email Direction" && 
      fieldName !== "subject" &&
      !folderMap[fieldValue.toLowerCase()]) {
    baseWhere[fieldName] = fieldValue;
  }

  console.log('🔍 [generateEmailDrillDownForActivity] Final WHERE conditions:', JSON.stringify(baseWhere, null, 2));

  // ==================================================================================
  // STEP 1: Get total COUNT using SQL aggregation (memory efficient)
  // ==================================================================================
  const totalCountResult = await Email.count({
    where: baseWhere,
    include: includeModels,
    distinct: true
  });

  const totalCount = parseInt(totalCountResult || 0);
  console.log('📦 [generateEmailDrillDownForActivity] Total matching emails:', totalCount);

  // ==================================================================================
  // STEP 2: Calculate breakdown by folder using SQL GROUP BY (memory efficient)
  // ==================================================================================
  const breakdownResults = await Email.findAll({
    where: baseWhere,
    include: includeModels.map(inc => ({ ...inc, attributes: [] })), // Don't fetch user data for breakdown
    attributes: [
      'folder',
      [Sequelize.fn('COUNT', Sequelize.col('emailID')), 'count']
    ],
    group: ['folder'],
    raw: true
  });

  const breakdown = {};
  breakdownResults.forEach(item => {
    const folder = item.folder || "Unknown";
    breakdown[folder] = {
      count: parseInt(item.count || 0)
    };
  });

  console.log('📊 [generateEmailDrillDownForActivity] Folder breakdown:', breakdown);

  // ==================================================================================
  // STEP 3: Fetch ONLY paginated emails (memory efficient)
  // ==================================================================================
  const offset = (page - 1) * limit;
  
  const paginatedEmails = await Email.findAll({
    where: baseWhere,
    include: includeModels,
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset: offset
  });

  console.log('📦 [generateEmailDrillDownForActivity] Paginated emails:', paginatedEmails.length, 'of', totalCount);

  // Format emails for response
  const formattedEmails = paginatedEmails.map(email => ({
    emailID: email.emailID,
    subject: email.subject,
    from: email.from,
    to: email.to,
    cc: email.cc,
    bcc: email.bcc,
    folder: email.folder,
    folderLabel: getFolderLabel(email.folder),
    // body: email.body ? email.body.substring(0, 200) + '...' : null, // Truncate body
    snippet: email.snippet,
    isRead: email.isRead,
    isFlagged: email.isFlagged,
    hasAttachments: email.hasAttachments,
    createdAt: email.createdAt,
    updatedAt: email.updatedAt,
    User: email.MasterUser ? {
      id: email.MasterUser.masterUserID,
      name: email.MasterUser.name,
      email: email.MasterUser.email
    } : null
  }));

  // ==================================================================================
  // STEP 4: Format folder breakdown for response
  // ==================================================================================
  const formattedBreakdown = Object.entries(breakdown).map(([folder, data]) => ({
    folder: getFolderLabel(folder),
    count: data.count,
    percentage: totalCount > 0 ? ((data.count / totalCount) * 100).toFixed(2) : "0.00"
  })).sort((a, b) => b.count - a.count);

  // ==================================================================================
  // STEP 5: Calculate summary statistics using SQL aggregation (memory efficient)
  // ==================================================================================
  // Get read/unread counts
  const readCountResult = await Email.count({
    where: { ...baseWhere, isRead: true },
    include: includeModels,
    distinct: true
  });

  const unreadCountResult = await Email.count({
    where: { ...baseWhere, isRead: false },
    include: includeModels,
    distinct: true
  });

  const flaggedCountResult = await Email.count({
    where: { ...baseWhere },
    include: includeModels,
    distinct: true
  });

  const attachmentsCountResult = await Email.count({
    where: { ...baseWhere},
    include: includeModels,
    distinct: true
  });

  const summary = {
    totalEmails: totalCount,
    displayedEmails: paginatedEmails.length,
    foldersCount: Object.keys(breakdown).length,
    fieldName: fieldName,
    fieldValue: fieldValue,
    readCount: parseInt(readCountResult || 0),
    unreadCount: parseInt(unreadCountResult || 0),
    flaggedCount: parseInt(flaggedCountResult || 0),
    withAttachmentsCount: parseInt(attachmentsCountResult || 0)
  };

  console.log('✅ [generateEmailDrillDownForActivity] Summary:', summary);
  console.log('✅ [generateEmailDrillDownForActivity] Breakdown:', formattedBreakdown);

  return {
    data: formattedEmails,
    breakdown: formattedBreakdown,
    summary: summary,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount,
      itemsPerPage: parseInt(limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    }
  };
}

// Helper function to convert folder codes to friendly labels
function getFolderLabel(folder) {
  const folderMap = {
    "inbox": "Incoming Mails",
    "sent": "Outgoing Mails",
    "drafts": "Drafts",
    "outbox": "Outbox",
    "archive": "Archive",
    "trash": "Trash"
  };
  return folderMap[folder] || folder;
}

async function generateExistingActivityPerformanceDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  existingfilters,
  MasterUser, Activity, LeadPerson, Deal, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null,  [Op.ne]: "" };
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
          filterIncludeModels,
          Lead, Deal, LeadPerson, LeadOrganization
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
      model: LeadPerson,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    includeModels.push({
      model: LeadOrganization,
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
        model: LeadPerson,
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
        model: LeadOrganization,
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

 // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group the results properly
    const groupedData = {};

    results.forEach((item) => {
      // Determine grouping key based on xaxis type
      let groupKey;

      if (existingxaxis === "contactPerson" && item.personId) {
        // Group by personId for contactPerson
        groupKey = `person_${item.personId}`;
      } else if (existingxaxis === "organization" && item.leadOrganizationId) {
        // Group by leadOrganizationId for organization
        groupKey = `org_${item.leadOrganizationId}`;
      } else if (
        (existingxaxis === "Owner" || existingxaxis === "assignedTo" || existingxaxis === "creator") &&
        item.assignedUserId
      ) {
        // Group by assignedUserId for Owner/assignedTo/creator
        groupKey = `user_${item.assignedUserId}`;
      } else if (existingxaxis === "Team" && item.teamId) {
        // Group by teamId for Team
        groupKey = `team_${item.teamId}`;
      } else {
        // For all other cases, group by the raw xValue
        groupKey = `label_${item.xValue || "Unknown"}`;
      }

      // Format display values
      const displayXValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[groupKey]) {
        // Set id based on xaxis type
        let id = null;
        if (existingxaxis === "contactPerson") {
          id = item.personId;
        } else if (existingxaxis === "organization") {
          id = item.leadOrganizationId;
        } else if (
          existingxaxis === "Owner" ||
          existingxaxis === "assignedTo" ||
          existingxaxis === "creator"
        ) {
          id = item.assignedUserId;
        } else if (existingxaxis === "Team") {
          id = item.teamId;
        }

        groupedData[groupKey] = {
          label: displayXValue,
          segments: {},
          id: id,
          rawXValue: item.xValue,
        };
      }

      // Accumulate segment values
      if (!groupedData[groupKey].segments[segmentValue]) {
        groupedData[groupKey].segments[segmentValue] = 0;
      }
      groupedData[groupKey].segments[segmentValue] += yValue;
    });

    // Convert segments object to array and create final array
    formattedResults = Object.values(groupedData).map((group) => {
      const segmentsArray = Object.entries(group.segments).map(
        ([labeltype, value]) => ({
          labeltype,
          value,
        })
      );

      return {
        label: group.label,
        segments: segmentsArray,
        id: group.id,
        totalSegmentValue: segmentsArray.reduce(
          (sum, seg) => sum + seg.value,
          0
        ),
      };
    });

    // Only sort for non-date fields
    if (!isDateFieldX) {
      formattedResults.sort(
        (a, b) => b.totalSegmentValue - a.totalSegmentValue
      );
    }

    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, durationUnit) || "Unknown";

      // Set id based on xaxis type
      let id = null;
      if (existingxaxis === "contactPerson") {
        id = item.personId || null;
      } else if (existingxaxis === "organization") {
        id = item.leadOrganizationId || null;
      } else if (
        existingxaxis === "Owner" ||
        existingxaxis === "assignedTo" ||
        existingxaxis === "creator"
      ) {
        id = item.assignedUserId || null;
      } else if (existingxaxis === "Team") {
        id = item.teamId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });

    // For non-date fields, ensure proper grouping by ID if available
    if (
      !isDateFieldX &&
      (existingxaxis === "contactPerson" ||
        existingxaxis === "organization" ||
        existingxaxis === "Owner" ||
        existingxaxis === "assignedTo" ||
        existingxaxis === "creator" ||
        existingxaxis === "Team")
    ) {
      // Group by ID to combine items with same ID
      const groupedById = {};

      formattedResults.forEach((item) => {
        const key = item.id || item.label;
        if (!groupedById[key]) {
          groupedById[key] = { ...item };
        } else {
          // Sum values for same ID
          groupedById[key].value += item.value;
        }
      });

      formattedResults = Object.values(groupedById);
    }

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
  filters,
  MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    // For Owner/assignedTo, exclude where assignedUser is null
    xaxisNullExcludeCondition['$assignedUser.name$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "Team") {
    // For Team, exclude where assignedUser.team is null
    xaxisNullExcludeCondition['$assignedUser.team$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition['$ActivityPerson.contactPerson$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition['$ActivityOrganization.organization$'] = { [Op.ne]: null,  [Op.ne]: "" };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null,  [Op.ne]: "" };
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
          filterIncludeModels,
          Lead, Deal, LeadPerson, LeadOrganization
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
      model: LeadPerson,
      as: "ActivityPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Activity.personId");
    attributes.push([Sequelize.col("Activity.personId"), "personId"]);
    attributes.push([Sequelize.col("ActivityPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    includeModels.push({
      model: LeadOrganization,
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
        model: LeadPerson,
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
        model: LeadOrganization,
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
  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    // Group the results properly
    const groupedData = {};

    results.forEach((item) => {
      // Determine grouping key based on xaxis type
      let groupKey;

      if (xaxis === "contactPerson" && item.personId) {
        // Group by personId for contactPerson
        groupKey = `person_${item.personId}`;
      } else if (xaxis === "organization" && item.leadOrganizationId) {
        // Group by leadOrganizationId for organization
        groupKey = `org_${item.leadOrganizationId}`;
      } else if (
        (xaxis === "Owner" || xaxis === "assignedTo" || xaxis === "creator") &&
        item.assignedUserId
      ) {
        // Group by assignedUserId for Owner/assignedTo/creator
        groupKey = `user_${item.assignedUserId}`;
      } else if (xaxis === "Team" && item.teamId) {
        // Group by teamId for Team
        groupKey = `team_${item.teamId}`;
      } else {
        // For all other cases, group by the raw xValue
        groupKey = `label_${item.xValue || "Unknown"}`;
      }

      // Format display values
      const displayXValue =
        formatDateValue(item.xValue, durationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[groupKey]) {
        // Set id based on xaxis type
        let id = null;
        if (xaxis === "contactPerson") {
          id = item.personId;
        } else if (xaxis === "organization") {
          id = item.leadOrganizationId;
        } else if (
          xaxis === "Owner" ||
          xaxis === "assignedTo" ||
          xaxis === "creator"
        ) {
          id = item.assignedUserId;
        } else if (xaxis === "Team") {
          id = item.teamId;
        }

        groupedData[groupKey] = {
          label: displayXValue,
          segments: {},
          id: id,
          rawXValue: item.xValue,
        };
      }

      // Accumulate segment values
      if (!groupedData[groupKey].segments[segmentValue]) {
        groupedData[groupKey].segments[segmentValue] = 0;
      }
      groupedData[groupKey].segments[segmentValue] += yValue;
    });

    // Convert segments object to array and create final array
    formattedResults = Object.values(groupedData).map((group) => {
      const segmentsArray = Object.entries(group.segments).map(
        ([labeltype, value]) => ({
          labeltype,
          value,
        })
      );

      return {
        label: group.label,
        segments: segmentsArray,
        id: group.id,
        totalSegmentValue: segmentsArray.reduce(
          (sum, seg) => sum + seg.value,
          0
        ),
      };
    });

    // Only sort for non-date fields
    if (!isDateFieldX) {
      formattedResults.sort(
        (a, b) => b.totalSegmentValue - a.totalSegmentValue
      );
    }

    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, durationUnit) || "Unknown";

      // Set id based on xaxis type
      let id = null;
      if (xaxis === "contactPerson") {
        id = item.personId || null;
      } else if (xaxis === "organization") {
        id = item.leadOrganizationId || null;
      } else if (
        xaxis === "Owner" ||
        xaxis === "assignedTo" ||
        xaxis === "creator"
      ) {
        id = item.assignedUserId || null;
      } else if (xaxis === "Team") {
        id = item.teamId || null;
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });

    // For non-date fields, ensure proper grouping by ID if available
    if (
      !isDateFieldX &&
      (xaxis === "contactPerson" ||
        xaxis === "organization" ||
        xaxis === "Owner" ||
        xaxis === "assignedTo" ||
        xaxis === "creator" ||
        xaxis === "Team")
    ) {
      // Group by ID to combine items with same ID
      const groupedById = {};

      formattedResults.forEach((item) => {
        const key = item.id || item.label;
        if (!groupedById[key]) {
          groupedById[key] = { ...item };
        } else {
          // Sum values for same ID
          groupedById[key].value += item.value;
        }
      });

      formattedResults = Object.values(groupedById);
    }

    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

exports.saveActivityReport = async (req, res) => {
  const { Report, Dashboard, MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization } = req.models;
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
            filters,
            MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
            existingfilters,
            MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
      const dashboard = await Dashboard.findOne({
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
  const { Report, Dashboard, ReportFolder } = req.models;
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
      const dashboard = await Dashboard.findOne({
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
  const { Report, Dashboard, ReportFolder } = req.models;
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
  const { Report, Dashboard, ReportFolder, MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity } = req.models;
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
            filterIncludeModels,
            Lead, Deal, LeadPerson, LeadOrganization
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
        limit,
        MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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
        limit,
        MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization
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

exports.createEmailReport = async (req, res) => {
  const { Report, Dashboard, ReportFolder, MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email } = req.models;
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
      { label: "Subject", value: "subject", type: "Email" },
      { label: "Email Direction", value: "folder", type: "Email" },
      { label: "User", value: "masterUserID", type: "Email" },
    ];

    const segmentedByOptions = [
      { label: "None", value: "none" },
      { label: "Subject", value: "subject" },
      { label: "Email Direction", value: "folder" },
      { label: "User", value: "masterUserID" },
    ];

    const yaxisArray = [
      {
        label: "No of Emails",
        value: "no of emails",
        type: "Email",
      }
    ];

    // Enhanced filter columns with date options
    const availableFilterColumns = {
      Email: [
        { label: "Subject", value: "subject", type: "text" },
        { label: "Email Direction", value: "folder", type: "text" },
        { label: "User", value: "masterUserID", type: "text" },
        { label: "Send/Recieve Date", value: "createdAt", type: "date" },
        // { label: "Custom Date", value: "customDate", type: "date" },
        // { label: "Date Range", value: "dateRange", type: "daterange" },
      ],
    };

    // Initialize variables
    let reportData = null;
    let paginationInfo = null;
    let totalValue = 0;
    let summary = null;
    let reportConfig = null;

    // Handle new report creation
    if (entity && type && !reportId) {
      if (entity === "Activity" && type === "Emails") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Email Performance reports",
          });
        }

        // Generate data with pagination
        const result = await generateEmailPerformanceData(
          ownerId,
          role,
          xaxis,
          yaxis,
          segmentedBy,
          filters,
          page,
          limit,
          MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
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
        segmentedBy: existingSegmentedBy,
        filters: existingFilters,
      } = config;

      if (existingEntity === "Activity" && existingType === "Emails") {
        // Generate data with pagination using existing parameters
        const result = await generateEmailPerformanceData(
          ownerId,
          role,
          existingxaxis,
          existingyaxis,
          existingSegmentedBy,
          existingFilters,
          page,
          limit,
          MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
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
    console.error("Error creating email reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create email reports",
      error: error.message,
    });
  }
};

// Helper function to generate email performance data
async function generateEmailPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
  segmentedBy,
  filters,
  page = 1,
  limit = 8,
  MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
) {
  const offset = (page - 1) * limit;
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
      const conditions = validConditions.map((cond) => {
        return getEmailConditionObject(cond.column, cond.operator, cond.value);
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
    }
  }

  let groupBy = [];
  let attributes = [];

  // Handle xaxis grouping
  if (xaxis === "masterUserID") {
    // For user grouping, we need to join with MasterUser table to get user names
    groupBy.push("Email.masterUserID");
    attributes.push([Sequelize.col("Email.masterUserID"), "xValue"]);
    attributes.push([Sequelize.col("MasterUser.name"), "userName"]);
  } else {
    // For subject and folder grouping
    groupBy.push(`Email.${xaxis}`);
    attributes.push([Sequelize.col(`Email.${xaxis}`), "xValue"]);
  }

  // Handle segmentedBy
  if (segmentedBy && segmentedBy !== "none") {
    if (segmentedBy === "masterUserID") {
      groupBy.push("Email.masterUserID");
      attributes.push([Sequelize.col("Email.masterUserID"), "segmentId"]);
      attributes.push([Sequelize.col("MasterUser.name"), "segmentValue"]);
    } else {
      groupBy.push(`Email.${segmentedBy}`);
      attributes.push([Sequelize.col(`Email.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Y-axis calculation
  let countAttribute;
  if (yaxis === "no of emails") {
    countAttribute = [
      Sequelize.fn("COUNT", Sequelize.col("emailID")),
      "yValue",
    ];
    attributes.push(countAttribute);
  }

  // Build include models
  let includeModels = [];
  if (xaxis === "masterUserID" || segmentedBy === "masterUserID") {
    includeModels.push({
      model: MasterUser,
      as: "MasterUser",
      attributes: [],
      required: false,
    });
  }

  // Get total count for pagination
  let countColumn;
  if (xaxis === "masterUserID") {
    countColumn = Sequelize.col("Email.masterUserID");
  } else {
    countColumn = Sequelize.col(`Email.${xaxis}`);
  }

  const totalCountResult = await Email.findAll({
    where: baseWhere,
    attributes: [
      [Sequelize.fn("COUNT", Sequelize.fn("DISTINCT", countColumn)), "total"],
    ],
    include: includeModels,
    raw: true,
  });

  const totalCount = parseInt(totalCountResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    // For segmented queries - use a simpler approach without subqueries
    results = await Email.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.fn("COUNT", Sequelize.col("emailID")), "DESC"]],
      limit: limit,
      offset: offset,
    });
  } else {
    // Non-segmented query
    results = await Email.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.fn("COUNT", Sequelize.col("emailID")), "DESC"]],
      limit: limit,
      offset: offset,
    });
  }

  // Format results
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      let xValue = item.xValue || "Unknown";
      
      // For user, use the user name if available
      if (xaxis === "masterUserID" && item.userName) {
        xValue = item.userName;
      }

      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        let id = null;
        if (xaxis === "masterUserID") {
          id = item.xValue; // This is the masterUserID
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

    // Sort by total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    formattedResults = results.map((item) => {
      let label = item.xValue || "Unknown";
      let id = null;

      // For user, use the user name if available
      if (xaxis === "masterUserID" && item.userName) {
        label = item.userName;
        id = item.xValue; // This is the masterUserID
      }

      // For folder, provide more descriptive labels
      if (xaxis === "folder") {
        if (label === "inbox") label = "inbox";
        if (label === "sent") label = "sent";
        if (label === "drafts") label = "drafts";
        if (label === "outbox") label = "outbox";
        if (label === "archive") label = "archive";
        if (label === "trash") label = "trash";
      }

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: id,
      };
    });

    // Sort by value (already sorted by SQL query)
    // formattedResults.sort((a, b) => b.value - a.value);

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

// Helper function for email-specific conditions
function getEmailConditionObject(column, operator, value) {
  // Handle createdAt column with special date values
  if (column === "createdAt") {
    // Check if value is one of the special date keywords
    const dateKeywords = [
      "today", "yesterday", "tomorrow", "thisMonth", "thisQuarter", "thisWeek",
      "thisYear", "lastWeek", "lastMonth", "lastQuarter", "lastYear", "nextWeek", "nextMonth", "nextYear", "nextQuarter",
    ];
    
    if (dateKeywords.includes(value)) {
      return getDateCondition(value, operator, null);
    }
    
    // Handle customDate and dateRange for createdAt column
    if (value === "customDate" || value === "dateRange") {
      return getDateCondition(value, operator, null);
    }
    
    // If value is a regular date string, treat it as customDate
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return getDateCondition("customDate", operator, value);
    }
    
    // If value is an array (for date range), treat it as dateRange
    if (Array.isArray(value) && value.length === 2) {
      return getDateCondition("dateRange", operator, value);
    }
  }

  // Handle regular text/number filters for other columns
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

// Helper function for date conditions
function getDateCondition(dateType, operator, value) {
  const now = new Date();
  let startDate, endDate;

  switch (dateType) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      break;
    case "tomorrow":
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      startDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0, 0);
      endDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);
      break;
    case "thisWeek":
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate(), 0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endDate = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate(), 23, 59, 59, 999);
      break;
    case "thisMonth":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "thisQuarter":
      const currentQuarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
      break;
    case "thisYear":
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case "lastWeek":
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
      startDate = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate(), 0, 0, 0, 0);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      endDate = new Date(lastWeekEnd.getFullYear(), lastWeekEnd.getMonth(), lastWeekEnd.getDate(), 23, 59, 59, 999);
      break;
    case "lastMonth":
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "lastQuarter":
      const currentMonth = now.getMonth();
      const lastQuarter = Math.floor(currentMonth / 3) - 1;
      const lastQuarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedLastQuarter = lastQuarter < 0 ? 3 : lastQuarter; // Q4 of previous year
      startDate = new Date(lastQuarterYear, adjustedLastQuarter * 3, 1, 0, 0, 0, 0);
      endDate = new Date(lastQuarterYear, (adjustedLastQuarter + 1) * 3, 0, 23, 59, 59, 999);
      break;
    case "lastYear":
      const lastYear = now.getFullYear() - 1;
      startDate = new Date(lastYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(lastYear, 11, 31, 23, 59, 59, 999);
      break;
    case "nextWeek":
      const nextWeekStart = new Date(now);
      nextWeekStart.setDate(now.getDate() - now.getDay() + 7);
      startDate = new Date(nextWeekStart.getFullYear(), nextWeekStart.getMonth(), nextWeekStart.getDate(), 0, 0, 0, 0);
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
      endDate = new Date(nextWeekEnd.getFullYear(), nextWeekEnd.getMonth(), nextWeekEnd.getDate(), 23, 59, 59, 999);
      break;
    case "nextMonth":
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      startDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "nextQuarter":
      const nextQuarter = Math.floor(now.getMonth() / 3) + 1;
      const nextQuarterYear = nextQuarter > 3 ? now.getFullYear() + 1 : now.getFullYear();
      const adjustedNextQuarter = nextQuarter > 3 ? 0 : nextQuarter; // Q1 of next year
      startDate = new Date(nextQuarterYear, adjustedNextQuarter * 3, 1, 0, 0, 0, 0);
      endDate = new Date(nextQuarterYear, (adjustedNextQuarter + 1) * 3, 0, 23, 59, 59, 999);
      break;
    case "nextYear":
      const nextYear = now.getFullYear() + 1;
      startDate = new Date(nextYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(nextYear, 11, 31, 23, 59, 59, 999);
      break;
    case "customDate":
      if (value) {
        startDate = new Date(value);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(value);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
    case "dateRange":
      if (Array.isArray(value) && value.length === 2) {
        startDate = new Date(value[0]);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(value[1]);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
  }

  if (startDate && endDate) {
    if (operator === "≠" || operator === "is not") {
      return {
        createdAt: {
          [Op.notBetween]: [startDate, endDate],
        },
      };
    } else {
      return {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      };
    }
  }

  return {};
}

// Helper function to get Sequelize operator
function getSequelizeOperator(operator) {
  const operatorMap = {
    "=": Op.eq,
    "≠": Op.ne,
    ">": Op.gt,
    ">=": Op.gte,
    "<": Op.lt,
    "<=": Op.lte,
    "contains": Op.like,
    "startsWith": Op.like,
    "endsWith": Op.like,
    "is": Op.eq,
    "is not": Op.ne,
  };
  
  return operatorMap[operator] || Op.eq;
}

exports.saveEmailReport = async (req, res) => {
  const { Report, Dashboard, ReportFolder, MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email } = req.models;
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
      if (entity === "Activity" && type === "Emails") {
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
          const result = await generateEmailPerformanceDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            segmentedBy,
            filters,
            limit,
            MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
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
          console.error("Error generating email performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate email performance data",
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

      if (existingentity === "Activity" && existingtype === "Emails") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for email Performance reports",
          });
        }

        try {
          // You need to implement this function
          const result = await generateEmailPerformanceDataForSave(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingSegmentedBy,
            existingfilters,
            limit,
            MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
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
          console.error("Error generating email performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate email performance data",
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
      const dashboard = await Dashboard.findOne({
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

async function generateEmailPerformanceDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  segmentedBy,
  filters,
  limit,
  MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
) {
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
      const conditions = validConditions.map((cond) => {
        return getEmailConditionObject(cond.column, cond.operator, cond.value);
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
    }
  }

  let groupBy = [];
  let attributes = [];

  // Handle xaxis grouping
  if (xaxis === "masterUserID") {
    // For user grouping, we need to join with MasterUser table to get user names
    groupBy.push("Email.masterUserID");
    attributes.push([Sequelize.col("Email.masterUserID"), "xValue"]);
    attributes.push([Sequelize.col("MasterUser.name"), "userName"]);
  } else {
    // For subject and folder grouping
    groupBy.push(`Email.${xaxis}`);
    attributes.push([Sequelize.col(`Email.${xaxis}`), "xValue"]);
  }

  // Handle segmentedBy
  if (segmentedBy && segmentedBy !== "none") {
    if (segmentedBy === "masterUserID") {
      groupBy.push("Email.masterUserID");
      attributes.push([Sequelize.col("Email.masterUserID"), "segmentId"]);
      attributes.push([Sequelize.col("MasterUser.name"), "segmentValue"]);
    } else {
      groupBy.push(`Email.${segmentedBy}`);
      attributes.push([Sequelize.col(`Email.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Y-axis calculation
  let countAttribute;
  if (yaxis === "no of emails") {
    countAttribute = [
      Sequelize.fn("COUNT", Sequelize.col("emailID")),
      "yValue",
    ];
    attributes.push(countAttribute);
  }

  // Build include models
  let includeModels = [];
  if (xaxis === "masterUserID" || segmentedBy === "masterUserID") {
    includeModels.push({
      model: MasterUser,
      as: "MasterUser",
      attributes: [],
      required: false,
    });
  }

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    // For segmented queries
    results = await Email.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.fn("COUNT", Sequelize.col("emailID")), "DESC"]]
    });
  } else {
    // Non-segmented query
    results = await Email.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: [[Sequelize.fn("COUNT", Sequelize.col("emailID")), "DESC"]]
    });
  }

  // Format results
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    const groupedData = {};
    results.forEach((item) => {
      let xValue = item.xValue || "Unknown";
      
      // For user, use the user name if available
      if (xaxis === "masterUserID" && item.userName) {
        xValue = item.userName;
      }

      const segmentValue = item.segmentValue || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        let id = null;
        if (xaxis === "masterUserID") {
          id = item.xValue; // This is the masterUserID
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

    // Sort by total value
    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    // Calculate the grand total
    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    formattedResults = results.map((item) => {
      let label = item.xValue || "Unknown";
      let id = null;

      // For user, use the user name if available
      if (xaxis === "masterUserID" && item.userName) {
        label = item.userName;
        id = item.xValue; // This is the masterUserID
      }

      // For folder, provide more descriptive labels
      if (xaxis === "folder") {
        if (label === "inbox") label = "inbox";
        if (label === "sent") label = "sent";
        if (label === "drafts") label = "drafts";
        if (label === "outbox") label = "outbox";
        if (label === "archive") label = "archive";
        if (label === "trash") label = "trash";
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
    totalValue: totalValue
  };
}

exports.getEmailReportSummary = async (req, res) => {
  const { Report, Dashboard, ReportFolder, MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email } = req.models;
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
        { sender: { [Op.like]: `%${search}%` } },
        { recipient: { [Op.like]: `%${search}%` } },
      ];
    }

    // Initialize include array for main query
    const include = [
      {
        model: MasterUser,
        as: "MasterUser",
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
          return getEmailConditionObject(
            cond.column,
            cond.operator,
            cond.value
          );
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
    if (sortBy === "user") {
      order.push([
        { model: MasterUser, as: "MasterUser" },
        "name",
        sortOrder,
      ]);
    } else if (sortBy === "sender") {
      order.push(["sender", sortOrder]);
    } else if (sortBy === "subject") {
      order.push(["subject", sortOrder]);
    } else {
      order.push([sortBy, sortOrder]);
    }

    // Get total count
    const totalCount = await Email.count({
      where: baseWhere,
      include: include,
    });

    // Get paginated results
    const emails = await Email.findAll({
      where: baseWhere,
      include: include,
      order: order,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "emailID",
        "messageId",
        "sender",
        "senderName",
        "recipient",
        "recipientName",
        "subject",
        "folder",
        "isRead",
        "createdAt",
        "updatedAt",
        "cc",
        "bcc",
        "masterUserID",
        "isDraft",
        "isOpened",
        "isClicked",
        "scheduledAt",
        "leadId",
        "dealId",
        "visibility",
        "userEmail",
        "labelId"
      ],
    });

    // Generate report data
    let reportData = [];
    let summary = {};

    // For report generation
    if (entity && type && xaxis && yaxis && !reportId) {
      if (entity === "Activity" && type === "Emails") {
        const reportResult = await generateEmailPerformanceData(
          ownerId,
          role,
          xaxis,
          yaxis,
          segmentedBy,
          filters,
          limit,
          MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
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
    } else if (reportId) {
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
      } = existingReports.dataValues;

      // Parse the config JSON string
      const config = JSON.parse(configString);
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      if (existingEntity === "Activity" && existingType === "Emails") {
        const reportResult = await generateEmailPerformanceData(
          ownerId,
          role,
          existingxaxis,
          existingyaxis,
          existingSegmentedBy,
          existingfilters,
          limit,
          MasterUser, Lead, Deal, LeadPerson, LeadOrganization, Activity, Email
        );
        reportData = reportResult.data;

        // Calculate summary statistics
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
      }
    }

    // Format emails for response
    const formattedEmails = emails.map((email) => ({
      id: email.emailID,
      messageId: email.messageId,
      sender: email.sender,
      senderName: email.senderName,
      recipient: email.recipient,
      recipientName: email.recipientName,
      subject: email.subject,
      folder: email.folder,
      folderLabel: getFolderLabel(email.folder),
      isRead: email.isRead,
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
      cc: email.cc,
      bcc: email.bcc,
      isDraft: email.isDraft,
      isOpened: email.isOpened,
      isClicked: email.isClicked,
      scheduledAt: email.scheduledAt,
      leadId: email.leadId,
      dealId: email.dealId,
      visibility: email.visibility,
      userEmail: email.userEmail,
      labelId: email.labelId,
      user: email.MasterUser
        ? {
            id: email.MasterUser.masterUserID,
            name: email.MasterUser.name,
            email: email.MasterUser.email,
          }
        : null,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: "Email data retrieved successfully",
      data: {
        emails: formattedEmails,
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
    console.error("Error retrieving email data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve email data",
      error: error.message,
    });
  }
};

// Helper function to get folder labels
function getFolderLabel(folder) {
  const folderLabels = {
    'inbox': 'Incoming Mails',
    'sent': 'Outgoing Mails', 
    'drafts': 'Drafts',
    'outbox': 'Outbox',
    'archive': 'Archive',
    'trash': 'Trash'
  };
  return folderLabels[folder] || folder;
}