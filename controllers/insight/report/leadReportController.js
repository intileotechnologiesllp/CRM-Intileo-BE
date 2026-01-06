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
   const { Report, MasterUser, Activity,  LeadPerson, Deal, Lead, LeadOrganization } = req.models;
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
      { label: "ESPL Proposal No", value: "esplProposalNo", type: "Lead" },
      {
        label: "No of reports prepared",
        value: "numberOfReportsPrepared",
        type: "Lead",
      },
      {
        label: "Organization Country",
        value: "organizationCountry",
        type: "Lead",
      },
      { label: "Project Location", value: "projectLocation", type: "Lead" },
      { label: "Owner Name", value: "ownerName", type: "Lead" },
      { label: "SBU Class", value: "SBUClass", type: "Lead" },
      { label: "Status", value: "status", type: "Lead" },
      {
        label: "Scope of Service Type",
        value: "scopeOfServiceType",
        type: "Lead",
      },
      { label: "Service Type", value: "serviceType", type: "Lead" },
      { label: "Source Channel", value: "sourceChannel", type: "Lead" },
      { label: "Source Channel Id", value: "sourceChannelID", type: "Lead" },
      { label: "Source Origin", value: "sourceOrigin", type: "Lead" },
      { label: "Source Origin Id", value: "sourceOriginID", type: "Lead" },
      { label: "Contact Person", value: "contactPerson", type: "Lead" },
      { label: "Organization", value: "organization", type: "Lead" },
      {
        label: "Proposal Value Currency",
        value: "proposalValueCurrency",
        type: "Lead",
      },
      { label: "Creator", value: "creator", type: "Lead" },
      { label: "Creator Status", value: "creatorstatus", type: "Lead" },
      { label: "Proposal Sent Date", value: "proposalSentDate", type: "Date" },
      { label: "Conversion Date", value: "conversionDate", type: "Date" },
      { label: "Add on", value: "createdAt", type: "Date" },
      { label: "Update on", value: "updatedAt", type: "Date" },
    ];

    const segmentedByOptions = [
      { label: "None", value: "none" },
      { label: "ESPL Proposal No", value: "esplProposalNo" },
      { label: "No of reports prepared", value: "numberOfReportsPrepared" },
      { label: "Organization Country", value: "organizationCountry" },
      { label: "Project Location", value: "projectLocation" },
      { label: "Owner Name", value: "ownerName" },
      { label: "SBU Class", value: "SBUClass" },
      { label: "Status", value: "status" },
      { label: "Scope of Service Type", value: "scopeOfServiceType" },
      { label: "Service Type", value: "serviceType" },
      { label: "Source Channel", value: "sourceChannel" },
      { label: "Source Channel Id", value: "sourceChannelID" },
      { label: "Source Origin", value: "sourceOrigin" },
      { label: "Source Origin Id", value: "sourceOriginID" },
      { label: "Contact Person", value: "contactPerson" },
      { label: "Organization", value: "organization" },
      { label: "Proposal Value Currency", value: "proposalValueCurrency" },
      { label: "Creator", value: "creator" },
      { label: "Creator Status", value: "creatorstatus" },
    ];

    const yaxisArray = [
      { label: "No of Leads", value: "no of leads", type: "Lead" },
      { label: "Proposal Value", value: "proposalValue", type: "Lead" },
      { label: "Value", value: "value", type: "Lead" },
    ];

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
    let totalValue = 0;
    let summary = null;
    let reportConfig = null;

    if (entity && type && !reportId) {
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
            durationUnit,
            segmentedBy,
            filters,
            page,
            limit,
            MasterUser, LeadPerson, Lead, LeadOrganization
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
          console.error("Error generating lead performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead performance data",
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
        durationUnit: existingDurationUnit,
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

        // Generate data with pagination
        const result = await generateExistingLeadPerformanceData(
          ownerId,
          role,
          existingxaxis,
          existingyaxis,
          existingDurationUnit,
          existingSegmentedBy,
          existingfilters,
          page,
          limit,
          MasterUser, LeadPerson, Lead, LeadOrganization
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

async function generateExistingLeadPerformanceData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  filters,
  page = 1,
  limit = 8,
  MasterUser, LeadPerson, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

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
          filterIncludeModels,
          MasterUser, LeadPerson, Lead, LeadOrganization
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
  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(
      existingxaxis,
      existingDurationUnit
    );
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (existingxaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([Sequelize.col("Lead.masterUserID"), "assignedUserId"]);
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
  } else if (existingxaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
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
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team" && !assignedUserIncludeExists);
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Lead.findAll({
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
      countColumn = Sequelize.col("Lead.personId");
    } else if (existingxaxis === "organization") {
      countColumn = Sequelize.col("Lead.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Lead.${existingxaxis}`);
    }

    totalCountResult = await Lead.findAll({
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
        groupColumn = Sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Lead.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
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

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX
          ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis),
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
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
      let xValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      // Handle null values for special cases
      if (existingxaxis === "contactPerson" && !item.xValue && item.personId) {
        xValue = "Unknown Contact";
      } else if (
        existingxaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        xValue = "Unknown Organization";
      }

      if (!groupedData[xValue]) {
        // Set id based on xaxis type
        let id = null;
        if (existingxaxis === "contactPerson") {
          id = item.personId;
        } else if (existingxaxis === "organization") {
          id = item.leadOrganizationId;
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
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      // Set id based on xaxis type
      let id = null;
      if (existingxaxis === "contactPerson") {
        id = item.personId;
      } else if (existingxaxis === "organization") {
        id = item.leadOrganizationId;
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
async function generateLeadPerformanceData(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters,
  page = 1,
  limit = 8,
  MasterUser, LeadPerson, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    // For Owner/assignedTo, exclude where assignedUser is null
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "Team") {
    // For Team, exclude where assignedUser.team is null
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

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
          filterIncludeModels,
          MasterUser, LeadPerson, Lead, LeadOrganization
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
  let attributes = ["personId", "leadOrganizationId"];

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "creator") {
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
  } else if (xaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

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
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Lead.findAll({
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
      countColumn = Sequelize.col("Lead.personId");
    } else if (xaxis === "organization") {
      countColumn = Sequelize.col("Lead.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Lead.${xaxis}`);
    }

    totalCountResult = await Lead.findAll({
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
        groupColumn = Sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Lead.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
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

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        // group: [...groupBy],
        group: groupBy,
        raw: true,
        order: isDateFieldX
          ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis),
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
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
      let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";
      const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set id based on xaxis type
        let id = null;
        if (xaxis === "contactPerson") {
          id = item.personId;
        } else if (xaxis === "organization") {
          id = item.leadOrganizationId;
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

function isDateField(xaxis) {
  const dateFields = [
    "proposalSentDate",
    "conversionDate",
    "createdAt",
    "updatedAt",
  ];
  return dateFields.includes(xaxis);
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

// Helper function to get date group expression based on durationUnit
function getDateGroupExpression(dateField, durationUnit) {
  const field = `Lead.${dateField}`;

  if (!durationUnit || durationUnit === "none") {
    return Sequelize.col(field);
  }

  switch (durationUnit.toLowerCase()) {
    case "daily":
      return Sequelize.fn("DATE_FORMAT", Sequelize.col(field), "%d/%m/%Y");

    case "weekly":
      return Sequelize.literal(
         `CONCAT('w', LPAD(WEEK(${field}, 3), 2, '0'), ' ', YEAR(${field}))`
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
    return [[Sequelize.col(`Lead.${xaxis}`), "ASC"]];
  }
  if (yaxis === "no of leads") {
    return [[Sequelize.fn("COUNT", Sequelize.col("leadId")), "DESC"]];
  } else {
    return [[Sequelize.fn("SUM", Sequelize.col(`Lead.${yaxis}`)), "DESC"]];
  }
}

function getConditionObject(column, operator, value, includeModels = [], MasterUser, LeadPerson, Lead, LeadOrganization) {
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
    fieldName === "proposalSentDate" ||
    fieldName === "conversionDate";

  // Handle date range filtering for "Add on" (daterange type)
  const isDateRangeFilter = fieldName === "daterange";

  if (isDateRangeFilter && Array.isArray(value)) {
    // Handle date range filter (from frontend: ["2025-06-23", "2025-06-25"])
    const [fromDate, toDate] = value;

    // Determine which date field to filter based on the table alias
    let dateField;
    switch (tableAlias) {
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
      addIncludeModel(tableAlias, includeModels, MasterUser, LeadPerson, Lead, LeadOrganization);

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
        addIncludeModel(tableAlias, includeModels, MasterUser, LeadPerson, Lead, LeadOrganization);
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
        addIncludeModel(tableAlias, includeModels, MasterUser, LeadPerson, Lead, LeadOrganization);
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
    addIncludeModel(tableAlias, includeModels, MasterUser, LeadPerson, Lead, LeadOrganization);

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
function addIncludeModel(tableAlias, includeModels, MasterUser, LeadPerson, Lead, LeadOrganization) {
  let modelConfig;

  switch (tableAlias) {
    case "LeadOrganization":
      modelConfig = {
        model: LeadOrganization,
        as: "LeadOrganization",
        required: false,
        attributes: [],
      };
      break;
    case "LeadPerson":
      modelConfig = {
        model: LeadPerson,
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

async function generateExistingLeadPerformanceDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  filters,
   MasterUser, LeadPerson, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
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
          filterIncludeModels,
           MasterUser, LeadPerson, Lead, LeadOrganization
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
  } else if (existingxaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([Sequelize.col("Lead.masterUserID"), "assignedUserId"]);
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
  } else if (existingxaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
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
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team" && !assignedUserIncludeExists);
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // For segmented queries - get all results without pagination
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
    });
  } else {
    // Get all results without pagination
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
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

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

// Helper function to generate activity performance data without pagination
async function generateLeadPerformanceDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters,
  MasterUser, LeadPerson, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (
    xaxis === "Owner" ||
    xaxis === "assignedTo" ||
    xaxis === "creator"
  ) {
    // For Owner/assignedTo/creator, exclude where assignedUser is null
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "Team") {
    // For Team, exclude where assignedUser.team is null
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
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
          filterIncludeModels,
          MasterUser, LeadPerson, Lead, LeadOrganization
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
  let attributes = ["personId", "leadOrganizationId"];

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([
      Sequelize.col("assignedUser.masterUserID"),
      "assignedUserId",
    ]);
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (xaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    // Handle Owner/assignedTo - join with MasterUser table
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([
      Sequelize.col("assignedUser.masterUserID"),
      "assignedUserId",
    ]);
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "Team") {
    // Handle Team - join with MasterUser table
    includeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "team", "teamId"],
      required: true,
    });
    groupBy.push("assignedUser.teamId");
    attributes.push([Sequelize.col("assignedUser.teamId"), "teamId"]);
    attributes.push([Sequelize.col("assignedUser.team"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Lead table
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

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
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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
  }  else if (yaxis === "value") {
    attributes.push([Sequelize.fn("SUM", Sequelize.col("value")), "yValue"]);
  } else {
    // For other yaxis values, explicitly specify the Lead table
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Lead.${yaxis}`)),
      "yValue",
    ]);
  }

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    // For segmented queries - get all results without pagination
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
    });
  } else {
    // Get all results without pagination
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
    });
  }

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

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

exports.saveLeadPerformReport = async (req, res) => {
  const { Report, Dashboard, MasterUser, LeadPerson, Lead, LeadOrganization } = req.models;
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
      durationUnit,
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
            durationUnit,
            segmentedBy,
            filters,
            MasterUser, LeadPerson, Lead, LeadOrganization
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
        durationUnit: existingDurationUnit,
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
            existingDurationUnit,
            existingSegmentedBy,
            existingfilters,
            MasterUser, LeadPerson, Lead, LeadOrganization
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

    if (role !== 'admin') {
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
    } else {
      // For admin role, check if dashboard exists without owner validation
      for (const dashboardId of dashboardIdsArray) {
        const dashboard = await Dashboard.findOne({
          where: { dashboardId },
        });
        if (!dashboard) {
          return res.status(404).json({
            success: false,
            message: `Dashboard ${dashboardId} not found`,
          });
        }
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
      durationUnit,
      segmentedBy,
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

exports.updateLeadPerformReport = async (req, res) => {
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

exports.deleteLeadPerformReport = async (req, res) => {
  const { Report } = req.models;
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
   const { Report, Dashboard, MasterUser, LeadPerson, Lead, LeadOrganization } = req.models;
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
            filterIncludeModels,
            MasterUser, LeadPerson, Lead, LeadOrganization
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
        durationUnit,
        segmentedBy,
        filters,
        page,
        limit,
        MasterUser, LeadPerson, Lead, LeadOrganization
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

      const reportResult = await generateExistingLeadPerformanceData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        existingDurationUnit,
        existingSegmentedBy,
        existingfilters,
        page,
        limit,
        MasterUser, LeadPerson, Lead, LeadOrganization
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
  const { Report, Dashboard, MasterUser, LeadPerson, Lead, LeadOrganization } = req.models;
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
      { label: "ESPL Proposal No", value: "esplProposalNo", type: "Lead" },
      {
        label: "No of reports prepared",
        value: "numberOfReportsPrepared",
        type: "Lead",
      },
      {
        label: "Organization Country",
        value: "organizationCountry",
        type: "Lead",
      },
      { label: "Project Location", value: "projectLocation", type: "Lead" },
      { label: "Owner Name", value: "ownerName", type: "Lead" },
      { label: "SBU Class", value: "SBUClass", type: "Lead" },
      { label: "Status", value: "status", type: "Lead" },
      {
        label: "Scope of Service Type",
        value: "scopeOfServiceType",
        type: "Lead",
      },
      { label: "Service Type", value: "serviceType", type: "Lead" },
      { label: "Source Channel", value: "sourceChannel", type: "Lead" },
      { label: "Source Channel Id", value: "sourceChannelID", type: "Lead" },
      { label: "Source Origin", value: "sourceOrigin", type: "Lead" },
      { label: "Source Origin Id", value: "sourceOriginID", type: "Lead" },
      { label: "Contact Person", value: "contactPerson", type: "Lead" },
      { label: "Organization", value: "organization", type: "Lead" },
      {
        label: "Proposal Value Currency",
        value: "proposalValueCurrency",
        type: "Lead",
      },
      { label: "Creator", value: "creator", type: "Lead" },
      { label: "Creator Status", value: "creatorstatus", type: "Lead" },
      { label: "Proposal Sent Date", value: "proposalSentDate", type: "Date" },
      { label: "Conversion Date", value: "conversionDate", type: "Date" },
      { label: "Add on", value: "createdAt", type: "Date" },
      { label: "Update on", value: "updatedAt", type: "Date" },
    ];

    const segmentedByOptions = [
      { label: "None", value: "none" },
      { label: "ESPL Proposal No", value: "esplProposalNo" },
      { label: "No of reports prepared", value: "numberOfReportsPrepared" },
      { label: "Organization Country", value: "organizationCountry" },
      { label: "Project Location", value: "projectLocation" },
      { label: "Owner Name", value: "ownerName" },
      { label: "SBU Class", value: "SBUClass" },
      { label: "Status", value: "status" },
      { label: "Scope of Service Type", value: "scopeOfServiceType" },
      { label: "Service Type", value: "serviceType" },
      { label: "Source Channel", value: "sourceChannel" },
      { label: "Source Channel Id", value: "sourceChannelID" },
      { label: "Source Origin", value: "sourceOrigin" },
      { label: "Source Origin Id", value: "sourceOriginID" },
      { label: "Contact Person", value: "contactPerson" },
      { label: "Organization", value: "organization" },
      { label: "Proposal Value Currency", value: "proposalValueCurrency" },
      { label: "Creator", value: "creator" },
      { label: "Creator Status", value: "creatorstatus" },
    ];

    const yaxisArray = [
      { label: "No of Leads", value: "no of leads", type: "Lead" },
      { label: "Proposal Value", value: "proposalValue", type: "Lead" },
      { label: "Value", value: "value", type: "Lead" },
    ];

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
    if (entity && type && !reportId) {
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
            durationUnit,
            segmentedBy,
            filters,
            page,
            limit,
            type,
            MasterUser, LeadPerson, Lead, LeadOrganization
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
          console.error("Error generating lead Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate lead Conversion data",
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
        durationUnit: existingDurationUnit,
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
          const result = await generateExistingLeadConversionData(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingDurationUnit,
            existingSegmentedBy,
            existingfilters,
            page,
            limit,
            type,
            MasterUser, LeadPerson, Lead, LeadOrganization
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
            colors: colors || {},
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

async function generateExistingLeadConversionData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  filters,
  page = 1,
  limit = 8,
  MasterUser, LeadPerson, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

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
          filterIncludeModels,
          MasterUser, LeadPerson, Lead, LeadOrganization
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

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(
      existingxaxis,
      existingDurationUnit
    );
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (existingxaxis === "creator") {
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
  } else if (existingxaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
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
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Lead.findAll({
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
      countColumn = Sequelize.col("Lead.personId");
    } else if (existingxaxis === "organization") {
      countColumn = Sequelize.col("Lead.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Lead.${existingxaxis}`);
    }

    totalCountResult = await Lead.findAll({
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
        groupColumn = Sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Lead.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
        : [
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

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX
          ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis),
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
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
      let xValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      const segmentValue =
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set id based on xaxis type
        let id = null;
        if (existingxaxis === "contactPerson") {
          id = item.personId;
        } else if (existingxaxis === "organization") {
          id = item.leadOrganizationId;
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
    // Original format for non-segmented data
    formattedResults = results.map((item) => {
      let label = item.xValue || "Unknown";

      // Set id based on xaxis type
      let id = null;
      if (existingxaxis === "contactPerson") {
        id = item.personId;
      } else if (existingxaxis === "organization") {
        id = item.leadOrganizationId;
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
async function generateLeadConversionData(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters,
  page = 1,
  limit = 8,
  MasterUser, LeadPerson, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    // For Owner/assignedTo, exclude where assignedUser is null
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "Team") {
    // For Team, exclude where assignedUser.team is null
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
  }

  // Add the null exclusion condition to baseWhere
  Object.assign(baseWhere, xaxisNullExcludeCondition);

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
          filterIncludeModels,
          MasterUser, LeadPerson, Lead, LeadOrganization
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
  let attributes = ["personId", "leadOrganizationId"];

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([Sequelize.col("Activity.masterUserID"), "assignedUserId"]);
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
  } else if (xaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the lead table
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

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
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Lead.findAll({
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
      countColumn = Sequelize.col("Lead.personId");
    } else if (xaxis === "organization") {
      countColumn = Sequelize.col("Lead.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Lead.${xaxis}`);
    }

    totalCountResult = await Lead.findAll({
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
        groupColumn = Sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Lead.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
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

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX
          ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis),
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
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
      let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";

      const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        // Set id based on xaxis type
        let id = null;
        if (xaxis === "contactPerson") {
          id = item.personId;
        } else if (xaxis === "organization") {
          id = item.leadOrganizationId;
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
        id = item.personId;
      } else if (xaxis === "organization") {
        id = item.leadOrganizationId;
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

async function generateExistingLeadConversionDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  filters,
  MasterUser, LeadPerson, Lead, LeadOrganization
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
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo") {
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "Team") {
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "contactPerson") {
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (existingxaxis === "organization") {
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    xaxisNullExcludeCondition[existingxaxis] = { [Op.ne]: null, [Op.ne]: "" };
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
          filterIncludeModels,
          MasterUser, LeadPerson, Lead, LeadOrganization
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

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(
      existingxaxis,
      existingDurationUnit
    );
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (existingxaxis === "creator") {
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
  } else if (existingxaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
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
      (existingSegmentedBy === "Owner" ||
        existingSegmentedBy === "assignedTo") &&
      !assignedUserIncludeExists
    ) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "name"],
        required: true,
      });
      groupBy.push("assignedUser.masterUserID");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // For segmented queries - get all results without pagination
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
    });
  } else {
    // Get all results without pagination
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
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

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

// Helper function to generate conversion activity performance data without pagination
async function generateLeadConversionDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters,
  MasterUser, LeadPerson, Lead, LeadOrganization
) {
  let includeModels = [];

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
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
  } else if (xaxis === "Owner" || xaxis === "assignedTo") {
    // For Owner/assignedTo, exclude where assignedUser is null
    xaxisNullExcludeCondition["$assignedUser.name$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "Team") {
    // For Team, exclude where assignedUser.team is null
    xaxisNullExcludeCondition["$assignedUser.team$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "contactPerson") {
    // For contactPerson, exclude where ActivityPerson.contactPerson is null
    xaxisNullExcludeCondition["$LeadPerson.contactPerson$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else if (xaxis === "organization") {
    // For organization, exclude where ActivityOrganization.organization is null
    xaxisNullExcludeCondition["$LeadOrganization.organization$"] = {
      [Op.ne]: null,
      [Op.ne]: "",
    };
  } else {
    // For regular Activity columns, exclude where the column value is null
    xaxisNullExcludeCondition[xaxis] = { [Op.ne]: null, [Op.ne]: "" };
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
          filterIncludeModels,
          MasterUser, LeadPerson, Lead, LeadOrganization
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
  let attributes = ["personId", "leadOrganizationId"];

  // Attribute and GroupBy setup with durationUnit support
  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(xaxis, durationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (xaxis === "creator") {
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "name"],
      required: true,
    });
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([Sequelize.col("Activity.masterUserID"), "assignedUserId"]);
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
  } else if (xaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: LeadPerson,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([Sequelize.col("Lead.personId"), "personId"]);
    attributes.push([Sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: LeadOrganization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      Sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the lead table
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([Sequelize.col(`Lead.${xaxis}`), "xValue"]);
  }

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
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: LeadPerson,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        Sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: LeadOrganization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        Sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
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
        groupColumn = Sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Lead.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
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

      results = await Lead.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX
          ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis),
      });
    }
  } else {
    results = await Lead.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX
        ? [[Sequelize.col(`Lead.${xaxis}`), "ASC"]]
        : getOrderClause(yaxis, xaxis),
    });
  }

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

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

exports.saveLeadConversionReport = async (req, res) => {
  const { Report, Dashboard, MasterUser, LeadPerson, Lead, LeadOrganization } = req.models;
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
      durationUnit,
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
            durationUnit,
            segmentedBy,
            filters,
            MasterUser, LeadPerson, Lead, LeadOrganization
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
            durationUnit,
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
        durationUnit: existingDurationUnit,
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
          const result = await generateExistingLeadConversionDataForSave(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingDurationUnit,
            existingSegmentedBy,
            existingfilters,
            MasterUser, LeadPerson, Lead, LeadOrganization
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

    if (role !== 'admin') {
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
    } else {
      // For admin role, check if dashboard exists without owner validation
      for (const dashboardId of dashboardIdsArray) {
        const dashboard = await Dashboard.findOne({
          where: { dashboardId },
        });
        if (!dashboard) {
          return res.status(404).json({
            success: false,
            message: `Dashboard ${dashboardId} not found`,
          });
        }
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

exports.getLeadConversionReportSummary = async (req, res) => {
  const { Report, Dashboard, MasterUser, LeadPerson, Lead, LeadOrganization } = req.models;
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
            filterIncludeModels,
            MasterUser, LeadPerson, Lead, LeadOrganization
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
        durationUnit,
        segmentedBy,
        filters,
        page,
        limit,
        MasterUser, LeadPerson, Lead, LeadOrganization
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

      const reportResult = await generateExistingLeadConversionData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        existingDurationUnit,
        existingSegmentedBy,
        existingfilters,
        page,
        limit,
        MasterUser, LeadPerson, Lead, LeadOrganization
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
