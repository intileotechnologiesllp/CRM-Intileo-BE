exports.getActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      type,
      assignedTo,
      isDone,
      personId,
      leadOrganizationId,
      dealId,
      leadId,
      dateFilter,
      filterId, // <-- support filterId
      startDate,
      endDate
    } = req.query;

    const where = {};
    let filterWhere = {};
    // --- Dynamic Filter Logic ---
    if (filterId) {
      const filter = await LeadFilter.findByPk(filterId); // Or ActivityFilter if you have one
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }
      const filterConfig = typeof filter.filterConfig === "string"
        ? JSON.parse(filter.filterConfig)
        : filter.filterConfig;

      const { all = [], any = [] } = filterConfig;
      const activityFields = Object.keys(Activity.rawAttributes);

      // "all" conditions (AND)
      if (all.length > 0) {
        filterWhere[Op.and] = [];
        all.forEach(cond => {
          if (activityFields.includes(cond.field)) {
            filterWhere[Op.and].push(buildCondition(cond));
          }
        });
        if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
      }

      // "any" conditions (OR)
      if (any.length > 0) {
        filterWhere[Op.or] = [];
        any.forEach(cond => {
          if (activityFields.includes(cond.field)) {
            filterWhere[Op.or].push(buildCondition(cond));
          }
        });
        if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
      }
    }

    // --- Date filter logic (applies after dynamic filter) ---
    const now = moment().startOf('day');
    switch (dateFilter) {
      case "overdue":
        where.startDateTime = { [Op.lt]: now.toDate() };
        where.isDone = false;
        break;
      case "today":
        where.startDateTime = {
          [Op.gte]: now.toDate(),
          [Op.lt]: moment(now).add(1, 'day').toDate()
        };
        break;
      case "tomorrow":
        where.startDateTime = {
          [Op.gte]: moment(now).add(1, 'day').toDate(),
          [Op.lt]: moment(now).add(2, 'day').toDate()
        };
        break;
      case "this_week":
        where.startDateTime = {
          [Op.gte]: now.toDate(),
          [Op.lt]: moment(now).endOf('week').toDate()
        };
        break;
      case "next_week":
        where.startDateTime = {
          [Op.gte]: moment(now).add(1, 'week').startOf('week').toDate(),
          [Op.lt]: moment(now).add(1, 'week').endOf('week').toDate()
        };
        break;
      case "select_period":
        if (startDate && endDate) {
          where.startDateTime = {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate)
          };
        }
        break;
      case "todo":
        where.isDone = false;
        where.startDateTime = { [Op.gte]: now.toDate() };
        break;
      default:
        // No date filter
        break;
    }

    // --- Standard filters (applies after dynamic filter) ---
    if (search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    if (type) where.type = type;
    if (typeof isDone !== "undefined") where.isDone = isDone === "true";
    if (personId) where.personId = personId;
    if (leadOrganizationId) where.leadOrganizationId = leadOrganizationId;
    if (dealId) where.dealId = dealId;
    if (leadId) where.leadId = leadId;

    // Only show all activities if user is admin
    if (req.role !== "admin") {
      where[Op.or] = [
        { masterUserID: req.adminId },
        { assignedTo: req.adminId }
      ];
    }

    // Merge dynamic filter with standard filters
    const finalWhere = { ...filterWhere, ...where };

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: activities, count: total } = await Activity.findAndCountAll({
      where: finalWhere,
      limit: parseInt(limit),
      offset,
      order: [["startDateTime", "DESC"]],
    });

    res.status(200).json({
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      activities,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function (reuse your buildCondition from getLeads)
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

  // Map your operator strings to Sequelize ops as needed
  const operatorMap = {
    "is": "eq",
    "is not": "ne",
    "is empty": "is empty",
    "is not empty": "is not empty",
    "is exactly or earlier than": "lte",
    "is earlier than": "lt",
    "is exactly or later than": "gte",
    "is later than": "gt"
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

  // Default
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}