const DASHBOARD = require("../../../models/insight/dashboardModel");
const Report = require("../../../models/insight/reportModel");
const Deal = require("../../../models/deals/dealsModels");
const Lead = require("../../../models/leads/leadsModel");
const Organization = require("../../../models/leads/leadOrganizationModel");
const Person = require("../../../models/leads/leadPersonModel");
const MasterUser = require("../../../models/master/masterUserModel");
const ReportFolder = require("../../../models/insight/reportFolderModel");
const { Op } = require("sequelize");
const sequelize = require("../../../config/db");
const CustomField = require("../../../models/customFieldModel");
const CustomFieldValue = require("../../../models/customFieldValueModel");

exports.createLeadPerformReport = async (req, res) => {
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

    // Fetch custom fields for lead entity and related entities
    const leadCustomFields = await CustomField.findAll({
      where: {
        entityType: "lead",
        masterUserID: role === "admin" ? { [Op.ne]: null } : ownerId,
        isActive: true,
      },
      order: [
        ["displayOrder", "ASC"],
        ["fieldLabel", "ASC"],
      ],
    });

    // Fetch custom fields for related entities
    const relatedCustomFields = await CustomField.findAll({
      where: {
        entityType: {
          [Op.in]: ["organization", "person", "deal"],
        },
        masterUserID: role === "admin" ? { [Op.ne]: null } : ownerId,
        isActive: true,
      },
      order: [
        ["entityType", "ASC"],
        ["displayOrder", "ASC"],
      ],
    });

    // Helper function to map custom field type to category
    const getFieldTypeCategory = (fieldType) => {
      const dateTypes = ["date", "datetime", "daterange", "timerange"];
      if (dateTypes.includes(fieldType)) {
        return "Date";
      }
      return "Lead";
    };

    // Helper function to map custom field type to filter type
    const mapCustomFieldTypeToFilterType = (fieldType) => {
      const typeMap = {
        text: "text",
        textarea: "text",
        number: "number",
        decimal: "number",
        email: "text",
        phone: "text",
        url: "text",
        date: "date",
        datetime: "date",
        daterange: "daterange",
        timerange: "daterange",
        time: "text",
        select: "text",
        singleselect: "text",
        multiselect: "text",
        checkbox: "text",
        radio: "text",
        file: "text",
        currency: "text",
        organization: "text",
        person: "text",
        address: "text",
        largetext: "text",
        autocomplete: "text",
      };
      return typeMap[fieldType] || "text";
    };

    // Build xaxis options with custom fields
    const standardXaxisOptions = [
    //   {
    //     label: "ESPL Proposal No",
    //     value: "esplProposalNo",
    //     type: "Lead",
    //     isCustom: false,
    //   },
    //   {
    //     label: "No of reports prepared",
    //     value: "numberOfReportsPrepared",
    //     type: "Lead",
    //     isCustom: false,
    //   },
    //   {
    //     label: "Organization Country",
    //     value: "organizationCountry",
    //     type: "Lead",
    //     isCustom: false,
    //   },
    //   {
    //     label: "Project Location",
    //     value: "projectLocation",
    //     type: "Lead",
    //     isCustom: false,
    //   },
      {
        label: "Owner Name",
        value: "ownerName",
        type: "Lead",
        isCustom: false,
      },
    //   { label: "SBU Class", value: "SBUClass", type: "Lead", isCustom: false },
    //   { label: "Status", value: "status", type: "Lead", isCustom: false },
    //   {
    //     label: "Scope of Service Type",
    //     value: "scopeOfServiceType",
    //     type: "Lead",
    //     isCustom: false,
    //   },
    //   {
    //     label: "Service Type",
    //     value: "serviceType",
    //     type: "Lead",
    //     isCustom: false,
    //   },
      {
        label: "Source Channel",
        value: "sourceChannel",
        type: "Lead",
        isCustom: false,
      },
      {
        label: "Source Channel Id",
        value: "sourceChannelID",
        type: "Lead",
        isCustom: false,
      },
      {
        label: "Source Origin",
        value: "sourceOrigin",
        type: "Lead",
        isCustom: false,
      },
      {
        label: "Source Origin Id",
        value: "sourceOriginID",
        type: "Lead",
        isCustom: false,
      },
      {
        label: "Contact Person",
        value: "contactPerson",
        type: "Lead",
        isCustom: false,
      },
      {
        label: "Organization",
        value: "organization",
        type: "Lead",
        isCustom: false,
      },
      {
        label: "Proposal Value Currency",
        value: "proposalValueCurrency",
        type: "Lead",
        isCustom: false,
      },
      { label: "Creator", value: "creator", type: "Lead", isCustom: false },
      {
        label: "Creator Status",
        value: "creatorstatus",
        type: "Lead",
        isCustom: false,
      },
      {
        label: "Proposal Sent Date",
        value: "proposalSentDate",
        type: "Date",
        isCustom: false,
      },
      {
        label: "Conversion Date",
        value: "conversionDate",
        type: "Date",
        isCustom: false,
      },
      { label: "Add on", value: "createdAt", type: "Date", isCustom: false },
      { label: "Update on", value: "updatedAt", type: "Date", isCustom: false },
    ];

    const xaxisArray = [...standardXaxisOptions];

    // Add lead custom fields to xaxis options
    leadCustomFields.forEach((field) => {
      xaxisArray.push({
        label: field.fieldLabel,
        value: `custom_${field.fieldId}`,
        type: getFieldTypeCategory(field.fieldType),
        isCustom: true,
        customFieldId: field.fieldId,
        customFieldType: field.fieldType,
        fieldName: field.fieldName,
      });
    });

    // Build segmentedBy options
    const standardSegmentedByOptions = [
      { label: "None", value: "none", isCustom: false },
    //   { label: "ESPL Proposal No", value: "esplProposalNo", isCustom: false },
    //   {
    //     label: "No of reports prepared",
    //     value: "numberOfReportsPrepared",
    //     isCustom: false,
    //   },
    //   {
    //     label: "Organization Country",
    //     value: "organizationCountry",
    //     isCustom: false,
    //   },
    //   { label: "Project Location", value: "projectLocation", isCustom: false },
      { label: "Owner Name", value: "ownerName", isCustom: false },
    //   { label: "SBU Class", value: "SBUClass", isCustom: false },
      { label: "Status", value: "status", isCustom: false },
    //   {
    //     label: "Scope of Service Type",
    //     value: "scopeOfServiceType",
    //     isCustom: false,
    //   },
    //   { label: "Service Type", value: "serviceType", isCustom: false },
      { label: "Source Channel", value: "sourceChannel", isCustom: false },
      { label: "Source Channel Id", value: "sourceChannelID", isCustom: false },
      { label: "Source Origin", value: "sourceOrigin", isCustom: false },
      { label: "Source Origin Id", value: "sourceOriginID", isCustom: false },
      { label: "Contact Person", value: "contactPerson", isCustom: false },
      { label: "Organization", value: "organization", isCustom: false },
      {
        label: "Proposal Value Currency",
        value: "proposalValueCurrency",
        isCustom: false,
      },
      { label: "Creator", value: "creator", isCustom: false },
      { label: "Creator Status", value: "creatorstatus", isCustom: false },
    ];

    const segmentedByOptions = [...standardSegmentedByOptions];

    // Add lead custom fields to segmentedBy options
    leadCustomFields.forEach((field) => {
      segmentedByOptions.push({
        label: field.fieldLabel,
        value: `custom_${field.fieldId}`,
        isCustom: true,
        customFieldId: field.fieldId,
        customFieldType: field.fieldType,
        fieldName: field.fieldName,
      });
    });

    const yaxisArray = [
      { label: "No of Leads", value: "no of leads", type: "Lead" },
      { label: "Proposal Value", value: "proposalValue", type: "Lead" },
      { label: "Value", value: "value", type: "Lead" },
    ];

    // Build available filter columns with custom fields
    const availableFilterColumns = {
      Lead: [
        // Standard Lead fields
        // { label: "ESPL Proposal No", value: "esplProposalNo", type: "number" },
        // {
        //   label: "No of Reports",
        //   value: "numberOfReportsPrepared",
        //   type: "number",
        // },
        // {
        //   label: "Organization Country",
        //   value: "organizationCountry",
        //   type: "text",
        // },
        // { label: "Project Location", value: "projectLocation", type: "text" },
        {
          label: "Proposal Sent Date",
          value: "proposalSentDate",
          type: "date",
        },
        { label: "Owner Name", value: "ownerName", type: "text" },
        // { label: "SBU Class", value: "SBUClass", type: "text" },
        { label: "Status", value: "status", type: "text" },
        // {
        //   label: "Scope Of Service Type",
        //   value: "scopeOfServiceType",
        //   type: "text",
        // },
        // { label: "Service Type", value: "serviceType", type: "text" },
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

        // Lead custom fields
        ...leadCustomFields.map((field) => ({
          label: field.fieldLabel,
          value: `custom_${field.fieldId}`,
          type: mapCustomFieldTypeToFilterType(field.fieldType),
          isCustom: true,
          customFieldId: field.fieldId,
          customFieldType: field.fieldType,
          fieldName: field.fieldName,
          options: field.options || null,
        })),
      ],
      Organization: [
        // Standard Organization fields
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
        // Standard Person fields
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
            leadCustomFields
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
          leadCustomFields
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

// =============== HELPER FUNCTIONS ===============

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
  leadCustomFields = []
) {
  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Check if xaxis is a custom field
  const isCustomFieldX = existingxaxis.startsWith("custom_");
  let customFieldX = null;
  if (isCustomFieldX) {
    const fieldId = parseInt(existingxaxis.replace("custom_", ""));
    customFieldX = leadCustomFields.find((f) => f.fieldId === fieldId);
  }

  // Check if segmentedBy is a custom field
  const isSegmentedByCustom =
    existingSegmentedBy && existingSegmentedBy.startsWith("custom_");
  let customFieldSegmentedBy = null;
  if (isSegmentedByCustom) {
    const fieldId = parseInt(existingSegmentedBy.replace("custom_", ""));
    customFieldSegmentedBy = leadCustomFields.find(
      (f) => f.fieldId === fieldId
    );
  }

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX =
    isDateField(existingxaxis) ||
    (customFieldX && isCustomDateField(customFieldX));
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  // Build base query
  let baseQuery = buildBaseQuery(
    existingxaxis,
    existingyaxis,
    existingSegmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy
  );

  // Add where conditions
  let whereConditions = buildWhereConditions(
    ownerId,
    role,
    existingxaxis,
    isCustomFieldX,
    existingSegmentedBy,
    isSegmentedByCustom,
    filters,
    leadCustomFields
  );

  // Add where clause if conditions exist
  if (whereConditions.length > 0) {
    baseQuery += ` WHERE ` + whereConditions.join(" AND ");
  }

  // Build group by clause
  let groupByClause = buildGroupByClause(
    existingxaxis,
    existingSegmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy,
    shouldGroupByDuration,
    existingDurationUnit
  );

  // Build order by clause
  let orderByClause = buildOrderByClause(
    existingxaxis,
    existingyaxis,
    isDateFieldX,
    isCustomFieldX
  );

  // Get total count
  const countQuery = buildCountQuery(
    existingxaxis,
    isCustomFieldX,
    customFieldX,
    whereConditions,
    existingSegmentedBy,
    isSegmentedByCustom,
    customFieldSegmentedBy
  );

  // Execute count query
  const countResult = await sequelize.query(countQuery, {
    type: sequelize.QueryTypes.SELECT,
  });
  const totalCount = parseInt(countResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  // Build final query with pagination
  let finalQuery = baseQuery + " " + groupByClause + " " + orderByClause;

  // Add pagination
  finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;

  // Execute main query
  const results = await sequelize.query(finalQuery, {
    type: sequelize.QueryTypes.SELECT,
  });

  // Format the results
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};

    results.forEach((item) => {
      let xValue =
        formatDateValue(item.xValue, existingDurationUnit) || "Unknown";
      const segmentValue = item.segmentValue ? 
        formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown" : 
        "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: {},
          id: null,
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

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: null,
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
  leadCustomFields = []
) {
  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Check if xaxis is a custom field
  const isCustomFieldX = xaxis.startsWith("custom_");
  let customFieldX = null;
  if (isCustomFieldX) {
    const fieldId = parseInt(xaxis.replace("custom_", ""));
    customFieldX = leadCustomFields.find((f) => f.fieldId === fieldId);
  }

  // Check if segmentedBy is a custom field
  const isSegmentedByCustom = segmentedBy && segmentedBy.startsWith("custom_");
  let customFieldSegmentedBy = null;
  if (isSegmentedByCustom) {
    const fieldId = parseInt(segmentedBy.replace("custom_", ""));
    customFieldSegmentedBy = leadCustomFields.find(
      (f) => f.fieldId === fieldId
    );
  }

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX =
    isDateField(xaxis) || (customFieldX && isCustomDateField(customFieldX));
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

  // Build base query
  let baseQuery = buildBaseQuery(
    xaxis,
    yaxis,
    segmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy
  );

  // Add where conditions
  let whereConditions = buildWhereConditions(
    ownerId,
    role,
    xaxis,
    isCustomFieldX,
    segmentedBy,
    isSegmentedByCustom,
    filters,
    leadCustomFields
  );

  // Add where clause if conditions exist
  if (whereConditions.length > 0) {
    baseQuery += ` WHERE ` + whereConditions.join(" AND ");
  }

  // Build group by clause
  let groupByClause = buildGroupByClause(
    xaxis,
    segmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy,
    shouldGroupByDuration,
    durationUnit
  );

  // Build order by clause
  let orderByClause = buildOrderByClause(
    xaxis,
    yaxis,
    isDateFieldX,
    isCustomFieldX
  );

  // Get total count
  const countQuery = buildCountQuery(
    xaxis,
    isCustomFieldX,
    customFieldX,
    whereConditions,
    segmentedBy,
    isSegmentedByCustom,
    customFieldSegmentedBy
  );

  // Execute count query
  const countResult = await sequelize.query(countQuery, {
    type: sequelize.QueryTypes.SELECT,
  });
  const totalCount = parseInt(countResult[0]?.total || 0);
  const totalPages = Math.ceil(totalCount / limit);

  // Build final query with pagination
  let finalQuery = baseQuery + " " + groupByClause + " " + orderByClause;

  // Add pagination
  finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;

  // Execute main query
  const results = await sequelize.query(finalQuery, {
    type: sequelize.QueryTypes.SELECT,
  });

  // Format the results
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue
    const groupedData = {};

    results.forEach((item) => {
      let xValue = formatDateValue(item.xValue, durationUnit) || "Unknown";
      const segmentValue = item.segmentValue ? 
        formatDateValue(item.segmentValue, durationUnit) || "Unknown" : 
        "Unknown";
      const yValue = Number(item.yValue) || 0;

      if (!groupedData[xValue]) {
        groupedData[xValue] = {
          label: xValue,
          segments: {},
          id: null,
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

      return {
        label: label,
        value: Number(item.yValue) || 0,
        id: null,
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

// =============== SQL QUERY BUILDING FUNCTIONS ===============

function buildBaseQuery(
  xaxis,
  yaxis,
  segmentedBy,
  isCustomFieldX,
  customFieldX,
  isSegmentedByCustom,
  customFieldSegmentedBy
) {
  let baseQuery = `
    SELECT 
      leadId,
      ${
        isCustomFieldX && customFieldX
          ? `cfx.value as xValue`
          : `Lead.${xaxis} as xValue`
      },
      ${
        isSegmentedByCustom && customFieldSegmentedBy && segmentedBy !== "none"
          ? `cfs.value as segmentValue`
          : segmentedBy !== "none"
          ? `Lead.${segmentedBy} as segmentValue`
          : "NULL as segmentValue"
      },
      ${getYAxisSelect(yaxis)}
    FROM Leads as Lead
  `;

  // Add custom field joins if needed
  if (isCustomFieldX && customFieldX) {
    baseQuery += `
      LEFT JOIN CustomFieldValues as cfx ON Lead.leadId = cfx.entityId 
        AND cfx.fieldId = ${customFieldX.fieldId} 
        AND cfx.entityType = 'lead'
    `;
  }

  if (isSegmentedByCustom && customFieldSegmentedBy && segmentedBy !== "none") {
    // Only add this join if it's not already added for xaxis
    if (!(isCustomFieldX && customFieldX && customFieldX.fieldId === customFieldSegmentedBy.fieldId)) {
      baseQuery += `
        LEFT JOIN CustomFieldValues as cfs ON Lead.leadId = cfs.entityId 
          AND cfs.fieldId = ${customFieldSegmentedBy.fieldId} 
          AND cfs.entityType = 'lead'
      `;
    } else {
      // If it's the same field for both xaxis and segmentedBy, use the same alias
      baseQuery = baseQuery.replace(/cfs.value as segmentValue/, `cfx.value as segmentValue`);
    }
  }

  return baseQuery;
}

function buildWhereConditions(
  ownerId,
  role,
  xaxis,
  isCustomFieldX,
  segmentedBy,
  isSegmentedByCustom,
  filters,
  leadCustomFields
) {
  let whereConditions = [];

  // Owner filter
  if (role !== "admin") {
    whereConditions.push(`Lead.masterUserID = ${ownerId}`);
  }

  // Exclude null values for xaxis ONLY (not for segmentedBy)
  if (isCustomFieldX) {
    whereConditions.push(`cfx.value IS NOT NULL AND cfx.value != ''`);
  } else if (xaxis === "contactPerson") {
    whereConditions.push(`Lead.personId IS NOT NULL`);
  } else if (xaxis === "organization") {
    whereConditions.push(`Lead.leadOrganizationId IS NOT NULL`);
  } else if (isDateField(xaxis)) {
    // For date fields, ensure they're not null
    whereConditions.push(`Lead.${xaxis} IS NOT NULL`);
  } else if (xaxis) {
    // Only exclude null/empty for xaxis, not for segmentedBy
    whereConditions.push(`Lead.${xaxis} IS NOT NULL AND Lead.${xaxis} != ''`);
  }

  // Handle filters
  if (filters && filters.conditions) {
    const validConditions = filters.conditions.filter(
      (cond) => cond.value !== undefined && cond.value !== ""
    );

    // Build filter joins and conditions
    const filterJoins = new Set();
    validConditions.forEach((cond, index) => {
      const filterCondition = getFilterCondition(cond, leadCustomFields, index);
      if (filterCondition.condition) {
        whereConditions.push(filterCondition.condition);
      }
      if (filterCondition.join) {
        filterJoins.add(filterCondition.join);
      }
    });

    // Add filter joins to the base query (handled separately)
  }

  return whereConditions;
}

function buildGroupByClause(
  xaxis,
  segmentedBy,
  isCustomFieldX,
  customFieldX,
  isSegmentedByCustom,
  customFieldSegmentedBy,
  shouldGroupByDuration,
  durationUnit
) {
  let groupByClause = "";

  if (shouldGroupByDuration) {
    if (isCustomFieldX && customFieldX) {
      groupByClause = `GROUP BY ${getCustomDateGroupExpressionSQL(
        "cfx.value",
        durationUnit
      )}`;
    } else {
      groupByClause = `GROUP BY ${getDateGroupExpressionSQL(
        `Lead.${xaxis}`,
        durationUnit
      )}`;
    }
  } else {
    if (isCustomFieldX && customFieldX) {
      groupByClause = `GROUP BY cfx.value`;
    } else {
      groupByClause = `GROUP BY Lead.${xaxis}`;
    }
  }

  // Add segmentedBy to group by if needed
  if (segmentedBy && segmentedBy !== "none") {
    if (
      shouldGroupByDuration &&
      isSegmentedByCustom &&
      customFieldSegmentedBy
    ) {
      groupByClause += `, ${getCustomDateGroupExpressionSQL(
        "cfs.value",
        durationUnit
      )}`;
    } else if (shouldGroupByDuration) {
      groupByClause += `, ${getDateGroupExpressionSQL(
        `Lead.${segmentedBy}`,
        durationUnit
      )}`;
    } else if (isSegmentedByCustom && customFieldSegmentedBy) {
      // Check if it's the same field as xaxis
      if (isCustomFieldX && customFieldX && customFieldX.fieldId === customFieldSegmentedBy.fieldId) {
        groupByClause += `, cfx.value`;
      } else {
        groupByClause += `, cfs.value`;
      }
    } else {
      groupByClause += `, Lead.${segmentedBy}`;
    }
  }

  return groupByClause;
}

function buildOrderByClause(xaxis, yaxis, isDateFieldX, isCustomFieldX) {
  let orderByClause = "";

  if (isDateFieldX) {
    if (isCustomFieldX) {
      orderByClause = `ORDER BY cfx.value ASC`;
    } else {
      orderByClause = `ORDER BY Lead.${xaxis} ASC`;
    }
  } else {
    if (yaxis === "no of leads") {
      orderByClause = `ORDER BY COUNT(leadId) DESC`;
    } else if (yaxis === "proposalValue") {
      orderByClause = `ORDER BY SUM(proposalValue) DESC`;
    } else if (yaxis === "value") {
      orderByClause = `ORDER BY SUM(value) DESC`;
    } else {
      orderByClause = `ORDER BY SUM(Lead.${yaxis}) DESC`;
    }
  }

  return orderByClause;
}

function buildCountQuery(
  xaxis,
  isCustomFieldX,
  customFieldX,
  whereConditions,
  segmentedBy,
  isSegmentedByCustom,
  customFieldSegmentedBy
) {
  let countQuery = `
    SELECT COUNT(DISTINCT 
      CASE 
        WHEN ${isCustomFieldX && customFieldX ? "cfx.value" : `Lead.${xaxis}`} IS NOT NULL 
        AND ${isCustomFieldX && customFieldX ? "cfx.value" : `Lead.${xaxis}`} != ''
        THEN ${isCustomFieldX && customFieldX ? "cfx.value" : `Lead.${xaxis}`}
        ELSE NULL
      END
    ) as total
    FROM Leads as Lead
  `;

  if (isCustomFieldX && customFieldX) {
    countQuery += `
      LEFT JOIN CustomFieldValues as cfx ON Lead.leadId = cfx.entityId 
        AND cfx.fieldId = ${customFieldX.fieldId} 
        AND cfx.entityType = 'lead'
    `;
  }

  // Add segmentedBy custom field join if different from xaxis
  if (isSegmentedByCustom && customFieldSegmentedBy) {
    if (!(isCustomFieldX && customFieldX && customFieldX.fieldId === customFieldSegmentedBy.fieldId)) {
      countQuery += `
        LEFT JOIN CustomFieldValues as cfs ON Lead.leadId = cfs.entityId 
          AND cfs.fieldId = ${customFieldSegmentedBy.fieldId} 
          AND cfs.entityType = 'lead'
      `;
    }
  }

  if (whereConditions.length > 0) {
    countQuery += " WHERE " + whereConditions.join(" AND ");
  }

  return countQuery;
}

// =============== HELPER FUNCTIONS FOR SQL ===============

function getYAxisSelect(yaxis) {
  switch (yaxis) {
    case "no of leads":
      return "COUNT(leadId) as yValue";
    case "proposalValue":
      return "SUM(proposalValue) as yValue";
    case "value":
      return "SUM(value) as yValue";
    default:
      return `SUM(Lead.${yaxis}) as yValue`;
  }
}

function getDateGroupExpressionSQL(field, durationUnit) {
  if (!durationUnit || durationUnit === "none") {
    return field;
  }

  switch (durationUnit.toLowerCase()) {
    case "daily":
      return `DATE_FORMAT(${field}, '%d/%m/%Y')`;
    case "weekly":
      return `CONCAT('w', WEEK(${field}), ' ', YEAR(${field}))`;
    case "monthly":
      return `CONCAT(ELT(MONTH(${field}), 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'), ' ', YEAR(${field}))`;
    case "quarterly":
      return `CONCAT('Q', QUARTER(${field}), ' ', YEAR(${field}))`;
    case "yearly":
      return `YEAR(${field})`;
    default:
      return `DATE_FORMAT(${field}, '%d/%m/%Y')`;
  }
}

function getCustomDateGroupExpressionSQL(field, durationUnit) {
  // Use the same function as regular date grouping
  return getDateGroupExpressionSQL(field, durationUnit);
}

function getFilterCondition(cond, leadCustomFields, index = 0) {
  const { column, operator, value } = cond;

  // Check if it's a custom field
  if (column.startsWith("custom_")) {
    const fieldId = parseInt(column.replace("custom_", ""));
    const customField = leadCustomFields.find((f) => f.fieldId === fieldId);

    if (!customField) return { condition: null, join: null };

    const alias = `cf_filter_${fieldId}_${index}`;
    let condition = "";

    // Handle date filtering for custom date fields
    if (isCustomDateField(customField)) {
      switch (operator) {
        case "=":
        case "is":
          condition = `${alias}.value = '${value}'`;
          break;
        case "≠":
        case "is not":
          condition = `${alias}.value != '${value}'`;
          break;
        case ">":
          condition = `${alias}.value > '${value}'`;
          break;
        case "<":
          condition = `${alias}.value < '${value}'`;
          break;
        case "between":
          if (Array.isArray(value) && value.length === 2) {
            condition = `${alias}.value BETWEEN '${value[0]}' AND '${value[1]}'`;
          }
          break;
        case "notBetween":
          if (Array.isArray(value) && value.length === 2) {
            condition = `${alias}.value NOT BETWEEN '${value[0]}' AND '${value[1]}'`;
          }
          break;
        case "isEmpty":
          condition = `(${alias}.value IS NULL OR ${alias}.value = '')`;
          break;
        case "isNotEmpty":
          condition = `(${alias}.value IS NOT NULL AND ${alias}.value != '')`;
          break;
        default:
          condition = `${alias}.value = '${value}'`;
      }
    } else {
      // Handle non-date custom fields
      switch (operator) {
        case "=":
        case "is":
          condition = `${alias}.value = '${escapeSQLValue(value)}'`;
          break;
        case "≠":
        case "is not":
          condition = `${alias}.value != '${escapeSQLValue(value)}'`;
          break;
        case "contains":
          condition = `${alias}.value LIKE '%${escapeSQLValue(value)}%'`;
          break;
        case "startsWith":
          condition = `${alias}.value LIKE '${escapeSQLValue(value)}%'`;
          break;
        case "endsWith":
          condition = `${alias}.value LIKE '%${escapeSQLValue(value)}'`;
          break;
        case ">":
          condition = `${alias}.value > '${escapeSQLValue(value)}'`;
          break;
        case "<":
          condition = `${alias}.value < '${escapeSQLValue(value)}'`;
          break;
        case "isEmpty":
          condition = `(${alias}.value IS NULL OR ${alias}.value = '')`;
          break;
        case "isNotEmpty":
          condition = `(${alias}.value IS NOT NULL AND ${alias}.value != '')`;
          break;
        default:
          condition = `${alias}.value = '${escapeSQLValue(value)}'`;
      }
    }

    const joinClause = `
      LEFT JOIN CustomFieldValues as ${alias} ON Lead.leadId = ${alias}.entityId 
        AND ${alias}.fieldId = ${fieldId} 
        AND ${alias}.entityType = 'lead'
    `;

    return { condition, join: joinClause };
  }

  // Handle standard fields
  let condition = "";
  let fieldName = column;

  // Check if it's a related table field
  if (column.includes(".")) {
    const [tableAlias, field] = column.split(".");
    fieldName = `${tableAlias}.${field}`;
  }

  switch (operator) {
    case "=":
    case "is":
      condition = `${fieldName} = '${escapeSQLValue(value)}'`;
      break;
    case "≠":
    case "is not":
      condition = `${fieldName} != '${escapeSQLValue(value)}'`;
      break;
    case "contains":
      condition = `${fieldName} LIKE '%${escapeSQLValue(value)}%'`;
      break;
    case "startsWith":
      condition = `${fieldName} LIKE '${escapeSQLValue(value)}%'`;
      break;
    case "endsWith":
      condition = `${fieldName} LIKE '%${escapeSQLValue(value)}'`;
      break;
    case ">":
      condition = `${fieldName} > '${escapeSQLValue(value)}'`;
      break;
    case "<":
      condition = `${fieldName} < '${escapeSQLValue(value)}'`;
      break;
    case "isEmpty":
      condition = `(${fieldName} IS NULL OR ${fieldName} = '')`;
      break;
    case "isNotEmpty":
      condition = `(${fieldName} IS NOT NULL AND ${fieldName} != '')`;
      break;
    case "between":
      if (Array.isArray(value) && value.length === 2) {
        condition = `${fieldName} BETWEEN '${value[0]}' AND '${value[1]}'`;
      }
      break;
    case "notBetween":
      if (Array.isArray(value) && value.length === 2) {
        condition = `${fieldName} NOT BETWEEN '${value[0]}' AND '${value[1]}'`;
      }
      break;
    default:
      condition = `${fieldName} = '${escapeSQLValue(value)}'`;
  }

  return { condition, join: null };
}

function escapeSQLValue(value) {
  if (typeof value !== "string") return value;
  return value.replace(/'/g, "''");
}

// =============== GENERAL HELPER FUNCTIONS ===============

function isDateField(xaxis) {
  const dateFields = [
    "proposalSentDate",
    "conversionDate",
    "createdAt",
    "updatedAt",
    "expectedCloseDate",
  ];
  return dateFields.includes(xaxis);
}

function isCustomDateField(customField) {
  if (!customField) return false;
  const dateTypes = ["date", "datetime", "daterange", "timerange"];
  return dateTypes.includes(customField.fieldType);
}

function formatDateValue(value, durationUnit) {
  if (!value) return value;

  if (!durationUnit || durationUnit === "none") return value;

  // For yearly, just return the year as string
  if (durationUnit.toLowerCase() === "yearly") {
    return value.toString();
  }
  if (durationUnit.toLowerCase() === "monthly" && value) {
    return value;
  }

  return value;
}

// This function is kept for compatibility with older code
function getOrderClause(yaxis, xaxis) {
  if (isDateField(xaxis)) {
    return [[sequelize.col(`Lead.${xaxis}`), "ASC"]];
  }

  if (yaxis === "no of leads") {
    return [[sequelize.fn("COUNT", sequelize.col("leadId")), "DESC"]];
  } else {
    return [[sequelize.fn("SUM", sequelize.col(`Lead.${yaxis}`)), "DESC"]];
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
  leadCustomFields = []
) {
  // Check if xaxis is a custom field
  const isCustomFieldX = existingxaxis.startsWith("custom_");
  let customFieldX = null;
  if (isCustomFieldX) {
    const fieldId = parseInt(existingxaxis.replace("custom_", ""));
    customFieldX = leadCustomFields.find((f) => f.fieldId === fieldId);
  }

  // Check if segmentedBy is a custom field
  const isSegmentedByCustom =
    existingSegmentedBy && existingSegmentedBy.startsWith("custom_");
  let customFieldSegmentedBy = null;
  if (isSegmentedByCustom) {
    const fieldId = parseInt(existingSegmentedBy.replace("custom_", ""));
    customFieldSegmentedBy = leadCustomFields.find(
      (f) => f.fieldId === fieldId
    );
  }

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX =
    isDateField(existingxaxis) ||
    (customFieldX && isCustomDateField(customFieldX));
  const shouldGroupByDuration =
    isDateFieldX && existingDurationUnit && existingDurationUnit !== "none";

  // Build base query
  let baseQuery = buildBaseQuery(
    existingxaxis,
    existingyaxis,
    existingSegmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy
  );

  // Add where conditions
  let whereConditions = buildWhereConditions(
    ownerId,
    role,
    existingxaxis,
    isCustomFieldX,
    filters,
    leadCustomFields
  );

  // Add where clause if conditions exist
  if (whereConditions.length > 0) {
    baseQuery += ` WHERE ` + whereConditions.join(" AND ");
  }

  // Build group by clause
  let groupByClause = buildGroupByClause(
    existingxaxis,
    existingSegmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy,
    shouldGroupByDuration,
    existingDurationUnit
  );

  // Build order by clause
  let orderByClause = buildOrderByClause(
    existingxaxis,
    existingyaxis,
    isDateFieldX,
    isCustomFieldX
  );

  // Build final query WITHOUT pagination
  let finalQuery = baseQuery + " " + groupByClause + " " + orderByClause;

  // Execute main query (no LIMIT/OFFSET)
  const results = await sequelize.query(finalQuery, {
    type: sequelize.QueryTypes.SELECT,
  });

  // Format the results
  let formattedResults = [];
  let totalValue = 0;

  if (existingSegmentedBy && existingSegmentedBy !== "none") {
    // Group by xValue and then by segmentValue using groupKey logic
    const groupedData = {};

    results.forEach((item) => {
      // Determine grouping key based on xaxis type and values
      let groupKey;
      
      // Get raw values for ID-based grouping
      const rawXValue = item.xValue;
      const segmentValue = formatDateValue(item.segmentValue, existingDurationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      // Format display value
      const displayXValue = formatDateValue(rawXValue, existingDurationUnit) || "Unknown";

      // Create group key based on xaxis type and ID logic
      if (existingxaxis === "contactPerson") {
        groupKey = `person_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "organization") {
        groupKey = `org_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo" || existingxaxis === "creator") {
        groupKey = `user_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "Team") {
        groupKey = `team_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "creatorstatus") {
        groupKey = `creatorstatus_${rawXValue || "Unknown"}`;
      } else {
        // For all other cases, use the display value as key
        groupKey = `label_${displayXValue}`;
      }

      if (!groupedData[groupKey]) {
        // Set id based on xaxis type
        let id = null;
        
        groupedData[groupKey] = {
          label: displayXValue,
          segments: {},
          id: id,
          rawXValue: rawXValue,
        };
      }

      // Merge segments with the same labeltype
      if (!groupedData[groupKey].segments[segmentValue]) {
        groupedData[groupKey].segments[segmentValue] = 0;
      }
      groupedData[groupKey].segments[segmentValue] += yValue;
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
    // Original format for non-segmented data with groupKey logic
    const groupedData = {};

    results.forEach((item) => {
      const rawXValue = item.xValue;
      const yValue = Number(item.yValue) || 0;
      const displayLabel = formatDateValue(rawXValue, existingDurationUnit) || "Unknown";

      // Determine grouping key based on xaxis type
      let groupKey;
      let id = null;

      if (existingxaxis === "contactPerson") {
        groupKey = `person_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "organization") {
        groupKey = `org_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "Owner" || existingxaxis === "assignedTo" || existingxaxis === "creator") {
        groupKey = `user_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "Team") {
        groupKey = `team_${rawXValue || "Unknown"}`;
      } else if (existingxaxis === "creatorstatus") {
        groupKey = `creatorstatus_${rawXValue || "Unknown"}`;
      } else {
        groupKey = `label_${displayLabel}`;
      }

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          label: displayLabel,
          value: 0,
          id: id,
          rawXValue: rawXValue,
        };
      }
      
      groupedData[groupKey].value += yValue;
    });

    // Convert grouped data to array
    formattedResults = Object.values(groupedData);

    // For non-date fields, sort by value descending
    if (!isDateFieldX) {
      formattedResults.sort((a, b) => b.value - a.value);
    }

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
async function generateLeadPerformanceDataForSave(
  ownerId,
  role,
  xaxis,
  yaxis,
  durationUnit,
  segmentedBy,
  filters,
  leadCustomFields = []
) {
  // Check if xaxis is a custom field
  const isCustomFieldX = xaxis.startsWith("custom_");
  let customFieldX = null;
  if (isCustomFieldX) {
    const fieldId = parseInt(xaxis.replace("custom_", ""));
    customFieldX = leadCustomFields.find((f) => f.fieldId === fieldId);
  }

  // Check if segmentedBy is a custom field
  const isSegmentedByCustom = segmentedBy && segmentedBy.startsWith("custom_");
  let customFieldSegmentedBy = null;
  if (isSegmentedByCustom) {
    const fieldId = parseInt(segmentedBy.replace("custom_", ""));
    customFieldSegmentedBy = leadCustomFields.find(
      (f) => f.fieldId === fieldId
    );
  }

  // Check if xaxis is a date field and durationUnit is provided
  const isDateFieldX =
    isDateField(xaxis) || (customFieldX && isCustomDateField(customFieldX));
  const shouldGroupByDuration =
    isDateFieldX && durationUnit && durationUnit !== "none";

  // Build base query
  let baseQuery = buildBaseQuery(
    xaxis,
    yaxis,
    segmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy
  );

  // Add where conditions
  let whereConditions = buildWhereConditions(
    ownerId,
    role,
    xaxis,
    isCustomFieldX,
    filters,
    leadCustomFields
  );

  // Add where clause if conditions exist
  if (whereConditions.length > 0) {
    baseQuery += ` WHERE ` + whereConditions.join(" AND ");
  }

  // Build group by clause
  let groupByClause = buildGroupByClause(
    xaxis,
    segmentedBy,
    isCustomFieldX,
    customFieldX,
    isSegmentedByCustom,
    customFieldSegmentedBy,
    shouldGroupByDuration,
    durationUnit
  );

  // Build order by clause
  let orderByClause = buildOrderByClause(
    xaxis,
    yaxis,
    isDateFieldX,
    isCustomFieldX
  );

  // Build final query WITHOUT pagination
  let finalQuery = baseQuery + " " + groupByClause + " " + orderByClause;

  // Execute main query (no LIMIT/OFFSET)
  const results = await sequelize.query(finalQuery, {
    type: sequelize.QueryTypes.SELECT,
  });

  // Format the results
  let formattedResults = [];
  let totalValue = 0;

  if (segmentedBy && segmentedBy !== "none") {
    // Group by xValue and then by segmentValue using groupKey logic
    const groupedData = {};

    results.forEach((item) => {
      // Determine grouping key based on xaxis type and values
      let groupKey;
      
      // Get raw values for ID-based grouping
      const rawXValue = item.xValue;
      const segmentValue = formatDateValue(item.segmentValue, durationUnit) || "Unknown";
      const yValue = Number(item.yValue) || 0;

      // Format display value
      const displayXValue = formatDateValue(rawXValue, durationUnit) || "Unknown";

      // Create group key based on xaxis type and ID logic
      // For standard fields, use the raw value as key
      if (xaxis === "contactPerson") {
        // For contactPerson, we need to group by personId (if available)
        // In SQL query, we can't get personId directly, so use raw value
        groupKey = `person_${rawXValue || "Unknown"}`;
      } else if (xaxis === "organization") {
        // For organization, we need to group by leadOrganizationId (if available)
        groupKey = `org_${rawXValue || "Unknown"}`;
      } else if (xaxis === "Owner" || xaxis === "assignedTo" || xaxis === "creator") {
        // For user fields, use raw value as key
        groupKey = `user_${rawXValue || "Unknown"}`;
      } else if (xaxis === "Team") {
        // For team, use raw value as key
        groupKey = `team_${rawXValue || "Unknown"}`;
      } else {
        // For all other cases, use the display value as key
        groupKey = `label_${displayXValue}`;
      }

      if (!groupedData[groupKey]) {
        // Set id based on xaxis type (if we had ID information)
        let id = null;
        
        groupedData[groupKey] = {
          label: displayXValue,
          segments: {},
          id: id,
          rawXValue: rawXValue,
        };
      }

      // Merge segments with the same labeltype
      if (!groupedData[groupKey].segments[segmentValue]) {
        groupedData[groupKey].segments[segmentValue] = 0;
      }
      groupedData[groupKey].segments[segmentValue] += yValue;
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
    // Original format for non-segmented data with groupKey logic
    const groupedData = {};

    results.forEach((item) => {
      const rawXValue = item.xValue;
      const yValue = Number(item.yValue) || 0;
      const displayLabel = formatDateValue(rawXValue, durationUnit) || "Unknown";

      // Determine grouping key based on xaxis type
      let groupKey;
      let id = null;

      if (xaxis === "contactPerson") {
        groupKey = `person_${rawXValue || "Unknown"}`;
      } else if (xaxis === "organization") {
        groupKey = `org_${rawXValue || "Unknown"}`;
      } else if (xaxis === "Owner" || xaxis === "assignedTo" || xaxis === "creator") {
        groupKey = `user_${rawXValue || "Unknown"}`;
      } else if (xaxis === "Team") {
        groupKey = `team_${rawXValue || "Unknown"}`;
      } else {
        groupKey = `label_${displayLabel}`;
      }

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          label: displayLabel,
          value: 0,
          id: id,
          rawXValue: rawXValue,
        };
      }
      
      groupedData[groupKey].value += yValue;
    });

    // Convert grouped data to array
    formattedResults = Object.values(groupedData);

    // For non-date fields, sort by value descending
    if (!isDateFieldX) {
      formattedResults.sort((a, b) => b.value - a.value);
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
    
    // Fetch custom fields for lead entity (similar to createLeadPerformReport)
    const leadCustomFields = await CustomField.findAll({
      where: {
        entityType: "lead",
        masterUserID: role === "admin" ? { [Op.ne]: null } : ownerId,
        isActive: true,
      },
      order: [
        ["displayOrder", "ASC"],
        ["fieldLabel", "ASC"],
      ],
      raw: true,
    }).then(fields => 
      fields.map(field => ({
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        fieldName: field.fieldName,
        entityType: field.entityType
      }))
    );

    let reportData = null;
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
          // Generate data WITHOUT pagination (ForSave functions don't have pagination)
          const result = await generateLeadPerformanceDataForSave(
            ownerId,
            role,
            xaxis,
            yaxis,
            durationUnit,
            segmentedBy,
            filters,
            leadCustomFields // Pass fetched leadCustomFields
          );
          reportData = result.data;
          totalValue = result.totalValue;
          // No paginationInfo for ForSave functions
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

      const colorsParsed = existingcolors ? JSON.parse(existingcolors) : {};
      const config = configString ? JSON.parse(configString) : {};

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
            leadCustomFields // Pass fetched leadCustomFields
          );
          reportData = result.data;
          totalValue = result.totalValue;
          // No paginationInfo for ForSave functions
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

      // Parse existing config safely
      const existingConfig = existingReport.config ? 
        (typeof existingReport.config === 'string' ? 
          JSON.parse(existingReport.config) : existingReport.config) : 
        {};

      const updateData = {
        ...(folderId !== undefined && { folderId }),
        ...(name !== undefined && { name }),
        ...(entity !== undefined && { entity }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(xaxis !== undefined ||
        yaxis !== undefined ||
        durationUnit !== undefined ||
        filters !== undefined ||
        segmentedBy !== undefined ||
        reportData !== undefined ||
        totalValue !== undefined
          ? {
              config: JSON.stringify({
                xaxis: xaxis ?? existingConfig?.xaxis,
                yaxis: yaxis ?? existingConfig?.yaxis,
                durationUnit: durationUnit ?? existingConfig?.durationUnit,
                segmentedBy: segmentedBy ?? existingConfig?.segmentedBy,
                filters: filters ?? existingConfig?.filters,
                reportData: reportData ?? existingConfig?.reportData,
                totalValue: totalValue ?? existingConfig?.totalValue,
              }),
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
    const nextPosition = lastReport ? (lastReport.position || 0) + 1 : 1; // Fixed: increment position

    const configObj = {
      xaxis,
      yaxis,
      durationUnit,
      segmentedBy,
      filters: filters || {},
      reportData,
      totalValue,
    };

    const reportName = name || description || `${entity} ${type}`;

    const newReport = await Report.create({
      dashboardIds: dashboardIdsArray.join(","),
      folderId: folderId || null,
      entity,
      type,
      description: description || reportName,
      name: reportName,
      position: nextPosition,
      config: JSON.stringify(configObj), // Stringify config for storage
      ownerId,
      graphtype: graphtype || "bar",
      colors: colors || JSON.stringify({}),
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
      durationUnit = null,
      segmentedBy = "none",
      filters,
      page = 1,
      limit = 5000,
      search = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.body;

    const ownerId = req.adminId;
    const role = req.role;

    // Fetch custom fields for lead entity (same as in createLeadPerformReport)
    const leadCustomFields = await CustomField.findAll({
      where: {
        entityType: "lead",
        masterUserID: role === "admin" ? { [Op.ne]: null } : ownerId,
        isActive: true
      },
      order: [['displayOrder', 'ASC'], ['fieldLabel', 'ASC']]
    });

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
      // FIX: Pass leadCustomFields parameter which was missing
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
        leadCustomFields  // Added this parameter
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

      // FIX: Pass leadCustomFields parameter which was missing
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
        leadCustomFields  // Added this parameter
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
    attributes.push([sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (existingxaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: Person,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([sequelize.col("Lead.personId"), "personId"]);
    attributes.push([sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Lead.${existingxaxis}`);
    attributes.push([sequelize.col(`Lead.${existingxaxis}`), "xValue"]);
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
      attributes.push([sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else {
      groupBy.push(`Lead.${existingSegmentedBy}`);
      attributes.push([
        sequelize.col(`Lead.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of leads") {
    attributes.push([
      sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
      "yValue",
    ]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
      ),
      "yValue",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
      ),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      sequelize.fn("SUM", sequelize.col(`Lead.${existingyaxis}`)),
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
          sequelize.fn(
            "COUNT",
            sequelize.fn(
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
      countColumn = sequelize.col("assignedUser.name");
    } else if (existingxaxis === "contactPerson") {
      countColumn = sequelize.col("Lead.personId");
    } else if (existingxaxis === "organization") {
      countColumn = sequelize.col("Lead.leadOrganizationId");
    } else {
      countColumn = sequelize.col(`Lead.${existingxaxis}`);
    }

    totalCountResult = await Lead.findAll({
      where: baseWhere,
      attributes: [
        [sequelize.fn("COUNT", sequelize.fn("DISTINCT", countColumn)), "total"],
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
        groupColumn = sequelize.col("assignedUser.name");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "contactPerson") {
        groupColumn = sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (existingxaxis === "organization") {
        groupColumn = sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = sequelize.col(`Lead.${existingxaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: [[sequelize.col(groupBy[0]), "groupKey"]],
      where: baseWhere,
      include: includeModels,
      group: groupBy[0],
      order: isDateFieldX
        ? [[sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
        : [
            existingyaxis === "no of leads"
              ? [
                  sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
                  "DESC",
                ]
              : existingyaxis === "proposalValue"
              ? [
                  sequelize.literal(
                    `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
                  ),
                  "DESC",
                ]
              : existingyaxis === "value"
              ? [
                  sequelize.literal(
                    `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
                  ),
                  "DESC",
                ]
              : [
                  sequelize.fn("SUM", sequelize.col(`Lead.${existingyaxis}`)),
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
        groupCondition = sequelize.where(groupExpression, {
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
          ? [[sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
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
        ? [[sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
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
    attributes.push([sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([sequelize.col("Activity.masterUserID"), "assignedUserId"]);
  } else if (xaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (xaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: Person,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([sequelize.col("Lead.personId"), "personId"]);
    attributes.push([sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the lead table
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([sequelize.col(`Lead.${xaxis}`), "xValue"]);
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
      attributes.push([sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.team");
      attributes.push([sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else {
      groupBy.push(`Lead.${segmentedBy}`);
      attributes.push([sequelize.col(`Lead.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle existingyaxis
  if (yaxis === "no of leads") {
    attributes.push([
      sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
      "yValue",
    ]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
      ),
      "yValue",
    ]);
  } else if (yaxis === "value") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
      ),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      sequelize.literal(
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
          sequelize.fn(
            "COUNT",
            sequelize.fn(
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
      countColumn = sequelize.col("assignedUser.name");
    } else if (xaxis === "contactPerson") {
      countColumn = sequelize.col("Lead.personId");
    } else if (xaxis === "organization") {
      countColumn = sequelize.col("Lead.leadOrganizationId");
    } else {
      countColumn = sequelize.col(`Lead.${xaxis}`);
    }

    totalCountResult = await Lead.findAll({
      where: baseWhere,
      attributes: [
        [sequelize.fn("COUNT", sequelize.fn("DISTINCT", countColumn)), "total"],
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
        groupColumn = sequelize.col("assignedUser.name");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "contactPerson") {
        groupColumn = sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = sequelize.col(`Lead.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[sequelize.col(`Lead.${xaxis}`), "ASC"]]
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
        groupCondition = sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (xaxis === "Owner" || xaxis === "assignedTo") {
        // For Owner/assignedTo - use proper sequelize syntax for related table
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
          ? [[sequelize.col(`Lead.${xaxis}`), "ASC"]]
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
        ? [[sequelize.col(`Lead.${xaxis}`), "ASC"]]
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
  filters
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
    attributes.push([sequelize.col("assignedUser.name"), "xValue"]);
  } else if (existingxaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (existingxaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: Person,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([sequelize.col("Lead.personId"), "personId"]);
    attributes.push([sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (existingxaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the Activity table
    groupBy.push(`Lead.${existingxaxis}`);
    attributes.push([sequelize.col(`Lead.${existingxaxis}`), "xValue"]);
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
      attributes.push([sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (existingSegmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: ["masterUserID", "team"],
        required: true,
      });
      groupBy.push("assignedUser.team");
      attributes.push([sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (existingSegmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (existingSegmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else {
      groupBy.push(`Lead.${existingSegmentedBy}`);
      attributes.push([
        sequelize.col(`Lead.${existingSegmentedBy}`),
        "segmentValue",
      ]);
    }
  }

  // Handle existingyaxis
  if (existingyaxis === "no of leads") {
    attributes.push([
      sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
      "yValue",
    ]);
  } else if (existingyaxis === "proposalValue") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
      ),
      "yValue",
    ]);
  } else if (existingyaxis === "value") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
      ),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      sequelize.fn("SUM", sequelize.col(`Lead.${existingyaxis}`)),
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
        ? [[sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
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
        ? [[sequelize.col(`Lead.${existingxaxis}`), "ASC"]]
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
        (existingxaxis === "Owner" ||
          existingxaxis === "assignedTo" ||
          existingxaxis === "creator") &&
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
  filters
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
    attributes.push([sequelize.col("assignedUser.name"), "xValue"]);
    attributes.push([sequelize.col("Activity.masterUserID"), "assignedUserId"]);
  } else if (xaxis === "creatorstatus") {
    // Assuming team information is stored in MasterUser model
    includeModels.push({
      model: MasterUser,
      as: "assignedUser", // Use the correct alias
      attributes: ["masterUserID", "creatorstatus"],
      required: true,
    });
    groupBy.push("assignedUser.creatorstatus");
    attributes.push([sequelize.col("assignedUser.creatorstatus"), "xValue"]);
  } else if (xaxis === "contactPerson") {
    // Special handling for contactPerson - join with Person table
    includeModels.push({
      model: Person,
      as: "LeadPerson",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.personId");
    attributes.push([sequelize.col("Lead.personId"), "personId"]);
    attributes.push([sequelize.col("LeadPerson.contactPerson"), "xValue"]);
  } else if (xaxis === "organization") {
    // Special handling for organization - join with Organization table
    includeModels.push({
      model: Organization,
      as: "LeadOrganization",
      attributes: [],
      required: false,
    });
    groupBy.push("Lead.leadOrganizationId");
    attributes.push([
      sequelize.col("Lead.leadOrganizationId"),
      "leadOrganizationId",
    ]);
    attributes.push([sequelize.col("LeadOrganization.organization"), "xValue"]);
  } else {
    // For regular columns, explicitly specify the lead table
    groupBy.push(`Lead.${xaxis}`);
    attributes.push([sequelize.col(`Lead.${xaxis}`), "xValue"]);
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
      attributes.push([sequelize.col("assignedUser.name"), "segmentValue"]);
    } else if (segmentedBy === "Team" && !assignedUserIncludeExists) {
      includeModels.push({
        model: MasterUser,
        as: "assignedUser",
        attributes: [],
      });
      groupBy.push("assignedUser.team");
      attributes.push([sequelize.col("assignedUser.team"), "segmentValue"]);
    } else if (segmentedBy === "contactPerson") {
      includeModels.push({
        model: Person,
        as: "LeadPerson",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.personId");
      attributes.push([
        sequelize.col("LeadPerson.contactPerson"),
        "segmentValue",
      ]);
    } else if (segmentedBy === "organization") {
      includeModels.push({
        model: Organization,
        as: "LeadOrganization",
        attributes: [],
        required: false,
      });
      groupBy.push("Lead.leadOrganizationId");
      attributes.push([
        sequelize.col("LeadOrganization.organization"),
        "segmentValue",
      ]);
    } else {
      groupBy.push(`Lead.${segmentedBy}`);
      attributes.push([sequelize.col(`Lead.${segmentedBy}`), "segmentValue"]);
    }
  }

  // Handle existingyaxis
  if (yaxis === "no of leads") {
    attributes.push([
      sequelize.literal(`(
      COUNT(CASE WHEN dealId IS NOT NULL THEN 1 END) * 100.0 / 
      COUNT(*)
    )`),
      "yValue",
    ]);
  } else if (yaxis === "proposalValue") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN proposalValue ELSE 0 END) * 100.0/ SUM(proposalValue)`
      ),
      "yValue",
    ]);
  } else if (yaxis === "value") {
    attributes.push([
      sequelize.literal(
        `SUM(CASE WHEN dealId IS NOT NULL THEN value ELSE 0 END) * 100.0/ SUM(value)`
      ),
      "yValue",
    ]);
  } else {
    // For other yaxis values, explicitly specify the Activity table
    attributes.push([
      sequelize.literal(
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
        groupColumn = sequelize.col("assignedUser.name");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "contactPerson") {
        groupColumn = sequelize.col("Lead.personId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else if (xaxis === "organization") {
        groupColumn = sequelize.col("Lead.leadOrganizationId");
        paginationAttributes.push([groupColumn, "groupKey"]);
      } else {
        groupColumn = sequelize.col(`Lead.${xaxis}`);
        paginationAttributes.push([groupColumn, "groupKey"]);
      }
    }

    const paginatedGroups = await Lead.findAll({
      attributes: paginationAttributes,
      where: baseWhere,
      include: includeModels,
      group: [groupColumn],
      order: isDateFieldX
        ? [[sequelize.col(`Lead.${xaxis}`), "ASC"]]
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
        groupCondition = sequelize.where(groupExpression, {
          [Op.in]: groupKeys,
        });
      } else if (xaxis === "Owner" || xaxis === "assignedTo") {
        // For Owner/assignedTo - use proper sequelize syntax for related table
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
          ? [[sequelize.col(`Lead.${xaxis}`), "ASC"]]
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
        ? [[sequelize.col(`Lead.${xaxis}`), "ASC"]]
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

exports.getLeadConversionReportSummary = async (req, res) => {
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

      const reportResult = await generateExistingLeadConversionData(
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
