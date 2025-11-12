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

exports.createDealPerformReport = async (req, res) => {
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
      { label: "ESPL Proposal No", value: "esplProposalNo", type: "Deal" },
      {
        label: "No of reports prepared",
        value: "numberOfReportsPrepared",
        type: "Deal",
      },
      {
        label: "Organization Country",
        value: "organizationCountry",
        type: "Deal",
      },
      { label: "Project Location", value: "projectLocation", type: "Deal" },
      // { label: "Owner Name", value: "ownerName", type: "Deal" },
      { label: "SBU Class", value: "sbuClass", type: "Deal" },
      { label: "Status", value: "status", type: "Deal" },
      {
        label: "Scope of Service Type",
        value: "scopeOfServiceType",
        type: "Deal",
      },
      { label: "Service Type", value: "serviceType", type: "Deal" },
      { label: "Source Channel", value: "sourceChannel", type: "Deal" },
      { label: "Source Channel Id", value: "sourceChannelID", type: "Deal" },
      { label: "Source Origin", value: "sourceOrigin", type: "Deal" },
      // { label: "Source Origin Id", value: "sourceOriginID", type: "Deal" },
      { label: "Contact Person", value: "contactPerson", type: "Deal" },
      { label: "Organization", value: "organization", type: "Deal" },
      // {
      //   label: "Proposal Value Currency",
      //   value: "proposalValueCurrency",
      //   type: "Deal",
      // },
      { label: "Creator", value: "creator", type: "Deal" },
      { label: "Creator Status", value: "creatorstatus", type: "Deal" },
      { label: "Pipeline", value: "pipeline", type: "Deal" },
      { label: "Pipeline Stage", value: "pipelineStage", type: "Deal" },
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
      // { label: "Owner Name", value: "ownerName" },
      { label: "SBU Class", value: "sbuClass" },
      { label: "Status", value: "status" },
      { label: "Scope of Service Type", value: "scopeOfServiceType" },
      { label: "Service Type", value: "serviceType" },
      { label: "Source Channel", value: "sourceChannel" },
      { label: "Source Channel Id", value: "sourceChannelID" },
      { label: "Source Origin", value: "sourceOrigin" },
      // { label: "Source Origin Id", value: "sourceOriginID" },
      { label: "Contact Person", value: "contactPerson" },
      { label: "Organization", value: "organization" },
      // { label: "Proposal Value Currency", value: "proposalValueCurrency" },
      // { label: "Creator", value: "creator" },
      // { label: "Creator Status", value: "creatorstatus" },
      { label: "Pipeline", value: "pipeline" },
      { label: "Pipeline Stage", value: "pipelineStage" },
    ];

    const yaxisArray = [
      { label: "No of Deals", value: "no of deals", type: "Deal" },
      { label: "Proposal Value", value: "proposalValue", type: "Deal" },
      { label: "Value", value: "value", type: "Deal" },
    ];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Deal: [
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
        { label: "Pipeline", value: "pipeline", type: "text" },
        {
          label: "Pipeline Stage",
          value: "pipelineStage",
          type: "text",
        },
        { label: "Created At", value: "createdAt", type: "date" },
        { label: "Updated At", value: "updatedAt", type: "date" },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
      // Lead: [
      //   { label: "Contact Person", value: "Lead.contactPerson", type: "text" },
      //   { label: "Organization", value: "Lead.organization", type: "text" },
      //   { label: "Title", value: "Lead.title", type: "text" },
      //   { label: "Value Labels", value: "Lead.valueLabels", type: "text" },
      //   {
      //     label: "Expected Close Date",
      //     value: "Lead.expectedCloseDate",
      //     type: "date",
      //   },
      //   { label: "Source Channel", value: "Lead.sourceChannel", type: "text" },
      //   {
      //     label: "Source Channel ID",
      //     value: "Lead.sourceChannelID",
      //     type: "number",
      //   },
      //   { label: "Service Type", value: "Lead.serviceType", type: "text" },
      //   {
      //     label: "Scope Of Service Type",
      //     value: "Lead.scopeOfServiceType",
      //     type: "text",
      //   },
      //   { label: "Phone", value: "Lead.phone", type: "number" },
      //   { label: "Email", value: "Lead.email", type: "text" },
      //   { label: "Company", value: "Lead.company", type: "text" },
      //   {
      //     label: "Proposal Value",
      //     value: "Lead.proposalValue",
      //     type: "number",
      //   },
      //   {
      //     label: "ESPL Proposal No",
      //     value: "Lead.esplProposalNo",
      //     type: "number",
      //   },
      //   {
      //     label: "Project Location",
      //     value: "Lead.projectLocation",
      //     type: "text",
      //   },
      //   {
      //     label: "Organization Country",
      //     value: "Lead.organizationCountry",
      //     type: "text",
      //   },
      //   {
      //     label: "Proposal Sent Date",
      //     value: "Lead.proposalSentDate",
      //     type: "date",
      //   },
      //   { label: "Status", value: "Lead.status", type: "text" },
      //   { label: "SBU Class", value: "Lead.SBUClass", type: "text" },
      //   {
      //     label: "Sectoral Sector",
      //     value: "Lead.sectoralSector",
      //     type: "text",
      //   },
      //   { label: "Source Origin", value: "Lead.sourceOrigin", type: "text" },
      //   { label: "Lead Quality", value: "Lead.leadQuality", type: "text" },
      //   { label: "Value", value: "Lead.value", type: "number" },
      //   {
      //     label: "Proposal Value Currency",
      //     value: "Lead.proposalValueCurrency",
      //     type: "text",
      //   },
      //   { label: "Value Currency", value: "Lead.valueCurrency", type: "text" },
      // ],
      Organization: [
        {
          label: "Organization",
          value: "Organization.organization",
          type: "text",
        },
        {
          label: "Organization Labels",
          value: "Organization.organizationLabels",
          type: "text",
        },
        { label: "Address", value: "Organization.address", type: "text" },
        { label: "Created At", value: "Organization.createdAt", type: "date" },
        { label: "Updated At", value: "Organization.updatedAt", type: "date" },
        { label: "Add on", value: "Organization.daterange", type: "daterange" },
      ],
      Person: [
        {
          label: "Contact Person",
          value: "Person.contactPerson",
          type: "text",
        },
        {
          label: "Postal Address",
          value: "Person.postalAddress",
          type: "text",
        },
        { label: "Email", value: "Person.email", type: "text" },
        { label: "Phone", value: "Person.phone", type: "number" },
        { label: "Job Title", value: "Person.jobTitle", type: "text" },
        { label: "Person Labels", value: "Person.personLabels", type: "text" },
        { label: "Organization", value: "Person.organization", type: "text" },
        { label: "Created At", value: "Person.createdAt", type: "date" },
        { label: "Updated At", value: "Person.updatedAt", type: "date" },
        { label: "Add on", value: "Person.daterange", type: "daterange" },
      ],
    };

    // For Activity Performance reports, generate the data
    let reportData = null;
    let paginationInfo = null;
    if (entity && type && !reportId) {
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
          const result = await generateDealPerformanceData(
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
          console.error("Error generating deal performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal performance data",
            error: error.message,
          });
        }
      }
    } else if ((entity && type && reportId)) {
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
          const result = await generateExistingDealPerformanceData(
            ownerId,
            role,
            xaxis || existingxaxis,
            yaxis || existingyaxis,
            durationUnit || existingDurationUnit,
            segmentedBy || existingSegmentedBy,
            filters || existingfilters,
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
            xaxis: xaxis || existingxaxis,
            yaxis: yaxis || existingyaxis,
            durationUnit: durationUnit || existingDurationUnit,
            segmentedBy: segmentedBy || existingSegmentedBy,
            filters: filters || existingfilters || {},
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
          console.error("Error generating deal performance data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal performance data",
            error: error.message,
          });
        }
      }
    }
    else if ((!entity && !type && reportId)) {
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
          const result = await generateExistingDealPerformanceData(
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

async function generateExistingDealPerformanceData(
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
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
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
      existingSegmentedBy === "assignedTo") && !assignedUserIncludeExists
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team" && !assignedUserIncludeExists);
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      // Special handling for contactPerson - join with Person table
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
    } else if (existingSegmentedBy === "organization") {
      // Special handling for organization - join with Organization table
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
    } else {
      groupBy.push(`Deal.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Deal.${existingSegmentedBy}`),
        "segmentValue",
      ]);
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
let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Deal.findAll({
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
      countColumn = Sequelize.col("Deal.personId");
    } else if (existingxaxis === "organization") {
      countColumn = Sequelize.col("Deal.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Deal.${existingxaxis}`);
    }

    totalCountResult = await Deal.findAll({
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
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
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
      let xValue = formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
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
      let label = item.xValue || "Unknown";

      // Handle null values for special cases
      if (existingxaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        existingxaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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
async function generateDealPerformanceData(
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
  let attributes = ["personId", "leadOrganizationId"];

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(xaxis);
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(
      xaxis,
      durationUnit
    );
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
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
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
    } else if (segmentedBy === "Team") {
      groupBy.push("assignedUser.team" && !assignedUserIncludeExists);
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (segmentedBy === "contactPerson") {
      // Special handling for contactPerson - join with Person table
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
    } else if (segmentedBy === "organization") {
      // Special handling for organization - join with Organization table
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
    } else {
      groupBy.push(`Deal.${segmentedBy}`);
      attributes.push([Sequelize.col(`Deal.${segmentedBy}`), "segmentValue"]);
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
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Deal.findAll({
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
      countColumn = Sequelize.col("Deal.personId");
    } else if (xaxis === "organization") {
      countColumn = Sequelize.col("Deal.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Deal.${xaxis}`);
    }

    totalCountResult = await Deal.findAll({
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
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        // group: [...groupBy],
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
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

      // Handle null values for special cases
      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        xValue = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        xValue = "Unknown Organization";
      }

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

      // Handle null values for special cases
      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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

// Helper function to check if xaxis is a date field
function isDateField(xaxis) {
  const dateFields = [
   "proposalSentDate",
    "conversionDate",
    "createdAt",
    "updatedAt",
  ];
  return dateFields.includes(xaxis);
}

// Helper function to get date group expression based on durationUnit
function getDateGroupExpression(dateField, durationUnit) {
  const field = `Deal.${dateField}`;

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
function getOrderClause(yaxis, xaxis, duration) {
  // If xaxis is a date field, return natural order (no sorting by value)
  if (isDateField(xaxis)) {
    // For date fields, order by the date field itself to maintain chronological order
    return [[Sequelize.col(`Activity.${xaxis}`), "ASC"]];
  }

  if (yaxis === "no of deals") {
    return [[Sequelize.fn("COUNT", Sequelize.col("dealId")), "DESC"]];
  } else if (yaxis === "proposalValue") {
    return [[Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")), "DESC"]];
  } else if (yaxis === "value") {
    return [[Sequelize.fn("SUM", Sequelize.col("Deal.value")), "DESC"]];
  } else if (yaxis === "totalDuration") {
    return [
      [
        Sequelize.fn(
          "SUM",
          Sequelize.literal(
            duration === "hours"
              ? `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
              : `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        ),
        "DESC",
      ],
    ];
  } else if (yaxis === "averageDuration") {
    return [
      [
        Sequelize.fn(
          "AVG",
          Sequelize.literal(
            duration === "hours"
              ? `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
              : `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        ),
        "DESC",
      ],
    ];
  } else {
    return [[Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)), "DESC"]];
  }
}

function getConditionObject(column, operator, value, includeModels = []) {
  let conditionValue = value;

  // Check if column contains a dot (indicating a related table field)
  const hasRelation = column.includes(".");
  let tableAlias = "Deal";
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
    fieldName ===  "conversionDate";

  // Handle date range filtering for "Add on" (daterange type)
  const isDateRangeFilter = fieldName === "daterange";

  if (isDateRangeFilter && Array.isArray(value)) {
    // Handle date range filter (from frontend: ["2025-06-23", "2025-06-25"])
    const [fromDate, toDate] = value;

    // Determine which date field to filter based on the table alias
    let dateField;
    switch (tableAlias) {
      case "Organization":
      case "Person":
        dateField = "createdAt";
        break;
      default:
        dateField = "createdAt";
    }

    // For related tables, use the proper Sequelize syntax
    if (tableAlias !== "Deal") {
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

async function generateExistingDealPerformanceDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
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

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  // Handle existingxaxis special cases
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
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
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
      existingSegmentedBy === "assignedTo") && !assignedUserIncludeExists
    ) {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team" && !assignedUserIncludeExists);
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      // Special handling for contactPerson - join with Person table
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
    } else if (existingSegmentedBy === "organization") {
      // Special handling for organization - join with Organization table
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
    } else {
      groupBy.push(`Deal.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Deal.${existingSegmentedBy}`),
        "segmentValue",
      ]);
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
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
        : getOrderClause(existingyaxis, existingxaxis),
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
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
      let xValue = formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
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
      let label = item.xValue || "Unknown";

      // Handle null values for special cases
      if (existingxaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        existingxaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue
  };
}

// Helper function to generate deal performance data without pagination
async function generateDealPerformanceDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
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
  let attributes = ["personId", "leadOrganizationId"];

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(xaxis);
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(
      xaxis,
      durationUnit
    );
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
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
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
    } else if (segmentedBy === "Team") {
      groupBy.push("assignedUser.team" && !assignedUserIncludeExists);
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (segmentedBy === "contactPerson") {
      // Special handling for contactPerson - join with Person table
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
    } else if (segmentedBy === "organization") {
      // Special handling for organization - join with Organization table
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
    } else {
      groupBy.push(`Deal.${segmentedBy}`);
      attributes.push([Sequelize.col(`Deal.${segmentedBy}`), "segmentValue"]);
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
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
        ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
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
       let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";
       const segmentValue =
        formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      // Handle null values for special cases
      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        xValue = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        xValue = "Unknown Organization";
      }

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

      // Handle null values for special cases
      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue
  };
}

exports.saveDealPerformReport = async (req, res) => {
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
    let paginationInfo = null;
    let totalValue = null;
    let reportConfig = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
      if (entity === "Deal" && type === "Performance") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deal Performance reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateDealPerformanceDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            durationUnit,
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
            durationUnit,
            segmentedBy,
            filters: filters || {},
            reportData,
            totalValue,
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

      if (existingentity === "Deal" && existingtype === "Performance") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deal Performance reports",
          });
        }

        try {
          const result = await generateExistingDealPerformanceDataForSave(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingDurationUnit,
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
            durationUnit: existingDurationUnit,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
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

exports.getDealPerformReportSummary = async (req, res) => {
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
        // { ownerName: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { pipeline: { [Op.like]: `%${search}%` } },
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
      const reportResult = await generateDealPerformanceData(
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

      const reportResult = await generateExistingDealPerformanceData(
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
      },
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
    console.error("Error retrieving deals data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve deals data",
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
      { label: "ESPL Proposal No", value: "esplProposalNo", type: "Deal" },
      {
        label: "No of reports prepared",
        value: "numberOfReportsPrepared",
        type: "Deal",
      },
      {
        label: "Organization Country",
        value: "organizationCountry",
        type: "Deal",
      },
      { label: "Project Location", value: "projectLocation", type: "Deal" },
      { label: "SBU Class", value: "sbuClass", type: "Deal" },
      { label: "Status", value: "status", type: "Deal" },
      {
        label: "Scope of Service Type",
        value: "scopeOfServiceType",
        type: "Deal",
      },
      { label: "Service Type", value: "serviceType", type: "Deal" },
      { label: "Source Channel", value: "sourceChannel", type: "Deal" },
      { label: "Source Channel Id", value: "sourceChannelID", type: "Deal" },
      { label: "Source Origin", value: "sourceOrigin", type: "Deal" },
      { label: "Contact Person", value: "contactPerson", type: "Deal" },
      { label: "Organization", value: "organization", type: "Deal" },
      { label: "Creator", value: "creator", type: "Deal" },
      { label: "Creator Status", value: "creatorstatus", type: "Deal" },
      { label: "Pipeline", value: "pipeline", type: "Deal" },
      { label: "Pipeline Stage", value: "pipelineStage", type: "Deal" },
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
      { label: "SBU Class", value: "sbuClass" },
      { label: "Status", value: "status" },
      { label: "Scope of Service Type", value: "scopeOfServiceType" },
      { label: "Service Type", value: "serviceType" },
      { label: "Source Channel", value: "sourceChannel" },
      { label: "Source Channel Id", value: "sourceChannelID" },
      { label: "Source Origin", value: "sourceOrigin" },
      { label: "Contact Person", value: "contactPerson" },
      { label: "Organization", value: "organization" },
      { label: "Pipeline", value: "pipeline" },
      { label: "Pipeline Stage", value: "pipelineStage" },
    ];

    const yaxisArray = [
      { label: "No of Deals", value: "no of deals", type: "Deal" },
      { label: "Proposal Value", value: "proposalValue", type: "Deal" },
      { label: "Value", value: "value", type: "Deal" },
    ];

    // Add this to your createActivityReport function or make it available globally
    const availableFilterColumns = {
      Deal: [
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
        { label: "Pipeline", value: "pipeline", type: "text" },
        {
          label: "Pipeline Stage",
          value: "pipelineStage",
          type: "text",
        },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
      Lead: [
        { label: "Contact Person", value: "Lead.contactPerson", type: "text" },
        { label: "Organization", value: "Lead.organization", type: "text" },
        { label: "Title", value: "Lead.title", type: "text" },
        { label: "Value Labels", value: "Lead.valueLabels", type: "text" },
        {
          label: "Expected Close Date",
          value: "Lead.expectedCloseDate",
          type: "date",
        },
        { label: "Source Channel", value: "Lead.sourceChannel", type: "text" },
        {
          label: "Source Channel ID",
          value: "Lead.sourceChannelID",
          type: "number",
        },
        { label: "Service Type", value: "Lead.serviceType", type: "text" },
        {
          label: "Scope Of Service Type",
          value: "Lead.scopeOfServiceType",
          type: "text",
        },
        { label: "Phone", value: "Lead.phone", type: "number" },
        { label: "Email", value: "Lead.email", type: "text" },
        { label: "Company", value: "Lead.company", type: "text" },
        {
          label: "Proposal Value",
          value: "Lead.proposalValue",
          type: "number",
        },
        {
          label: "ESPL Proposal No",
          value: "Lead.esplProposalNo",
          type: "number",
        },
        {
          label: "Project Location",
          value: "Lead.projectLocation",
          type: "text",
        },
        {
          label: "Organization Country",
          value: "Lead.organizationCountry",
          type: "text",
        },
        {
          label: "Proposal Sent Date",
          value: "Lead.proposalSentDate",
          type: "date",
        },
        { label: "Status", value: "Lead.status", type: "text" },
        { label: "SBU Class", value: "Lead.SBUClass", type: "text" },
        {
          label: "Sectoral Sector",
          value: "Lead.sectoralSector",
          type: "text",
        },
        { label: "Source Origin", value: "Lead.sourceOrigin", type: "text" },
        { label: "Lead Quality", value: "Lead.leadQuality", type: "text" },
        { label: "Value", value: "Lead.value", type: "number" },
        {
          label: "Proposal Value Currency",
          value: "Lead.proposalValueCurrency",
          type: "text",
        },
        { label: "Value Currency", value: "Lead.valueCurrency", type: "text" },
      ],
      Organization: [
        {
          label: "Organization",
          value: "Organization.organization",
          type: "text",
        },
        {
          label: "Organization Labels",
          value: "Organization.organizationLabels",
          type: "text",
        },
        { label: "Address", value: "Organization.address", type: "text" },
      ],
      Person: [
        {
          label: "Contact Person",
          value: "Person.contactPerson",
          type: "text",
        },
        {
          label: "Postal Address",
          value: "Person.postalAddress",
          type: "text",
        },
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
    let totalValue = 0;
    let summary = {};
    let reportConfig = {};

    if (entity && type && !reportId) {
      if (entity === "Deal" && type === "Conversion") {
        // Validate required fields for Conversion reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deal Conversion reports",
          });
        }

        // Validate durationUnit for date fields
        const dateFields = ["createdAt", "updatedAt", "proposalSentDate", "conversionDate"];
        if (dateFields.includes(xaxis) && !durationUnit) {
          return res.status(400).json({
            success: false,
            message: "Duration unit is required for date fields on x-axis",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateDealConversionData(
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
            reportData
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
          console.error("Error generating deal Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal Conversion data",
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
          const result = await generateExistingDealConversionData(
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
            reportData
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

// Helper function to generate activity performance data with pagination
async function generateDealConversionData(
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
  const baseWhereConditions = [
    {
      // Only include won or lost deals
      status: {
        [Op.in]: ["won", "lost"],
      },
    },
  ];

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhereConditions.push({
      masterUserID: ownerId,
    });
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

      baseWhereConditions.push(combinedCondition);

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

  // Create the final where condition
  const baseWhere =
    baseWhereConditions.length > 1
      ? { [Op.and]: baseWhereConditions }
      : baseWhereConditions[0];

  // Check if xaxis is a date field
  const dateFields = ["createdAt", "updatedAt", "proposalSentDate", "conversionDate"];
  const isDateField = dateFields.includes(xaxis);

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let xaxisColumn;
  let xaxisIncludeModels = [];
  let dateFormat = null;

  if (xaxis === "creator") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    xaxisColumn = "assignedUser.name";
  } else if (xaxis === "creatorstatus") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    xaxisColumn = "assignedUser.creatorstatus";
  } else if (isDateField && durationUnit) {
    // Set date format based on durationUnit
    switch (durationUnit) {
      case "daily":
        dateFormat = "%d/%m/%Y"; // DD/MM/YYYY
        break;
      case "monthly":
        dateFormat = "%m/%Y"; // MM/YYYY
        break;
      case "quarterly":
        dateFormat = "Q%q/%Y"; // Q1/YYYY, Q2/YYYY, etc.
        break;
      case "yearly":
        dateFormat = "%Y"; // YYYY
        break;
      default:
        dateFormat = "%m/%Y"; // Default to monthly
    }
    xaxisColumn = `Deal.${xaxis}`;
  } else {
    xaxisColumn = `Deal.${xaxis}`;
  }

  // Combine all include models
  const allIncludeModels = [...includeModels, ...xaxisIncludeModels];

  // Build attributes for distinct query based on date field or regular field
  let distinctAttributes;
  let orderBy;

  if (isDateField && durationUnit) {
    // For date fields with durationUnit, use date formatting with DISTINCT
    distinctAttributes = [
      [
        Sequelize.fn(
          "DISTINCT",
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          )
        ),
        "xValue",
      ],
    ];
    orderBy = [[Sequelize.literal("xValue"), "ASC"]];
  } else {
    // For regular fields
    distinctAttributes = [
      [Sequelize.fn("DISTINCT", Sequelize.col(xaxisColumn)), "xValue"],
    ];
    orderBy = [[Sequelize.col(xaxisColumn), "ASC"]];
  }

  // First, get distinct x-axis values with pagination
  const distinctXValues = await Deal.findAll({
    where: baseWhere,
    attributes: distinctAttributes,
    include: allIncludeModels,
    raw: true,
    order: orderBy,
    limit: limit,
    offset: offset,
  });

  // Extract the xValues and remove duplicates
  const xValues = [...new Set(distinctXValues.map((item) => item.xValue || "Unknown"))];

  if (xValues.length === 0) {
    return {
      data: [],
      pagination: {
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limit,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  // Get total count of distinct x-axis values for pagination
  let totalCountAttributes;
  if (isDateField && durationUnit) {
    totalCountAttributes = [
      [
        Sequelize.fn(
          "COUNT",
          Sequelize.fn(
            "DISTINCT",
            Sequelize.fn(
              "DATE_FORMAT",
              Sequelize.col(xaxisColumn),
              dateFormat
            )
          )
        ),
        "total",
      ],
    ];
  } else {
    totalCountAttributes = [
      [
        Sequelize.fn(
          "COUNT",
          Sequelize.fn("DISTINCT", Sequelize.col(xaxisColumn))
        ),
        "total",
      ],
    ];
  }

  const totalCountResult = await Deal.findAll({
    where: baseWhere,
    attributes: totalCountAttributes,
    include: allIncludeModels,
    raw: true,
  });

  const totalCount = parseInt(totalCountResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  // Now get the status breakdown for only the paginated x-axis values
  let groupBy = [];
  let attributes = ["personId", "leadOrganizationId"];

  if (xaxis === "creator") {
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "creatorstatus") {
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (isDateField && durationUnit) {
    // For date fields with durationUnit, group by formatted date
    const formattedDate = Sequelize.fn(
      "DATE_FORMAT",
      Sequelize.col(xaxisColumn),
      dateFormat
    );
    groupBy.push(Sequelize.literal(`DATE_FORMAT(${xaxisColumn}, '${dateFormat.replace(/%/g, '')}')`));
    attributes.push([formattedDate, "xValue"]);
  } else {
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
  }

  // Always group by status to get the breakdown
  groupBy.push("Deal.status");
  attributes.push([Sequelize.col("Deal.status"), "status"]);

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
  } else {
    // For other yaxis values
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)),
      "yValue",
    ]);
  }

  // Add condition to only include the paginated x-values
  let paginatedWhere;
  if (isDateField && durationUnit) {
    // For date fields, we need to use the formatted date in the condition
    paginatedWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          ),
          {
            [Op.in]: xValues,
          }
        ),
      ],
    };
  } else {
    // For regular fields
    paginatedWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(Sequelize.col(xaxisColumn), {
          [Op.in]: xValues,
        }),
      ],
    };
  }

  // Execute query to get status breakdown for paginated x-values
  const results = await Deal.findAll({
    where: paginatedWhere,
    attributes: attributes,
    include: allIncludeModels,
    group: groupBy,
    raw: true,
    order: orderBy,
  });

  // Format the results to group by xValue and include status breakdown
  const groupedData = {};

  results.forEach((item) => {
    const xValue = item.xValue || "Unknown";
    const status = item.status || "Unknown";
    const yValue = item.yValue || 0;

    // Only include won and lost statuses
    if (status !== "won" && status !== "lost") {
      return;
    }

    if (!groupedData[xValue]) {
      if (xaxis === "contactPerson") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.personId || null,
        };
      } else if (xaxis === "organization") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.leadOrganizationId || null,
        };
      } else {
        groupedData[xValue] = { label: xValue, status: [], total: 0, id: null };
      }
    }

    // Add status breakdown
    groupedData[xValue].status.push({
      labeltype: status,
      value: yValue,
    });

    // Calculate total
    groupedData[xValue].total += yValue;
  });

  // Calculate percentages for each status
  Object.keys(groupedData).forEach((key) => {
    const group = groupedData[key];
    group.status.forEach((status) => {
      status.percentage =
        group.total > 0 ? Math.round((status.value / group.total) * 100) : 0;
    });
  });

  // Convert to array and ensure order matches the paginated x-values
  const formattedResults = xValues.map((xValue) => {
    return (
      groupedData[xValue] || {
        label: xValue,
        status: [],
        total: 0,
        id: xaxis === "contactPerson" ? null : (xaxis === "organization" ? null : null),
      }
    );
  });

  // Calculate totalValue for summary
  let totalValue = 0;
  if (yaxis === "no of deals") {
    totalValue = formattedResults.reduce((sum, item) => sum + item.total, 0);
  } else {
    totalValue = formattedResults.reduce((sum, item) => sum + (item.total || 0), 0);
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

async function generateExistingDealConversionData(
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
  const baseWhereConditions = [
    {
      // Only include won or lost deals
      status: {
        [Op.in]: ["won", "lost"],
      },
    },
  ];

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhereConditions.push({
      masterUserID: ownerId,
    });
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

      baseWhereConditions.push(combinedCondition);

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

  // Create the final where condition
  const baseWhere =
    baseWhereConditions.length > 1
      ? { [Op.and]: baseWhereConditions }
      : baseWhereConditions[0];

  // Check if xaxis is a date field
  const dateFields = ["createdAt", "updatedAt", "proposalSentDate", "conversionDate"];
  const isDateField = dateFields.includes(existingxaxis);

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let xaxisColumn;
  let xaxisIncludeModels = [];
  let dateFormat = null;

  if (existingxaxis === "creator") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    xaxisColumn = "assignedUser.name";
  } else if (existingxaxis === "creatorstatus") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    xaxisColumn = "assignedUser.creatorstatus";
  } else if (isDateField && existingDurationUnit) {
    // Set date format based on durationUnit
    switch (existingDurationUnit) {
      case "daily":
        dateFormat = "%d/%m/%Y"; // DD/MM/YYYY
        break;
      case "monthly":
        dateFormat = "%m/%Y"; // MM/YYYY
        break;
      case "quarterly":
        dateFormat = "Q%q/%Y"; // Q1/YYYY, Q2/YYYY, etc.
        break;
      case "yearly":
        dateFormat = "%Y"; // YYYY
        break;
      default:
        dateFormat = "%m/%Y"; // Default to monthly
    }
    xaxisColumn = `Deal.${existingxaxis}`;
  } else {
    xaxisColumn = `Deal.${existingxaxis}`;
  }

  // Combine all include models
  const allIncludeModels = [...includeModels, ...xaxisIncludeModels];

  // Build attributes for distinct query based on date field or regular field
  let distinctAttributes;
  let orderBy;

  if (isDateField && existingDurationUnit) {
    // For date fields with durationUnit, use date formatting with DISTINCT
    distinctAttributes = [
      [
        Sequelize.fn(
          "DISTINCT",
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          )
        ),
        "xValue",
      ],
    ];
    orderBy = [[Sequelize.literal("xValue"), "ASC"]];
  } else {
    // For regular fields
    distinctAttributes = [
      [Sequelize.fn("DISTINCT", Sequelize.col(xaxisColumn)), "xValue"],
    ];
    orderBy = [[Sequelize.col(xaxisColumn), "ASC"]];
  }

  // First, get distinct x-axis values with pagination
  const distinctXValues = await Deal.findAll({
    where: baseWhere,
    attributes: distinctAttributes,
    include: allIncludeModels,
    raw: true,
    order: orderBy,
    limit: limit,
    offset: offset,
  });

  // Extract the xValues and remove duplicates
  const xValues = [...new Set(distinctXValues.map((item) => item.xValue || "Unknown"))];

  if (xValues.length === 0) {
    return {
      data: [],
      pagination: {
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limit,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  // Get total count of distinct x-axis values for pagination
  let totalCountAttributes;
  if (isDateField && existingDurationUnit) {
    totalCountAttributes = [
      [
        Sequelize.fn(
          "COUNT",
          Sequelize.fn(
            "DISTINCT",
            Sequelize.fn(
              "DATE_FORMAT",
              Sequelize.col(xaxisColumn),
              dateFormat
            )
          )
        ),
        "total",
      ],
    ];
  } else {
    totalCountAttributes = [
      [
        Sequelize.fn(
          "COUNT",
          Sequelize.fn("DISTINCT", Sequelize.col(xaxisColumn))
        ),
        "total",
      ],
    ];
  }

  const totalCountResult = await Deal.findAll({
    where: baseWhere,
    attributes: totalCountAttributes,
    include: allIncludeModels,
    raw: true,
  });

  const totalCount = parseInt(totalCountResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  // Now get the status breakdown for only the paginated x-axis values
  let groupBy = [];
  let attributes = [];

  if (existingxaxis === "creator") {
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (isDateField && existingDurationUnit) {
    // For date fields with durationUnit, group by formatted date
    const formattedDate = Sequelize.fn(
      "DATE_FORMAT",
      Sequelize.col(xaxisColumn),
      dateFormat
    );
    groupBy.push(Sequelize.literal(`DATE_FORMAT(${xaxisColumn}, '${dateFormat.replace(/%/g, '')}')`));
    attributes.push([formattedDate, "xValue"]);
  } else {
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Always group by status to get the breakdown
  groupBy.push("Deal.status");
  attributes.push([Sequelize.col("Deal.status"), "status"]);

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
  } else {
    // For other yaxis values
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Add condition to only include the paginated x-values
  let paginatedWhere;
  if (isDateField && existingDurationUnit) {
    // For date fields, we need to use the formatted date in the condition
    paginatedWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          ),
          {
            [Op.in]: xValues,
          }
        ),
      ],
    };
  } else {
    // For regular fields
    paginatedWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(Sequelize.col(xaxisColumn), {
          [Op.in]: xValues,
        }),
      ],
    };
  }

  // Execute query to get status breakdown for paginated x-values
  const results = await Deal.findAll({
    where: paginatedWhere,
    attributes: attributes,
    include: allIncludeModels,
    group: groupBy,
    raw: true,
    order: orderBy,
  });

  // Format the results to group by xValue and include status breakdown
  const groupedData = {};

  results.forEach((item) => {
    const xValue = item.xValue || "Unknown";
    const status = item.status || "Unknown";
    const yValue = item.yValue || 0;

    // Only include won and lost statuses
    if (status !== "won" && status !== "lost") {
      return;
    }

    if (!groupedData[xValue]) {
      if (existingxaxis === "contactPerson") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.personId || null,
        };
      } else if (existingxaxis === "organization") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.leadOrganizationId || null,
        };
      } else {
        groupedData[xValue] = { label: xValue, status: [], total: 0, id: null };
      }
    }

    // Add status breakdown
    groupedData[xValue].status.push({
      labeltype: status,
      value: yValue,
    });

    // Calculate total
    groupedData[xValue].total += yValue;
  });

  // Calculate percentages for each status
  Object.keys(groupedData).forEach((key) => {
    const group = groupedData[key];
    group.status.forEach((status) => {
      status.percentage =
        group.total > 0 ? Math.round((status.value / group.total) * 100) : 0;
    });
  });

  // Convert to array and ensure order matches the paginated x-values
  const formattedResults = xValues.map((xValue) => {
    return (
      groupedData[xValue] || {
        label: xValue,
        status: [],
        total: 0,
        id: existingxaxis === "contactPerson" ? null : (existingxaxis === "organization" ? null : null),
      }
    );
  });

  // Calculate totalValue for summary
  let totalValue = 0;
  if (existingyaxis === "no of deals") {
    totalValue = formattedResults.reduce((sum, item) => sum + item.total, 0);
  } else {
    totalValue = formattedResults.reduce((sum, item) => sum + (item.total || 0), 0);
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

async function generateDealConversionDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters
) {
  let includeModels = [];

  // Base where condition - only show activities owned by the user if not admin
  const baseWhereConditions = [
    {
      // Only include won or lost deals
      status: {
        [Op.in]: ["won", "lost"],
      },
    },
  ];

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhereConditions.push({
      masterUserID: ownerId,
    });
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

      baseWhereConditions.push(combinedCondition);

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

  // Create the final where condition
  const baseWhere =
    baseWhereConditions.length > 1
      ? { [Op.and]: baseWhereConditions }
      : baseWhereConditions[0];

  // Check if xaxis is a date field
  const dateFields = ["createdAt", "updatedAt", "proposalSentDate", "conversionDate"];
  const isDateField = dateFields.includes(xaxis);

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let xaxisColumn;
  let xaxisIncludeModels = [];
  let dateFormat = null;

  if (xaxis === "creator") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    xaxisColumn = "assignedUser.name";
  } else if (xaxis === "creatorstatus") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    xaxisColumn = "assignedUser.creatorstatus";
  } else if (isDateField && durationUnit) {
    // Set date format based on durationUnit
    switch (durationUnit) {
      case "daily":
        dateFormat = "%d/%m/%Y"; // DD/MM/YYYY
        break;
      case "monthly":
        dateFormat = "%m/%Y"; // MM/YYYY
        break;
      case "quarterly":
        dateFormat = "Q%q/%Y"; // Q1/YYYY, Q2/YYYY, etc.
        break;
      case "yearly":
        dateFormat = "%Y"; // YYYY
        break;
      default:
        dateFormat = "%m/%Y"; // Default to monthly
    }
    xaxisColumn = `Deal.${xaxis}`;
  } else {
    xaxisColumn = `Deal.${xaxis}`;
  }

  // Combine all include models
  const allIncludeModels = [...includeModels, ...xaxisIncludeModels];

  // Build attributes for distinct query based on date field or regular field
  let distinctAttributes;
  let orderBy;

  if (isDateField && durationUnit) {
    // For date fields with durationUnit, use date formatting with DISTINCT
    distinctAttributes = [
      [
        Sequelize.fn(
          "DISTINCT",
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          )
        ),
        "xValue",
      ],
    ];
    orderBy = [[Sequelize.literal("xValue"), "ASC"]];
  } else {
    // For regular fields
    distinctAttributes = [
      [Sequelize.fn("DISTINCT", Sequelize.col(xaxisColumn)), "xValue"],
    ];
    orderBy = [[Sequelize.col(xaxisColumn), "ASC"]];
  }

  // Get all distinct x-axis values (no pagination)
  const distinctXValues = await Deal.findAll({
    where: baseWhere,
    attributes: distinctAttributes,
    include: allIncludeModels,
    raw: true,
    order: orderBy,
  });

  // Extract the xValues and remove duplicates
  const xValues = [...new Set(distinctXValues.map((item) => item.xValue || "Unknown"))];

  if (xValues.length === 0) {
    return {
      data: [],
      totalValue: 0,
    };
  }

  // Now get the status breakdown for all x-axis values
  let groupBy = [];
  let attributes = ["personId", "leadOrganizationId"];

  if (xaxis === "creator") {
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (xaxis === "creatorstatus") {
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (isDateField && durationUnit) {
    // For date fields with durationUnit, group by formatted date
    const formattedDate = Sequelize.fn(
      "DATE_FORMAT",
      Sequelize.col(xaxisColumn),
      dateFormat
    );
    groupBy.push(Sequelize.literal(`DATE_FORMAT(${xaxisColumn}, '${dateFormat.replace(/%/g, '')}')`));
    attributes.push([formattedDate, "xValue"]);
  } else {
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
  }

  // Always group by status to get the breakdown
  groupBy.push("Deal.status");
  attributes.push([Sequelize.col("Deal.status"), "status"]);

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
  } else {
    // For other yaxis values
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)),
      "yValue",
    ]);
  }

  // Add condition to only include the x-values
  let finalWhere;
  if (isDateField && durationUnit) {
    // For date fields, we need to use the formatted date in the condition
    finalWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          ),
          {
            [Op.in]: xValues,
          }
        ),
      ],
    };
  } else {
    // For regular fields
    finalWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(Sequelize.col(xaxisColumn), {
          [Op.in]: xValues,
        }),
      ],
    };
  }

  // Execute query to get status breakdown for all x-values
  const results = await Deal.findAll({
    where: finalWhere,
    attributes: attributes,
    include: allIncludeModels,
    group: groupBy,
    raw: true,
    order: orderBy,
  });

  // Format the results to group by xValue and include status breakdown
  const groupedData = {};

  results.forEach((item) => {
    const xValue = item.xValue || "Unknown";
    const status = item.status || "Unknown";
    const yValue = item.yValue || 0;

    // Only include won and lost statuses
    if (status !== "won" && status !== "lost") {
      return;
    }

    if (!groupedData[xValue]) {
      if (xaxis === "contactPerson") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.personId || null,
        };
      } else if (xaxis === "organization") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.leadOrganizationId || null,
        };
      } else {
        groupedData[xValue] = { label: xValue, status: [], total: 0, id: null };
      }
    }

    // Add status breakdown
    groupedData[xValue].status.push({
      labeltype: status,
      value: yValue,
    });

    // Calculate total
    groupedData[xValue].total += yValue;
  });

  // Calculate percentages for each status
  Object.keys(groupedData).forEach((key) => {
    const group = groupedData[key];
    group.status.forEach((status) => {
      status.percentage =
        group.total > 0 ? Math.round((status.value / group.total) * 100) : 0;
    });
  });

  // Convert to array and ensure order matches the x-values
  const formattedResults = xValues.map((xValue) => {
    return (
      groupedData[xValue] || {
        label: xValue,
        status: [],
        total: 0,
        id: xaxis === "contactPerson" ? null : (xaxis === "organization" ? null : null),
      }
    );
  });

  // Calculate totalValue for summary
  let totalValue = 0;
  if (yaxis === "no of deals") {
    totalValue = formattedResults.reduce((sum, item) => sum + item.total, 0);
  } else {
    totalValue = formattedResults.reduce((sum, item) => sum + (item.total || 0), 0);
  }

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
  };
}

async function generateExistingDealConversionDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  existingDurationUnit,
  existingSegmentedBy,
  filters
) {
  let includeModels = [];

  // Base where condition - only show activities owned by the user if not admin
  const baseWhereConditions = [
    {
      // Only include won or lost deals
      status: {
        [Op.in]: ["won", "lost"],
      },
    },
  ];

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhereConditions.push({
      masterUserID: ownerId,
    });
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

      baseWhereConditions.push(combinedCondition);

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

  // Create the final where condition
  const baseWhere =
    baseWhereConditions.length > 1
      ? { [Op.and]: baseWhereConditions }
      : baseWhereConditions[0];

  // Check if xaxis is a date field
  const dateFields = ["createdAt", "updatedAt", "proposalSentDate", "conversionDate"];
  const isDateField = dateFields.includes(existingxaxis);

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let xaxisColumn;
  let xaxisIncludeModels = [];
  let dateFormat = null;

  if (existingxaxis === "creator") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "name"],
      required: true,
    });
    xaxisColumn = "assignedUser.name";
  } else if (existingxaxis === "creatorstatus") {
    xaxisIncludeModels.push({
      model: MasterUser,
      as: "assignedUser",
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    xaxisColumn = "assignedUser.creatorstatus";
  } else if (isDateField && existingDurationUnit) {
    // Set date format based on durationUnit
    switch (existingDurationUnit) {
      case "daily":
        dateFormat = "%d/%m/%Y"; // DD/MM/YYYY
        break;
      case "monthly":
        dateFormat = "%m/%Y"; // MM/YYYY
        break;
      case "quarterly":
        dateFormat = "Q%q/%Y"; // Q1/YYYY, Q2/YYYY, etc.
        break;
      case "yearly":
        dateFormat = "%Y"; // YYYY
        break;
      default:
        dateFormat = "%m/%Y"; // Default to monthly
    }
    xaxisColumn = `Deal.${existingxaxis}`;
  } else {
    xaxisColumn = `Deal.${existingxaxis}`;
  }

  // Combine all include models
  const allIncludeModels = [...includeModels, ...xaxisIncludeModels];

  // Build attributes for distinct query based on date field or regular field
  let distinctAttributes;
  let orderBy;

  if (isDateField && existingDurationUnit) {
    // For date fields with durationUnit, use date formatting with DISTINCT
    distinctAttributes = [
      [
        Sequelize.fn(
          "DISTINCT",
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          )
        ),
        "xValue",
      ],
    ];
    orderBy = [[Sequelize.literal("xValue"), "ASC"]];
  } else {
    // For regular fields
    distinctAttributes = [
      [Sequelize.fn("DISTINCT", Sequelize.col(xaxisColumn)), "xValue"],
    ];
    orderBy = [[Sequelize.col(xaxisColumn), "ASC"]];
  }

  // Get all distinct x-axis values (no pagination)
  const distinctXValues = await Deal.findAll({
    where: baseWhere,
    attributes: distinctAttributes,
    include: allIncludeModels,
    raw: true,
    order: orderBy,
  });

  // Extract the xValues and remove duplicates
  const xValues = [...new Set(distinctXValues.map((item) => item.xValue || "Unknown"))];

  if (xValues.length === 0) {
    return {
      data: [],
      totalValue: 0,
    };
  }

  // Now get the status breakdown for all x-axis values
  let groupBy = [];
  let attributes = [];

  if (existingxaxis === "creator") {
    groupBy.push("assignedUser.masterUserID");
    attributes.push([Sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([Sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (isDateField && existingDurationUnit) {
    // For date fields with durationUnit, group by formatted date
    const formattedDate = Sequelize.fn(
      "DATE_FORMAT",
      Sequelize.col(xaxisColumn),
      dateFormat
    );
    groupBy.push(Sequelize.literal(`DATE_FORMAT(${xaxisColumn}, '${dateFormat.replace(/%/g, '')}')`));
    attributes.push([formattedDate, "xValue"]);
  } else {
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Always group by status to get the breakdown
  groupBy.push("Deal.status");
  attributes.push([Sequelize.col("Deal.status"), "status"]);

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
  } else {
    // For other yaxis values
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${existingyaxis}`)),
      "yValue",
    ]);
  }

  // Add condition to only include the x-values
  let finalWhere;
  if (isDateField && existingDurationUnit) {
    // For date fields, we need to use the formatted date in the condition
    finalWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col(xaxisColumn),
            dateFormat
          ),
          {
            [Op.in]: xValues,
          }
        ),
      ],
    };
  } else {
    // For regular fields
    finalWhere = {
      [Op.and]: [
        baseWhere,
        Sequelize.where(Sequelize.col(xaxisColumn), {
          [Op.in]: xValues,
        }),
      ],
    };
  }

  // Execute query to get status breakdown for all x-values
  const results = await Deal.findAll({
    where: finalWhere,
    attributes: attributes,
    include: allIncludeModels,
    group: groupBy,
    raw: true,
    order: orderBy,
  });

  // Format the results to group by xValue and include status breakdown
  const groupedData = {};

  results.forEach((item) => {
    const xValue = item.xValue || "Unknown";
    const status = item.status || "Unknown";
    const yValue = item.yValue || 0;

    // Only include won and lost statuses
    if (status !== "won" && status !== "lost") {
      return;
    }

    if (!groupedData[xValue]) {
      if (existingxaxis === "contactPerson") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.personId || null,
        };
      } else if (existingxaxis === "organization") {
        groupedData[xValue] = {
          label: xValue,
          status: [],
          total: 0,
          id: item?.leadOrganizationId || null,
        };
      } else {
        groupedData[xValue] = { label: xValue, status: [], total: 0, id: null };
      }
    }

    // Add status breakdown
    groupedData[xValue].status.push({
      labeltype: status,
      value: yValue,
    });

    // Calculate total
    groupedData[xValue].total += yValue;
  });

  // Calculate percentages for each status
  Object.keys(groupedData).forEach((key) => {
    const group = groupedData[key];
    group.status.forEach((status) => {
      status.percentage =
        group.total > 0 ? Math.round((status.value / group.total) * 100) : 0;
    });
  });

  // Convert to array and ensure order matches the x-values
  const formattedResults = xValues.map((xValue) => {
    return (
      groupedData[xValue] || {
        label: xValue,
        status: [],
        total: 0,
        id: existingxaxis === "contactPerson" ? null : (existingxaxis === "organization" ? null : null),
      }
    );
  });

  // Calculate totalValue for summary
  let totalValue = 0;
  if (existingyaxis === "no of deals") {
    totalValue = formattedResults.reduce((sum, item) => sum + item.total, 0);
  } else {
    totalValue = formattedResults.reduce((sum, item) => sum + (item.total || 0), 0);
  }

  // Return data without pagination info
  return {
    data: formattedResults,
    totalValue: totalValue,
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
      if (entity === "Deal" && type === "Conversion") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deal Conversion reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateDealConversionDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            durationUnit,
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
            durationUnit,
            segmentedBy,
            filters: filters || {},
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating deal conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal conversion data",
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

      if (existingentity === "Deal" && existingtype === "Conversion") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for deal conversion reports",
          });
        }

        try {
          const result = await generateExistingDealConversionDataForSave(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingDurationUnit,
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
            durationUnit: existingDurationUnit,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating deal conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal conversion data",
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

exports.getDealConversionReportSummary = async (req, res) => {
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
      const reportResult = await generateDealConversionData(
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

      const reportResult =
        await generateExistingDealConversionData(
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
      },
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
    console.error("Error retrieving deals data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve deals data",
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
      "pipeline",
      "pipelineStage",
    ];

    const segmentedByOptions = [
      "none",
      "esplProposalNo",
      "numberOfReportsPrepared",
      "organizationCountry",
      "projectLocation",
      "sbuClass",
      "status",
      "scopeOfServiceType",
      "serviceType",
      "sourceChannel",
      "sourceChannelID",
      "sourceOrigin",
      "contactPerson",
      "organization",
      "pipeline",
      "pipelineStage",
    ];

    const yaxisArray = ["no of deals", "proposalValue", "value"];

    // Filter columns definition
    const availableFilterColumns = {
      Deal: [
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
        { label: "Pipeline", value: "pipeline", type: "text" },
        {
          label: "Pipeline Stage",
          value: "pipelineStage",
          type: "text",
        },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
      Organization: [
        {
          label: "Organization",
          value: "Organization.organization",
          type: "text",
        },
        {
          label: "Organization Labels",
          value: "Organization.organizationLabels",
          type: "text",
        },
        { label: "Address", value: "Organization.address", type: "text" },
      ],
      Person: [
        {
          label: "Contact Person",
          value: "Person.contactPerson",
          type: "text",
        },
        {
          label: "Postal Address",
          value: "Person.postalAddress",
          type: "text",
        },
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
    let totalValue = 0;
    let summary = {};

    if (entity && type && !reportId) {
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
    } else if ((!entity && !type && reportId) || (entity && type && reportId)) {
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
            reportId,
            entity: existingentity,
            type: existingtype,
            xaxis: existingxaxis,
            yaxis: existingyaxis,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors,
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

// Helper function to format results with pipeline stage breakdown
function formatResultsWithPipelineBreakdown(results, xaxis) {
  const groupedByXValue = {};

  // First pass: collect all pipeline stage values for each xValue
  results.forEach((item) => {
    const xValue = item.xValue === null ? "Unknown" : item.xValue;
    const pipelineStage = item.pipelineStage || "Unknown";
    const yValue = parseFloat(item.yValue || 0);

    // if (!groupedByXValue[xValue]) {
    //   groupedByXValue[xValue] = {
    //     label: xValue,
    //     value: 0,
    //     breakdown: {},
    //   };
    // }
    if (!groupedByXValue[xValue]) {
      if (xaxis == "contactPerson") {
        groupedByXValue[xValue] = {
          label: xValue,
          breakdown: {},
          value: 0,
          id: item?.personId || null,
        };
      } else if (xaxis == "organization") {
        groupedByXValue[xValue] = {
          label: xValue,
          breakdown: {},
          value: 0,
          id: item?.leadOrganizationId || null,
        };
      } else {
        groupedByXValue[xValue] = {
          label: xValue,
          breakdown: {},
          value: 0,
          id: null,
        };
      }
    }

    // Add to the pipeline stage breakdown - accumulate values for same stage
    if (!groupedByXValue[xValue].breakdown[pipelineStage]) {
      groupedByXValue[xValue].breakdown[pipelineStage] = 0;
    }
    groupedByXValue[xValue].breakdown[pipelineStage] += yValue;

    // Also accumulate to the total value
    groupedByXValue[xValue].value += yValue;
  });

  // Convert to array and sort by total value descending
  return Object.values(groupedByXValue).sort((a, b) => b.value - a.value);
}

async function generateProgressExistingActivityPerformanceData(
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
    // For regular columns, explicitly specify the Deal table
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Add pipelineStage to group by to get the breakdown
  groupBy.push("Deal.pipelineStage");
  attributes.push([Sequelize.col("Deal.pipelineStage"), "pipelineStage"]);

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
      groupBy.push(`Deal.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Deal.${existingSegmentedBy}`),
        "segmentValue",
      ]);
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

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const paginatedGroups = await Deal.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        existingyaxis === "no of deals"
          ? [Sequelize.fn("COUNT", Sequelize.col("dealId")), "DESC"]
          : existingyaxis === "proposalValue"
          ? [Sequelize.fn("SUM", Sequelize.col("proposalValue")), "DESC"]
          : [
              Sequelize.fn("SUM", Sequelize.col(`Deal.${existingyaxis}`)),
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Deal.findAll({
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
    // Use the pipeline breakdown format
    formattedResults = formatResultsWithPipelineBreakdown(results, xaxis);

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
async function generateProgressActivityPerformanceData(
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
  let attributes = ["personId", "leadOrganizationId"];

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
      groupBy.push(`Deal.${segmentedBy}`);
      attributes.push([Sequelize.col(`Deal.${segmentedBy}`), "segmentValue"]);
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

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    const paginatedGroups = await Deal.findAll({
      attributes: [[Sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: [
        yaxis === "no of deals"
          ? [Sequelize.fn("COUNT", Sequelize.col("dealId")), "DESC"]
          : yaxis === "proposalValue"
          ? [Sequelize.fn("SUM", Sequelize.col("proposalValue")), "DESC"]
          : [Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)), "DESC"],
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
        : ["Deal", groupBy[0]];
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: [[Sequelize.literal("yValue"), "DESC"]],
      });
    }
  } else {
    results = await Deal.findAll({
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

      // if (!groupedData[xValue]) {
      //   groupedData[xValue] = { label: xValue, segments: [] };
      // }
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

    formattedResults = Object.values(groupedData);

    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
    });

    formattedResults.sort((a, b) => b.totalSegmentValue - a.totalSegmentValue);

    totalValue = formattedResults.reduce(
      (sum, group) => sum + group.totalSegmentValue,
      0
    );
  } else {
    // Use the pipeline breakdown format for non-segmented data
    formattedResults = formatResultsWithPipelineBreakdown(results, xaxis);

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
    const role = req.role;

    let reportData = null;
    let paginationInfo = null;
    let totalValue = null;
    let reportConfig = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
      if (entity === "Deal" && type === "Progress") {
        // Validate required fields for performance reports
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
          console.error("Error generating Deal Progress data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Deal Progress data",
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

      if (existingentity === "Deal" && existingtype === "Progress") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message: "X-axis and Y-axis are required for Deal Progress reports",
          });
        }

        try {
          const result = await generateProgressExistingActivityPerformanceData(
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
          console.error("Error generating Deal Progress data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Deal Progress data",
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
      const reportResult = await generateProgressActivityPerformanceData(
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

      const reportResult =
        await generateProgressExistingActivityPerformanceData(
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
      },
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

exports.createDealDurationReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      duration = "days",
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
      { label: "ESPL Proposal No", value: "esplProposalNo", type: "Deal" },
      {
        label: "No of reports prepared",
        value: "numberOfReportsPrepared",
        type: "Deal",
      },
      {
        label: "Organization Country",
        value: "organizationCountry",
        type: "Deal",
      },
      { label: "Project Location", value: "projectLocation", type: "Deal" },
      { label: "SBU Class", value: "sbuClass", type: "Deal" },
      { label: "Status", value: "status", type: "Deal" },
      {
        label: "Scope of Service Type",
        value: "scopeOfServiceType",
        type: "Deal",
      },
      { label: "Service Type", value: "serviceType", type: "Deal" },
      { label: "Source Channel", value: "sourceChannel", type: "Deal" },
      { label: "Source Channel Id", value: "sourceChannelID", type: "Deal" },
      { label: "Source Origin", value: "sourceOrigin", type: "Deal" },
      { label: "Contact Person", value: "contactPerson", type: "Deal" },
      { label: "Organization", value: "organization", type: "Deal" },
      { label: "Creator", value: "creator", type: "Deal" },
      { label: "Creator Status", value: "creatorstatus", type: "Deal" },
      { label: "Pipeline", value: "pipeline", type: "Deal" },
      { label: "Pipeline Stage", value: "pipelineStage", type: "Deal" },
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
      { label: "SBU Class", value: "sbuClass" },
      { label: "Status", value: "status" },
      { label: "Scope of Service Type", value: "scopeOfServiceType" },
      { label: "Service Type", value: "serviceType" },
      { label: "Source Channel", value: "sourceChannel" },
      { label: "Source Channel Id", value: "sourceChannelID" },
      { label: "Source Origin", value: "sourceOrigin" },
      { label: "Contact Person", value: "contactPerson" },
      { label: "Organization", value: "organization" },
      { label: "Pipeline", value: "pipeline" },
      { label: "Pipeline Stage", value: "pipelineStage" },
    ];

    const yaxisArray = [
      { label: "Total Duration", value: "totalDuration", type: "Deal" },
      { label: "Average Duration", value: "averageDuration", type: "Deal" },
    ];

    // Filter columns (unchanged)
    const availableFilterColumns = {
      Deal: [
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
        { label: "Pipeline", value: "pipeline", type: "text" },
        {
          label: "Pipeline Stage",
          value: "pipelineStage",
          type: "text",
        },
        { label: "Add on", value: "daterange", type: "daterange" },
      ],
      Organization: [
        {
          label: "Organization",
          value: "Organization.organization",
          type: "text",
        },
        {
          label: "Organization Labels",
          value: "Organization.organizationLabels",
          type: "text",
        },
        { label: "Address", value: "Organization.address", type: "text" },
      ],
      Person: [
        {
          label: "Contact Person",
          value: "Person.contactPerson",
          type: "text",
        },
        {
          label: "Postal Address",
          value: "Person.postalAddress",
          type: "text",
        },
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
    let totalValue = 0;
    let reportConfig = {};

    if (entity && type && !reportId) {
      if (entity === "Deal" && type === "Duration") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message: "X-axis and Y-axis are required for Deal Duration reports",
          });
        }

        // Validate durationUnit for date fields
        const dateFields = ["createdAt", "updatedAt", "proposalSentDate", "conversionDate"];
        if (dateFields.includes(xaxis) && !durationUnit) {
          return res.status(400).json({
            success: false,
            message: "Duration unit is required for date fields on x-axis",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateDealDurationData(
            ownerId,
            role,
            xaxis,
            yaxis,
            duration,
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
            duration,
            durationUnit,
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
    } else if ((!entity && !type && reportId) || (entity && type && reportId)) {
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
        graphtype: existinggraphtype,
        colors: existingcolors,
      } = existingReports.dataValues;

      const colors = JSON.parse(existingcolors);
      // Parse the config JSON string
      const config = JSON.parse(configString);
      const {
        xaxis: existingxaxis,
        yaxis: existingyaxis,
        duration: existingDuration = "days",
        durationUnit: existingDurationUnit,
        segmentedBy: existingSegmentedBy,
        filters: existingfilters,
      } = config;

      if (existingentity === "Deal" && existingtype === "Duration") {
        // Validate required fields for performance reports
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message: "X-axis and Y-axis are required for Deal Duration reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateExistingDealDurationData(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            existingDuration,
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
            duration: existingDuration,
            durationUnit: existingDurationUnit,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colors,
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
      totalValue: totalValue,
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

async function generateExistingDealDurationData(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  duration,
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

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let groupBy = [];
  let attributes = [];

  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(existingxaxis, existingDurationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (existingxaxis === "creator") {
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
  } else if (existingxaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
    const isSegmentedByDate = isDateField(existingSegmentedBy);
    const shouldSegmentByDuration = isSegmentedByDate && existingDurationUnit && existingDurationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(existingSegmentedBy, existingDurationUnit);
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
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

    if (existingSegmentedBy === "Owner" || existingSegmentedBy === "assignedTo") {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "segmentValue"]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "segmentValue"]);
    } else {
      groupBy.push(`Deal.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Deal.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis - Duration calculations
  if (existingyaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.value")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (
    existingyaxis === "totalDuration" ||
    existingyaxis === "averageDuration"
  ) {
    const durationFunction =
      duration === "hours"
        ? Sequelize.literal(
            `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        : Sequelize.literal(
            `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          );

    if (existingyaxis === "totalDuration") {
      attributes.push([Sequelize.fn("SUM", durationFunction), "yValue"]);
    } else if (existingyaxis === "averageDuration") {
      attributes.push([Sequelize.fn("AVG", durationFunction), "yValue"]);
    }
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${existingyaxis}`)),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  }

  // Get total count for pagination
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Deal.findAll({
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
    if (existingxaxis === "creator" || existingxaxis === "creatorstatus") {
      countColumn = Sequelize.col("assignedUser.masterUserID");
    } else if (existingxaxis === "contactPerson") {
      countColumn = Sequelize.col("Deal.personId");
    } else if (existingxaxis === "organization") {
      countColumn = Sequelize.col("Deal.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Deal.${existingxaxis}`);
    }

    totalCountResult = await Deal.findAll({
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
    const paginationAttributes = [];
    let groupColumn;
    
    if (shouldGroupByDuration) {
      groupColumn = getDateGroupExpression(existingxaxis, existingDurationUnit);
      paginationAttributes.push([groupColumn, "groupKey"]);
    } else {
      if (existingxaxis === "creator" || existingxaxis === "creatorstatus") {
        groupColumn = Sequelize.col("assignedUser.masterUserID");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "contactPerson") {
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: getOrderClause1(existingyaxis, duration),
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
        const groupExpression = getDateGroupExpression(existingxaxis, existingDurationUnit);
        groupCondition = Sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (existingxaxis === "creator" || existingxaxis === "creatorstatus") {
        groupCondition = { "$assignedUser.masterUserID$": { [Op.in]: groupKeys } };
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis, duration),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis, duration),
      limit: limit,
      offset: offset,
    });
  }

  // Format the results for the frontend
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const groupedData = {};

    results.forEach((item) => {
      let xValue = formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const dealCount = Number(item.dealCount) || 0;

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

      const segmentValue = formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
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
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
        deals: dealCount,
      });
    });

    formattedResults = Object.values(groupedData);

    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
      group.totalDeals = group.segments.reduce(
        (sum, seg) => sum + seg.deals,
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
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      if (existingxaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        existingxaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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
        deals: Number(item.dealCount) || 0,
      };
    });

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

// Helper function to generate activity performance data with pagination
async function generateDealDurationData(
  ownerId,
  role,
  xaxis,
  yaxis,
  duration,
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

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(xaxis);
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let groupBy = [];
  let attributes = ["personId", "leadOrganizationId"];

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
  } else if (xaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
  }

  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
    const isSegmentedByDate = isDateField(segmentedBy);
    const shouldSegmentByDuration = isSegmentedByDate && durationUnit && durationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(segmentedBy, durationUnit);
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
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
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "segmentValue"]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "segmentValue"]);
    } else {
      groupBy.push(`Deal.${segmentedBy}`);
      attributes.push([Sequelize.col(`Deal.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle yaxis - Duration calculations
  if (yaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (yaxis === "value") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.value")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (yaxis === "totalDuration" || yaxis === "averageDuration") {
    const durationFunction =
      duration === "hours"
        ? Sequelize.literal(
            `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        : Sequelize.literal(
            `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          );

    if (yaxis === "totalDuration") {
      attributes.push([Sequelize.fn("SUM", durationFunction), "yValue"]);
    } else if (yaxis === "averageDuration") {
      attributes.push([Sequelize.fn("AVG", durationFunction), "yValue"]);
    }
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  }

  // Get total count for pagination
  let totalCountResult;
  if (shouldGroupByDuration) {
    totalCountResult = await Deal.findAll({
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
    if (xaxis === "creator" || xaxis === "creatorstatus") {
      countColumn = Sequelize.col("assignedUser.masterUserID");
    } else if (xaxis === "contactPerson") {
      countColumn = Sequelize.col("Deal.personId");
    } else if (xaxis === "organization") {
      countColumn = Sequelize.col("Deal.leadOrganizationId");
    } else {
      countColumn = Sequelize.col(`Deal.${xaxis}`);
    }

    totalCountResult = await Deal.findAll({
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
    const paginationAttributes = [];
    let groupColumn;
    
    if (shouldGroupByDuration) {
      groupColumn = getDateGroupExpression(xaxis, durationUnit);
      paginationAttributes.push([groupColumn, "groupKey"]);
    } else {
      if (xaxis === "creator" || xaxis === "creatorstatus") {
        groupColumn = Sequelize.col("assignedUser.masterUserID");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "contactPerson") {
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: getOrderClause1(yaxis, duration),
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
        const groupExpression = getDateGroupExpression(xaxis, durationUnit);
        groupCondition = Sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (xaxis === "creator" || xaxis === "creatorstatus") {
        groupCondition = { "$assignedUser.masterUserID$": { [Op.in]: groupKeys } };
      } else if (xaxis === "contactPerson") {
        groupCondition = { personId: { [Op.in]: groupKeys } };
      } else if (xaxis === "organization") {
        groupCondition = { leadOrganizationId: { [Op.in]: groupKeys } };
      } else {
        groupCondition = { [xaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis, duration),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis, duration),
      limit: limit,
      offset: offset,
    });
  }

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    const groupedData = {};

    results.forEach((item) => {
      let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";
      const dealCount = Number(item.dealCount) || 0;

      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        xValue = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        xValue = "Unknown Organization";
      }

      const segmentValue = formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
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
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
        deals: dealCount,
      });
    });

    formattedResults = Object.values(groupedData);

    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
      group.totalDeals = group.segments.reduce(
        (sum, seg) => sum + seg.deals,
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
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, durationUnit) || "Unknown";

      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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
        deals: Number(item.dealCount) || 0,
      };
    });

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

// Helper function for order clause
function getOrderClause1(yaxis, duration) {
  if (yaxis === "no of deals") {
    return [[Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")), "DESC"]];
  } else if (yaxis === "proposalValue") {
    return [[Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")), "DESC"]];
  } else if (yaxis === "value") {
    return [[Sequelize.fn("SUM", Sequelize.col("Deal.value")), "DESC"]];
  } else if (yaxis === "totalDuration") {
    return [
      [
        Sequelize.fn(
          "SUM",
          Sequelize.literal(
            duration === "hours"
              ? `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
              : `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        ),
        "DESC",
      ],
    ];
  } else if (yaxis === "averageDuration") {
    return [
      [
        Sequelize.fn(
          "AVG",
          Sequelize.literal(
            duration === "hours"
              ? `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
              : `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        ),
        "DESC",
      ],
    ];
  } else {
    return [[Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)), "DESC"]];
  }
}

async function generateExistingDealDurationDataForSave(
  ownerId,
  role,
  existingxaxis,
  existingyaxis,
  duration,
  existingDurationUnit,
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

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(existingxaxis);
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let groupBy = [];
  let attributes = [];

  if (shouldGroupByDuration) {
    // Handle date grouping based on durationUnit
    const dateGroupExpression = getDateGroupExpression(existingxaxis, existingDurationUnit);
    attributes.push([dateGroupExpression, "xValue"]);
    groupBy.push(dateGroupExpression);
  } else if (existingxaxis === "creator") {
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
  } else if (existingxaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    groupBy.push(`Deal.${existingxaxis}`);
    attributes.push([Sequelize.col(`Deal.${existingxaxis}`), "xValue"]);
  }

  // Handle segmentedBy if not "none"
  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
    const isSegmentedByDate = isDateField(existingSegmentedBy);
    const shouldSegmentByDuration = isSegmentedByDate && existingDurationUnit && existingDurationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(existingSegmentedBy, existingDurationUnit);
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
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

    if (existingSegmentedBy === "Owner" || existingSegmentedBy === "assignedTo") {
      groupBy.push("assignedUser.name");
      attributes.push([Sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team") {
      groupBy.push("assignedUser.team");
      attributes.push([Sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "segmentValue"]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "segmentValue"]);
    } else {
      groupBy.push(`Deal.${existingSegmentedBy}`);
      attributes.push([
        Sequelize.col(`Deal.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis - Duration calculations
  if (existingyaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.value")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (
    existingyaxis === "totalDuration" ||
    existingyaxis === "averageDuration"
  ) {
    const durationFunction =
      duration === "hours"
        ? Sequelize.literal(
            `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        : Sequelize.literal(
            `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          );

    if (existingyaxis === "totalDuration") {
      attributes.push([Sequelize.fn("SUM", durationFunction), "yValue"]);
    } else if (existingyaxis === "averageDuration") {
      attributes.push([Sequelize.fn("AVG", durationFunction), "yValue"]);
    }
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${existingyaxis}`)),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  }

  let results;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const paginationAttributes = [];
    let groupColumn;
    
    if (shouldGroupByDuration) {
      groupColumn = getDateGroupExpression(existingxaxis, existingDurationUnit);
      paginationAttributes.push([groupColumn, "groupKey"]);
    } else {
      if (existingxaxis === "creator" || existingxaxis === "creatorstatus") {
        groupColumn = Sequelize.col("assignedUser.masterUserID");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "contactPerson") {
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: getOrderClause1(existingyaxis, duration),
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };
      let groupCondition;

      if (shouldGroupByDuration) {
        const groupExpression = getDateGroupExpression(existingxaxis, existingDurationUnit);
        groupCondition = Sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (existingxaxis === "creator" || existingxaxis === "creatorstatus") {
        groupCondition = { "$assignedUser.masterUserID$": { [Op.in]: groupKeys } };
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

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis, duration),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${existingxaxis}`), "ASC"]]
          : getOrderClause(existingyaxis, existingxaxis, duration),
    });
  }

  // Format the results for the frontend
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    const groupedData = {};

    results.forEach((item) => {
      let xValue = formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const dealCount = Number(item.dealCount) || 0;

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

      const segmentValue = formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
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
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
        deals: dealCount,
      });
    });

    formattedResults = Object.values(groupedData);

    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
      group.totalDeals = group.segments.reduce(
        (sum, seg) => sum + seg.deals,
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
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, existingDurationUnit) || "Unknown";

      if (existingxaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        existingxaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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
        deals: Number(item.dealCount) || 0,
      };
    });

    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  return {
    data: formattedResults,
    totalValue: totalValue
  };
}

async function generateDealDurationDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  duration,
  durationUnit,
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

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX = isDateField(xaxis);
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

  // Handle special cases for xaxis (like Owner which needs join) and date fields
  let groupBy = [];
  let attributes = ["personId", "leadOrganizationId"];

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
  } else if (xaxis === "contactPerson") {
    includeModels.push({
      model: Person,
      as: "Person",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.personId");
    attributes.push([Sequelize.col("Deal.personId"), "personId"]);
    attributes.push([Sequelize.col("Person.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    includeModels.push({
      model: Organization,
      as: "Organization",
      attributes: [],
      required: false,
    });
    groupBy.push("Deal.leadOrganizationId");
    attributes.push([
      Sequelize.col("Deal.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([Sequelize.col("Organization.organization"), "xValue"]);
  } else {
    groupBy.push(`Deal.${xaxis}`);
    attributes.push([Sequelize.col(`Deal.${xaxis}`), "xValue"]);
  }

  if (segmentedBy && segmentedBy !== "none") {
    const assignedUserIncludeExists = includeModels.some(
      (inc) => inc.as === "assignedUser"
    );

    // Check if segmentedBy is also a date field
    const isSegmentedByDate = isDateField(segmentedBy);
    const shouldSegmentByDuration = isSegmentedByDate && durationUnit && durationUnit !== "none";

    if (shouldSegmentByDuration) {
      const segmentDateExpression = getDateGroupExpression(segmentedBy, durationUnit);
      attributes.push([segmentDateExpression, "segmentValue"]);
      groupBy.push(segmentDateExpression);
    } else if (
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
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "Person",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.personId");
      attributes.push([Sequelize.col("Deal.personId"), "personId"]);
      attributes.push([Sequelize.col("Person.contactPerson"), "segmentValue"]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "Organization",
        attributes: [],
        required: false,
      });
      groupBy.push("Deal.leadOrganizationId");
      attributes.push([
        Sequelize.col("Deal.leadOrganizationId"),
        "leadOrganizationId",
      ]);
      attributes.push([Sequelize.col("Organization.organization"), "segmentValue"]);
    } else {
      groupBy.push(`Deal.${segmentedBy}`);
      attributes.push([Sequelize.col(`Deal.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle yaxis - Duration calculations
  if (yaxis === "no of deals") {
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.proposalValue")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (yaxis === "value") {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col("Deal.value")),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else if (yaxis === "totalDuration" || yaxis === "averageDuration") {
    const durationFunction =
      duration === "hours"
        ? Sequelize.literal(
            `TIMESTAMPDIFF(HOUR, Deal.proposalSentDate, Deal.expectedCloseDate)`
          )
        : Sequelize.literal(
            `TIMESTAMPDIFF(DAY, Deal.proposalSentDate, Deal.expectedCloseDate)`
          );

    if (yaxis === "totalDuration") {
      attributes.push([Sequelize.fn("SUM", durationFunction), "yValue"]);
    } else if (yaxis === "averageDuration") {
      attributes.push([Sequelize.fn("AVG", durationFunction), "yValue"]);
    }
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  } else {
    attributes.push([
      Sequelize.fn("SUM", Sequelize.col(`Deal.${yaxis}`)),
      "yValue",
    ]);
    attributes.push([
      Sequelize.fn("COUNT", Sequelize.col("Deal.dealId")),
      "dealCount",
    ]);
  }

  let results;

  if (segmentedBy && segmentedBy !== "none") {
    const paginationAttributes = [];
    let groupColumn;
    
    if (shouldGroupByDuration) {
      groupColumn = getDateGroupExpression(xaxis, durationUnit);
      paginationAttributes.push([groupColumn, "groupKey"]);
    } else {
      if (xaxis === "creator" || xaxis === "creatorstatus") {
        groupColumn = Sequelize.col("assignedUser.masterUserID");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "contactPerson") {
        groupColumn = Sequelize.col("Deal.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = Sequelize.col("Deal.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = Sequelize.col(`Deal.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Deal.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: getOrderClause1(yaxis, duration),
      raw: true,
    });

    const groupKeys = paginatedGroups.map((g) => g.groupKey);

    if (groupKeys.length === 0) {
      results = [];
    } else {
      const finalWhere = { ...baseWhere };
      let groupCondition;

      if (shouldGroupByDuration) {
        const groupExpression = getDateGroupExpression(xaxis, durationUnit);
        groupCondition = Sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (xaxis === "creator" || xaxis === "creatorstatus") {
        groupCondition = { "$assignedUser.masterUserID$": { [Op.in]: groupKeys } };
      } else if (xaxis === "contactPerson") {
        groupCondition = { personId: { [Op.in]: groupKeys } };
      } else if (xaxis === "organization") {
        groupCondition = { leadOrganizationId: { [Op.in]: groupKeys } };
      } else {
        groupCondition = { [xaxis]: { [Op.in]: groupKeys } };
      }

      finalWhere[Op.and] = finalWhere[Op.and]
        ? [...finalWhere[Op.and], groupCondition]
        : [groupCondition];

      results = await Deal.findAll({
        where: finalWhere,
        attributes: attributes,
        include: includeModels,
        group: groupBy,
        raw: true,
        order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis, duration),
      });
    }
  } else {
    results = await Deal.findAll({
      where: baseWhere,
      attributes: attributes,
      include: includeModels,
      group: groupBy,
      raw: true,
      order: isDateFieldX 
          ? [[Sequelize.col(`Deal.${xaxis}`), "ASC"]]
          : getOrderClause(yaxis, xaxis, duration),
    });
  }

  // Format the results based on whether segmentedBy is used
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    const groupedData = {};

    results.forEach((item) => {
      let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";
      const dealCount = Number(item.dealCount) || 0;

      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        xValue = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        xValue = "Unknown Organization";
      }

      const segmentValue = formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
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
      groupedData[xValue].segments.push({
        labeltype: segmentValue,
        value: yValue,
        deals: dealCount,
      });
    });

    formattedResults = Object.values(groupedData);

    formattedResults.forEach((group) => {
      group.totalSegmentValue = group.segments.reduce(
        (sum, seg) => sum + seg.value,
        0
      );
      group.totalDeals = group.segments.reduce(
        (sum, seg) => sum + seg.deals,
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
    formattedResults = results.map((item) => {
      let label = formatDateValue(item.xValue, durationUnit) || "Unknown";

      if (xaxis === "contactPerson" && !item.xValue && item.personId) {
        label = "Unknown Contact";
      } else if (
        xaxis === "organization" &&
        !item.xValue &&
        item.leadOrganizationId
      ) {
        label = "Unknown Organization";
      }

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
        deals: Number(item.dealCount) || 0,
      };
    });

    totalValue = formattedResults.reduce((sum, item) => sum + item.value, 0);
  }

  return {
    data: formattedResults,
    totalValue: totalValue
  };
}

exports.saveDealDurationReport = async (req, res) => {
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
      duration = "days",
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
      if (entity === "Deal" && type === "Duration") {
        // Validate required fields for performance reports
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message: "X-axis and Y-axis are required for Deal Duartion reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateDealDurationDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            duration,
            durationUnit,
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
            durationUnit,
            segmentedBy,
            filters: filters || {},
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating Deal Duartion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Deal Duartion data",
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

      if (existingentity === "Deal" && existingtype === "Duartion") {
        if (!existingxaxis || !existingyaxis) {
          return res.status(400).json({
            success: false,
            message: "X-axis and Y-axis are required for Deal Duartion reports",
          });
        }

        try {
          const result = await generateExistingDealDurationDataForSave(
            ownerId,
            role,
            existingxaxis,
            existingyaxis,
            duration,
            existingDurationUnit,
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
            durationUnit: existingDurationUnit,
            segmentedBy: existingSegmentedBy,
            filters: existingfilters || {},
            graphtype: existinggraphtype,
            colors: colorsParsed,
            reportData,
            totalValue,
          };
        } catch (error) {
          console.error("Error generating Deal Progress data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate Deal Progress data",
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

exports.getDealDurationReportSummary = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      duration = "days",
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
        // { ownerName: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { pipeline: { [Op.like]: `%${search}%` } },
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
      const reportResult = await generateDealDurationData(
        ownerId,
        role,
        xaxis,
        yaxis,
        duration,
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

      const reportResult = await generateExistingDealDurationData(
        ownerId,
        role,
        existingxaxis,
        existingyaxis,
        duration,
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
      },
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
    console.error("Error retrieving deals data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve deals data",
      error: error.message,
    });
  }
};

exports.createFunnelDealConversionReport = async (req, res) => {
  try {
    const {
      reportId,
      entity,
      type,
      xaxis,
      yaxis,
      pipelineStages = [
        "qualified",
        "contract made",
        "proposal made",
        "negotiation started",
        "won",
      ],
      filters,
      page = 1,
      limit = 8,
    } = req.body;

    const ownerId = req.adminId;
    const role = req.role;

    // Define available options
    const xaxisArray = [
      "qualified",
      "contract made",
      "proposal made",
      "negotiation started",
      "won",
    ];
    const yaxisArray = ["no of deals", "proposalValue", "value"];

    // For Funnel Conversion reports, generate the data
    let reportData = null;
    let paginationInfo = null;

    if ((entity && type && !reportId) || (entity && type && reportId)) {
      if (entity === "Deal" && type === "FunnelConversion") {
        // Validate required fields
        if (!xaxis || !yaxis) {
          return res.status(400).json({
            success: false,
            message:
              "X-axis and Y-axis are required for Deal Funnel Conversion reports",
          });
        }

        try {
          // Generate data with pagination
          const result = await generateFunnelConversionData(
            ownerId,
            role,
            xaxis,
            yaxis,
            pipelineStages,
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
            pipelineStages,
            filters: filters || {},
          };
        } catch (error) {
          console.error("Error generating deal Funnel Conversion data:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to generate deal Funnel Conversion data",
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
        pipelineStages: xaxisArray,
      },
    });
  } catch (error) {
    console.error("Error creating funnel reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create funnel reports",
      error: error.message,
    });
  }
};

// Helper function to generate funnel conversion data
async function generateFunnelConversionData(
  ownerId,
  role,
  xaxis,
  yaxis,
  pipelineStages,
  filters,
  page = 1,
  limit = 8
) {
  // Base where condition
  const baseWhereConditions = [
    {
      pipeline: "climate change",
      [Op.or]: [
        { pipelineStage: { [Op.in]: pipelineStages } },
        { status: { [Op.in]: pipelineStages.includes("won") ? ["won"] : [] } },
      ],
    },
  ];

  // If user is not admin, filter by ownerId
  if (role !== "admin") {
    baseWhereConditions.push({
      masterUserID: ownerId,
    });
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

      baseWhereConditions.push(combinedCondition);
    }
  }

  // Create the final where condition
  const baseWhere =
    baseWhereConditions.length > 1
      ? { [Op.and]: baseWhereConditions }
      : baseWhereConditions[0];

  // Get data for each pipeline stage
  const stageData = {};
  const conversionRates = {};

  for (const stage of pipelineStages) {
    let whereCondition;

    if (stage === "won") {
      whereCondition = {
        ...baseWhere,
        status: "won",
      };
    } else {
      whereCondition = {
        ...baseWhere,
        pipelineStage: stage,
      };
    }

    // Select appropriate attributes based on yaxis
    let attributes;
    if (yaxis === "no of deals") {
      attributes = [[Sequelize.fn("COUNT", Sequelize.col("dealId")), "count"]];
    } else if (yaxis === "proposalValue") {
      attributes = [
        [Sequelize.fn("SUM", Sequelize.col("proposalValue")), "total"],
      ];
    } else if (yaxis === "value") {
      attributes = [[Sequelize.fn("SUM", Sequelize.col("value")), "total"]];
    }

    const result = await Deal.findAll({
      where: whereCondition,
      attributes: attributes,
      raw: true,
    });

    const data = result[0] || { count: 0, total: 0 };

    if (yaxis === "no of deals") {
      stageData[stage] = parseInt(data.count) || 0;
    } else {
      stageData[stage] = parseFloat(data.total) || 0;
    }
  }

  // Calculate conversion rates between stages based on selected yaxis
  const stages = [
    "qualified",
    "contract made",
    "proposal made",
    "negotiation started",
    "won",
  ];

  for (let i = 0; i < stages.length - 1; i++) {
    const currentStage = stages[i];
    const nextStage = stages[i + 1];

    if (
      pipelineStages.includes(currentStage) &&
      pipelineStages.includes(nextStage)
    ) {
      const currentValue = stageData[currentStage];
      const nextValue = stageData[nextStage];

      // Calculate conversion rate based on the selected yaxis
      if (yaxis === "no of deals") {
        // For count-based conversion (next stage count / current stage count)
        conversionRates[`${currentStage}_to_${nextStage}`] =
          currentValue > 0 ? Math.round((nextValue / currentValue) * 100) : 0;
      } else {
        // For value-based conversion (next stage value / current stage value)
        conversionRates[`${currentStage}_to_${nextStage}`] =
          currentValue > 0 ? Math.round((nextValue / currentValue) * 100) : 0;
      }
    }
  }

  // Format the response based on yaxis selection
  let formattedData = [];

  for (const stage of pipelineStages) {
    if (stageData[stage] !== undefined) {
      const stageObj = { stage: stage };

      if (yaxis === "no of deals") {
        stageObj.noOfDeals = stageData[stage];
      } else if (yaxis === "proposalValue") {
        stageObj.proposalValue = stageData[stage];
      } else if (yaxis === "value") {
        stageObj.value = stageData[stage];
      }

      formattedData.push(stageObj);
    }
  }

  // Get total count for pagination (total distinct stages)
  const totalCount = pipelineStages.length;
  const totalPages = Math.ceil(totalCount / limit);

  // Apply pagination
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, formattedData.length);
  const paginatedData = formattedData.slice(startIndex, endIndex);

  return {
    data: {
      stages: paginatedData,
      conversionRates: conversionRates,
    },
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
