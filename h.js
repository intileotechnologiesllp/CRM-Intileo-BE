if (filterId) {
  // Fetch the saved filter
  const filter = await LeadFilter.findByPk(filterId);
  if (!filter) {
    return res.status(404).json({ message: "Filter not found." });
  }
  const filterConfig = typeof filter.filterConfig === "string"
    ? JSON.parse(filter.filterConfig)
    : filter.filterConfig;

  const { all = [], any = [] } = filterConfig;
  const leadFields = Object.keys(Lead.rawAttributes);
  const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
  const personFields = Object.keys(Person.rawAttributes);
  const organizationFields = Object.keys(Organization.rawAttributes);

  let filterWhere = {};
  let leadDetailsWhere = {};
  let personWhere = {};
  let organizationWhere = {};

  // --- Your new filter logic for all ---
  if (all.length > 0) {
    filterWhere[Op.and] = [];
    leadDetailsWhere[Op.and] = [];
    personWhere[Op.and] = [];
    organizationWhere[Op.and] = [];
    all.forEach(cond => {
      if (leadFields.includes(cond.field)) {
        filterWhere[Op.and].push(buildCondition(cond));
      } else if (leadDetailsFields.includes(cond.field)) {
        leadDetailsWhere[Op.and].push(buildCondition(cond));
      } else if (personFields.includes(cond.field)) {
        personWhere[Op.and].push(buildCondition(cond));
      } else if (organizationFields.includes(cond.field)) {
        organizationWhere[Op.and].push(buildCondition(cond));
      }
    });
    if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
    if (leadDetailsWhere[Op.and].length === 0) delete leadDetailsWhere[Op.and];
    if (personWhere[Op.and].length === 0) delete personWhere[Op.and];
    if (organizationWhere[Op.and].length === 0) delete organizationWhere[Op.and];
  }

  // --- Your new filter logic for any ---
  if (any.length > 0) {
    filterWhere[Op.or] = [];
    leadDetailsWhere[Op.or] = [];
    personWhere[Op.or] = [];
    organizationWhere[Op.or] = [];
    any.forEach(cond => {
      if (leadFields.includes(cond.field)) {
        filterWhere[Op.or].push(buildCondition(cond));
      } else if (leadDetailsFields.includes(cond.field)) {
        leadDetailsWhere[Op.or].push(buildCondition(cond));
      } else if (personFields.includes(cond.field)) {
        personWhere[Op.or].push(buildCondition(cond));
      } else if (organizationFields.includes(cond.field)) {
        organizationWhere[Op.or].push(buildCondition(cond));
      }
    });
    if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
    if (leadDetailsWhere[Op.or].length === 0) delete leadDetailsWhere[Op.or];
    if (personWhere[Op.or].length === 0) delete personWhere[Op.or];
    if (organizationWhere[Op.or].length === 0) delete organizationWhere[Op.or];
  }

  // Merge with archive/masterUserID filters
  if (isArchived !== undefined) filterWhere.isArchived = isArchived === "true";
  if (masterUserID) filterWhere.masterUserID = masterUserID;

  whereClause = filterWhere;

  // --- Add to include array ---
  if (Object.keys(leadDetailsWhere).length > 0) {
    include.push({
      model: LeadDetails,
      as: "details",
      where: leadDetailsWhere,
      required: true
    });
  } else {
    include.push({
      model: LeadDetails,
      as: "details",
      required: false
    });
  }

  if (Object.keys(personWhere).length > 0) {
    include.push({
      model: Person,
      as: "person",
      required: true,
      where: personWhere
    });
  } else {
    include.push({
      model: Person,
      as: "person",
      required: false
    });
  }

  if (Object.keys(organizationWhere).length > 0) {
    include.push({
      model: Organization,
      as: "organization",
      required: true,
      where: organizationWhere
    });
  } else {
    include.push({
      model: Organization,
      as: "organization",
      required: false
    });
  }
}