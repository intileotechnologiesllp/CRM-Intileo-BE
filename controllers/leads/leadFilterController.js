const LeadFilter = require("../../models/leads/leadFiltersModel");
const Lead = require("../../models/leads/leadsModel");
const { Op } = require("sequelize"); // Import Sequelize operators
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Import the audit trail logger
const PROGRAMS = require("../../utils/programConstants"); // Import program constants
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const { convertRelativeDate } = require("../../utils/helper"); // Import the utility to convert relative dates
const LeadDetails = require("../../models/leads/leadDetailsModel"); // Import your LeadDetails model
exports.saveLeadFilter = async (req, res) => {
  const {
    filterName,
    filterConfig,
    visibility = "Private",
    columns,
  } = req.body;
  const masterUserID = req.adminId; // or req.user.id

  if (!filterName || !filterConfig) {
    return res
      .status(400)
      .json({ message: "filterName and filterConfig are required." });
  }
  try {
    const filter = await LeadFilter.create({
      filterName,
      filterConfig,
      visibility,
      masterUserID,
      columns,
    });
    res.status(201).json({ message: "Filter saved successfully", filter });
  } catch (error) {
    console.error("Error saving filter:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getLeadFilters = async (req, res) => {
  const masterUserID = req.adminId; // or req.user.id
  const { entityType } = req.query; // 'Lead' or 'Deal'
  try {
    let filters;

    if (req.role === "admin") {
      // Admin can see all filters
      filters = await LeadFilter.findAll();
    } else {
      // Non-admin users: public filters for everyone, private only for this user
      filters = await LeadFilter.findAll({
        where: {
          [Op.or]: [
            { visibility: "Public" },
            { visibility: "Private", masterUserID },
          ],
        },
      });
    }

    // Filter by entityType if provided
    let filtered = filters;
    if (entityType) {
      filtered = filters.filter((f) => {
        const filterConfig =
          typeof f.filterConfig === "string"
            ? JSON.parse(f.filterConfig)
            : f.filterConfig;
        const all = filterConfig.all || [];
        const any = filterConfig.any || [];
        const allEntities = [...all, ...any];
        return allEntities.some((cond) => cond.entity === entityType);
      });
    }

    res.status(200).json({ filters: filtered });
  } catch (error) {
    console.error("Error fetching filters:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.useFilters = async (req, res) => {
  const { filterId } = req.params;

  try {
    // Fetch the saved filter
    const filter = await LeadFilter.findByPk(filterId);
    if (!filter) {
      return res.status(404).json({ message: "Filter not found." });
    }

    // Build the where clause from filterConfig
    const { all = [], any = [] } = filter.filterConfig;
    const where = {};
    const leadDetailsWhere = {};

    // List of fields that belong to LeadDetails
    const leadDetailsFields = [
      // Add all LeadDetails fields you want to support, e.g.:
      "someLeadDetailsField",
      "anotherLeadDetailsField",
      // e.g. "archiveReason", "archivedBy", etc.
    ];

    // Separate conditions for Lead and LeadDetails
    if (all.length > 0) {
      where[Op.and] = [];
      leadDetailsWhere[Op.and] = [];
      all.forEach((cond) => {
        if (leadDetailsFields.includes(cond.field)) {
          leadDetailsWhere[Op.and].push(buildCondition(cond));
        } else {
          where[Op.and].push(buildCondition(cond));
        }
      });
      if (where[Op.and].length === 0) delete where[Op.and];
      if (leadDetailsWhere[Op.and].length === 0)
        delete leadDetailsWhere[Op.and];
    }
    if (any.length > 0) {
      where[Op.or] = [];
      leadDetailsWhere[Op.or] = [];
      any.forEach((cond) => {
        if (leadDetailsFields.includes(cond.field)) {
          leadDetailsWhere[Op.or].push(buildCondition(cond));
        } else {
          where[Op.or].push(buildCondition(cond));
        }
      });
      if (where[Op.or].length === 0) delete where[Op.or];
      if (leadDetailsWhere[Op.or].length === 0) delete leadDetailsWhere[Op.or];
    }

    // Build include array if needed
    const include = [];
    if (Object.keys(leadDetailsWhere).length > 0) {
      include.push({
        model: LeadDetails,
        as: "leadDetails", // Use the correct alias if you have one
        where: leadDetailsWhere,
        required: true,
      });
    }

    // Fetch leads using the built where clause and include
    const leads = await Lead.findAll({
      where,
      include,
    });

    res.status(200).json({ leads });
  } catch (error) {
    console.error("Error fetching leads by filter:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Operator label to backend key mapping
const operatorMap = {
  is: "eq",
  "is not": "ne",
  "is empty": "is empty",
  "is not empty": "is not empty",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt",
  // Add more mappings if needed
};
// Helper to build a single condition
function buildCondition(cond) {
  const ops = {
    eq: Op.eq,
    ne: Op.ne,
    like: Op.like,
    notLike: Op.notLike,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
    in: Op.in,
    notIn: Op.notIn,
    is: Op.eq,
    isNot: Op.ne,
    isEmpty: Op.is,
    isNotEmpty: Op.not,
  };

  let operator = cond.operator;
  if (operatorMap[operator]) {
    operator = operatorMap[operator];
  }

  // Handle "is empty" and "is not empty"
  if (operator === "is empty") {
    return { [cond.field]: { [Op.is]: null } };
  }
  if (operator === "is not empty") {
    return { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
  }

  // Handle date fields
  const leadDateFields = Object.entries(Lead.rawAttributes)
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
    .map(([key]) => key);

  const leadDetailsDateFields = Object.entries(LeadDetails.rawAttributes)
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
    .map(([key]) => key);

  const allDateFields = [...leadDateFields, ...leadDetailsDateFields];
  // if (
  //   ["createdAt", "updatedAt", "expectedCloseDate", "proposalSentDate", "nextActivityDate", "archiveTime"].includes(cond.field)
  // ) {
  //   // If useExactDate is true, use the value directly
  //   if (cond.useExactDate) {
  //     // Validate the date
  //     const date = new Date(cond.value);
  //     if (isNaN(date.getTime())) return {};
  //     return {
  //       [cond.field]: {
  //         [ops[operator] || Op.eq]: date,
  //       },
  //     };
  //   }
  if (allDateFields.includes(cond.field)) {
    if (cond.useExactDate) {
      const date = new Date(cond.value);
      if (isNaN(date.getTime())) return {};
      return {
        [cond.field]: {
          [ops[operator] || Op.eq]: date,
        },
      };
    }
    // Otherwise, use relative date conversion
    const dateRange = convertRelativeDate(cond.value);
    const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

    if (
      dateRange &&
      isValidDate(dateRange.start) &&
      isValidDate(dateRange.end)
    ) {
      return {
        [cond.field]: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      };
    }
    if (dateRange && isValidDate(dateRange.start)) {
      return {
        [cond.field]: {
          [ops[operator] || Op.eq]: dateRange.start,
        },
      };
    }
    return {};
  }

  // Default
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}
exports.updateLeadFilter = async (req, res) => {
  const { filterId } = req.params;
  const { filterName, filterConfig, visibility, columns } = req.body;
  const masterUserID = req.adminId; // or req.user.id

  try {
    const filter = await LeadFilter.findByPk(filterId);

    if (!filter) {
      return res.status(404).json({ message: "Filter not found." });
    }

    // Allow admin to edit any filter, non-admin can only edit their own filters
    if (req.role !== "admin" && filter.masterUserID !== masterUserID) {
      return res
        .status(403)
        .json({ message: "You are not allowed to edit this filter." });
    }

    // Update fields if provided
    if (filterName !== undefined) filter.filterName = filterName;
    if (filterConfig !== undefined) filter.filterConfig = filterConfig;
    if (visibility !== undefined) filter.visibility = visibility;
    if (columns !== undefined) filter.columns = columns;

    await filter.save();

    res.status(200).json({ message: "Filter updated successfully", filter });
  } catch (error) {
    console.error("Error updating filter:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getLeadFields = (req, res) => {
  const fields = [
    { value: "contactPerson", label: "Contact person" },
    { value: "organization", label: "Organization" },
    { value: "title", label: "Title" },
    { value: "valueLabels", label: "Value Labels" },
    { value: "expectedCloseDate", label: "Expected Close Date" },
    { value: "sourceChannel", label: "Source channel" },
    { value: "sourceChannelID", label: "Source channel ID" },
    { value: "serviceType", label: "Service Type" },
    { value: "scopeOfServiceType", label: "Scope of Service Type" },
    { value: "phone", label: "Person phone" },
    { value: "email", label: "Email" },
    { value: "company", label: "Company" },
    { value: "proposalValue", label: "Proposal Value" },
    { value: "esplProposalNo", label: "ESPL Proposal No." },
    { value: "projectLocation", label: "Project Location" },
    { value: "organizationCountry", label: "Organization Country" },
    { value: "proposalSentDate", label: "Proposal Sent Date" },
    { value: "status", label: "Status" },
    { value: "ownerId", label: "Owner" },
    { value: "createdAt", label: "Lead created" },
    { value: "updatedAt", label: "Last updated" },
    // Add any custom/virtual fields below
    { value: "masterUserID", label: "Creator" },
    { value: "currency", label: "Currency" },
    { value: "nextActivityDate", label: "Next activity date" },
    { value: "nextActivityStatus", label: "Next activity status" },
    {
      value: "reportsPrepared",
      label: "No. of reports prepared for the project",
    },
    { value: "organizationName", label: "Organization name" },
    { value: "seen", label: "Seen" },
    { value: "questionerShared", label: "Questioner Shared?" },
    { value: "responsiblePerson", label: "Responsible Person" },
    { value: "rfpReceivedDate", label: "RFP received Date" },
    { value: "sbuClass", label: "SBU Class" },
    { value: "sectoralSector", label: "Sectoral Sector" },
    { value: "source", label: "Source" },
    { value: "sourceOrigin", label: "Source origin" },
    { value: "sourceOriginID", label: "Source origin ID" },
    { value: "statusSummery", label: "Status Summery" },
    { value: "title", label: "Title" },
    { value: "updatedAt", label: "Update time" },
    { value: "value", label: "Value" },
    { value: "visibleTo", label: "Visible to" },
    { value: "archiveTime", label: "Archive time" },
    // ...add more as needed
  ];
  res.status(200).json({ fields });
};

exports.getAllLeadContactPersons = async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build search condition for contactPerson
    const where = search ? { contactPerson: { [Op.like]: `%${search}%` } } : {};

    const { rows, count } = await Lead.findAndCountAll({
      where,
      attributes: ["contactPerson"],
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    // Extract contactPerson values
    const contactPersons = rows
      .map((lead) => lead.contactPerson)
      .filter(Boolean);

    res.status(200).json({
      contactPersons,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error fetching contact persons:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
