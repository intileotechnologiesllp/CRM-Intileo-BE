const { Op } = require("sequelize");
const { Person, Lead, Organization } = require("../../models");
const MasterUser = require("../../models/master/masterUserModel");

// Helper: build dynamic filter conditions (reuse from getLeads)
function buildCondition(cond) {
  const ops = {
    eq: Op.eq, ne: Op.ne, like: Op.like, notLike: Op.notLike,
    gt: Op.gt, gte: Op.gte, lt: Op.lt, lte: Op.lte, in: Op.in, notIn: Op.notIn,
    is: Op.eq, isNot: Op.ne, isEmpty: Op.is, isNotEmpty: Op.not,
  };
  if (cond.operator === "is empty") return { [cond.field]: { [Op.is]: null } };
  if (cond.operator === "is not empty") return { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
  return { [cond.field]: { [ops[cond.operator] || Op.eq]: cond.value } };
}

exports.getPersons = async (req, res) => {
  const {
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "DESC",
    filterId
  } = req.query;

  try {
    let whereClause = {};
    let include = [];

    // Dynamic filter logic (similar to getLeads)
    if (filterId) {
      // Fetch filter config from DB if needed
      // For demo, assume filterConfig is passed as JSON in req.body.filterConfig
      const filterConfig = req.body.filterConfig || { all: [], any: [] };

      const personFields = Object.keys(Person.rawAttributes);
      const leadFields = Object.keys(Lead.rawAttributes);
      const organizationFields = Object.keys(Organization.rawAttributes);

      let personWhere = {}, leadWhere = {}, organizationWhere = {};

      // AND conditions
      if (filterConfig.all && filterConfig.all.length > 0) {
        personWhere[Op.and] = [];
        leadWhere[Op.and] = [];
        organizationWhere[Op.and] = [];
        filterConfig.all.forEach(cond => {
          if (personFields.includes(cond.field)) personWhere[Op.and].push(buildCondition(cond));
          else if (leadFields.includes(cond.field)) leadWhere[Op.and].push(buildCondition(cond));
          else if (organizationFields.includes(cond.field)) organizationWhere[Op.and].push(buildCondition(cond));
        });
        if (!personWhere[Op.and].length) delete personWhere[Op.and];
        if (!leadWhere[Op.and].length) delete leadWhere[Op.and];
        if (!organizationWhere[Op.and].length) delete organizationWhere[Op.and];
      }
      // OR conditions
      if (filterConfig.any && filterConfig.any.length > 0) {
        personWhere[Op.or] = [];
        leadWhere[Op.or] = [];
        organizationWhere[Op.or] = [];
        filterConfig.any.forEach(cond => {
          if (personFields.includes(cond.field)) personWhere[Op.or].push(buildCondition(cond));
          else if (leadFields.includes(cond.field)) leadWhere[Op.or].push(buildCondition(cond));
          else if (organizationFields.includes(cond.field)) organizationWhere[Op.or].push(buildCondition(cond));
        });
        if (!personWhere[Op.or].length) delete personWhere[Op.or];
        if (!leadWhere[Op.or].length) delete leadWhere[Op.or];
        if (!organizationWhere[Op.or].length) delete organizationWhere[Op.or];
      }

      whereClause = personWhere;

      if (Object.keys(leadWhere).length > 0) {
        include.push({
          model: Lead,
          as: "Leads",
          required: true,
          where: leadWhere
        });
      } else {
        include.push({
          model: Lead,
          as: "Leads",
          required: false
        });
      }

      if (Object.keys(organizationWhere).length > 0) {
        include.push({
          model: Organization,
          as: "LeadOrganization",
          required: true,
          where: organizationWhere
        });
      } else {
        include.push({
          model: Organization,
          as: "LeadOrganization",
          required: false
        });
      }
    }

    // Search logic
    if (search) {
      whereClause[Op.or] = [
        { contactPerson: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    // Pagination
    const offset = (page - 1) * limit;

    const persons = await Person.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, order.toUpperCase()]]
    });

    res.status(200).json({
      message: "Persons fetched successfully",
      totalRecords: persons.count,
      totalPages: Math.ceil(persons.count / limit),
      currentPage: parseInt(page),
      persons: persons.rows
    });
  } catch (error) {
    console.error("Error fetching persons:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};