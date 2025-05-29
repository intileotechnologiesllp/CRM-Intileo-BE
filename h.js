exports.getLeads = async (req, res) => {
  const {
    isArchived,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "DESC",
    masterUserID: queryMasterUserID,
    filterId
  } = req.query;

  try {
    let whereClause = {};
    let include = [
      {
        model: LeadDetails,
        as: "details",
        required: false,
      },
      {
        model: Person,
        required: false,
      },
      {
        model: Organization,
        required: false,
      }
    ];

    let masterUserID = queryMasterUserID === "all" ? null : (queryMasterUserID || req.adminId);

    // If filterId is provided, use filter logic
    if (filterId) {
      const filter = await LeadFilter.findByPk(filterId);
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }

      const { all = [], any = [] } = filter.filterConfig;

      // Dynamically get all fields for each model
      const leadFields = Object.keys(Lead.rawAttributes);
      const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
      const personFields = Object.keys(Person.rawAttributes);
      const organizationFields = Object.keys(Organization.rawAttributes);

      // Prepare where objects for each model
      let leadWhere = {};
      let leadDetailsWhere = {};
      let personWhere = {};
      let organizationWhere = {};

      // Helper to add conditions
      function addCondition(whereObj, op, cond) {
        if (!whereObj[op]) whereObj[op] = [];
        whereObj[op].push(buildCondition(cond));
      }

      // Process 'all' (AND) filters
      if (all.length > 0) {
        all.forEach(cond => {
          if (leadDetailsFields.includes(cond.field)) {
            addCondition(leadDetailsWhere, Op.and, cond);
          } else if (personFields.includes(cond.field)) {
            addCondition(personWhere, Op.and, cond);
          } else if (organizationFields.includes(cond.field)) {
            addCondition(organizationWhere, Op.and, cond);
          } else if (leadFields.includes(cond.field)) {
            addCondition(leadWhere, Op.and, cond);
          }
        });
      }

      // Process 'any' (OR) filters
      if (any.length > 0) {
        any.forEach(cond => {
          if (leadDetailsFields.includes(cond.field)) {
            addCondition(leadDetailsWhere, Op.or, cond);
          } else if (personFields.includes(cond.field)) {
            addCondition(personWhere, Op.or, cond);
          } else if (organizationFields.includes(cond.field)) {
            addCondition(organizationWhere, Op.or, cond);
          } else if (leadFields.includes(cond.field)) {
            addCondition(leadWhere, Op.or, cond);
          }
        });
      }

      // Merge with archive/masterUserID filters
      if (isArchived !== undefined) leadWhere.isArchived = isArchived === "true";
      if (masterUserID) leadWhere.masterUserID = masterUserID;

      whereClause = leadWhere;

      // Build include array with where clauses for each model
      include = [
        {
          model: LeadDetails,
          as: "details",
          where: Object.keys(leadDetailsWhere).length > 0 ? leadDetailsWhere : undefined,
          required: Object.keys(leadDetailsWhere).length > 0
        },
        {
          model: Person,
          where: Object.keys(personWhere).length > 0 ? personWhere : undefined,
          required: Object.keys(personWhere).length > 0
        },
        {
          model: Organization,
          where: Object.keys(organizationWhere).length > 0 ? organizationWhere : undefined,
          required: Object.keys(organizationWhere).length > 0
        }
      ];
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

    // Fetch leads with all filters applied
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