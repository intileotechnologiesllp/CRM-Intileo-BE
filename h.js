const { Lead, LeadDetails, Person, Organization, LeadFilter } = require("../../models");
const { Op } = require("sequelize");

// ...existing code...

exports.getLeads = async (req, res) => {
  const {
    isArchived,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "DESC",
    masterUserID: queryMasterUserID,
    filterId // <-- Accept filterId as a query param
  } = req.query;

  try {
    let whereClause = {};
    let include = [
      {
        model: LeadDetails,
        as: "details",
        required: false,
      },
    ];

    let masterUserID = queryMasterUserID === "all" ? null : (queryMasterUserID || req.adminId);

    // If filterId is provided, use filter logic
    if (filterId) {
      // Fetch the saved filter
      const filter = await LeadFilter.findByPk(filterId);
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }

      // Build the where clause from filterConfig
      const { all = [], any = [] } = filter.filterConfig;
      const leadDetailsFields = [
        // Add all LeadDetails fields you want to support, e.g.:
        "someLeadDetailsField", "anotherLeadDetailsField"
        // e.g. "archiveReason", "archivedBy", etc.
      ];

      let filterWhere = {};
      let leadDetailsWhere = {};

      if (all.length > 0) {
        filterWhere[Op.and] = [];
        leadDetailsWhere[Op.and] = [];
        all.forEach(cond => {
          if (leadDetailsFields.includes(cond.field)) {
            leadDetailsWhere[Op.and].push(buildCondition(cond));
          } else {
            filterWhere[Op.and].push(buildCondition(cond));
          }
        });
        if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
        if (leadDetailsWhere[Op.and].length === 0) delete leadDetailsWhere[Op.and];
      }
      if (any.length > 0) {
        filterWhere[Op.or] = [];
        leadDetailsWhere[Op.or] = [];
        any.forEach(cond => {
          if (leadDetailsFields.includes(cond.field)) {
            leadDetailsWhere[Op.or].push(buildCondition(cond));
          } else {
            filterWhere[Op.or].push(buildCondition(cond));
          }
        });
        if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
        if (leadDetailsWhere[Op.or].length === 0) delete leadDetailsWhere[Op.or];
      }

      // Merge with archive/masterUserID filters
      if (isArchived !== undefined) filterWhere.isArchived = isArchived === "true";
      if (masterUserID) filterWhere.masterUserID = masterUserID;

      whereClause = filterWhere;

      // Add LeadDetails filter if needed
      if (Object.keys(leadDetailsWhere).length > 0) {
        include = [
          ...include,
          {
            model: LeadDetails,
            as: "details",
            where: leadDetailsWhere,
            required: true
          }
        ];
      }
    } else {
      // Standard search/filter logic
      if (isArchived !== undefined) whereClause.isArchived = isArchived === "true";
      if (masterUserID) whereClause.masterUserID = masterUserID;

      if (search) {
        whereClause[Op.or] = [
          { contactPerson: { [Op.like]: `%${search}%` } },
          { organization: { [Op.like]: `%${search}%` } },
          { title: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ];
      }
    }

    // Pagination
    const offset = (page - 1) * limit;

    // Fetch leads with pagination, filtering, sorting, searching, and leadDetails
    const leads = await Lead.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, order.toUpperCase()]],
    });

    res.status(200).json({
      message: "Leads fetched successfully",
      totalRecords: leads.count,
      totalPages: Math.ceil(leads.count / limit),
      currentPage: parseInt(page),
      leads: leads.rows,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- Helper functions (reuse from your prompt) ---

const operatorMap = {
  "is": "eq",
  "is not": "ne",
  "is empty": "is empty",
  "is not empty": "is not empty",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt"
  // Add more mappings if needed
};

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
  // (You can add your date field logic here if needed)

  // Default
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}