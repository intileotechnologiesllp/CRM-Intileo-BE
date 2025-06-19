// ...existing code...

const pref = await DealColumnPreference.findOne();

let attributes = [];
let dealDetailsAttributes = [];
if (pref) {
  const columns = typeof pref.columns === "string" ? JSON.parse(pref.columns) : pref.columns;
  const dealFields = Object.keys(Deal.rawAttributes);
  const dealDetailsFields = DealDetails ? Object.keys(DealDetails.rawAttributes) : [];
  columns.filter(col => col.check).forEach(col => {
    if (dealFields.includes(col.key)) attributes.push(col.key);
    else if (dealDetailsFields.includes(col.key)) dealDetailsAttributes.push(col.key);
  });
  if (attributes.length === 0) attributes = undefined;
  if (dealDetailsAttributes.length === 0) dealDetailsAttributes = undefined;
}

// --- DYNAMIC FILTERS START HERE ---
if (req.query.filterId) {
  const filter = await DealFilter.findByPk(req.query.filterId);
  if (filter) {
    const filterConfig = typeof filter.filterConfig === "string"
      ? JSON.parse(filter.filterConfig)
      : filter.filterConfig;

    const { all = [], any = [] } = filterConfig;
    const dealFields = Object.keys(Deal.rawAttributes);
    const dealDetailsFields = DealDetails ? Object.keys(DealDetails.rawAttributes) : [];

    let filterWhere = {};
    let dealDetailsWhere = {};

    if (all.length > 0) {
      filterWhere[Op.and] = [];
      dealDetailsWhere[Op.and] = [];
      all.forEach(cond => {
        if (dealFields.includes(cond.field)) {
          filterWhere[Op.and].push(buildCondition(cond));
        } else if (dealDetailsFields.includes(cond.field)) {
          dealDetailsWhere[Op.and].push(buildCondition(cond));
        }
      });
      if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
      if (dealDetailsWhere[Op.and].length === 0) delete dealDetailsWhere[Op.and];
    }

    if (any.length > 0) {
      filterWhere[Op.or] = [];
      dealDetailsWhere[Op.or] = [];
      any.forEach(cond => {
        if (dealFields.includes(cond.field)) {
          filterWhere[Op.or].push(buildCondition(cond));
        } else if (dealDetailsFields.includes(cond.field)) {
          dealDetailsWhere[Op.or].push(buildCondition(cond));
        }
      });
      if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
      if (dealDetailsWhere[Op.or].length === 0) delete dealDetailsWhere[Op.or];
    }

    // Merge with your existing where
    Object.assign(where, filterWhere);

    // Add DealDetails where to include
    if (dealDetailsWhere && Object.keys(dealDetailsWhere).length > 0) {
      // If you already have a DealDetails include, add where to it
      let detailsInclude = {
        model: DealDetails,
        as: "details",
        attributes: dealDetailsAttributes,
        where: dealDetailsWhere
      };
      include = [detailsInclude];
    } else {
      include = [{
        model: DealDetails,
        as: "details",
        attributes: dealDetailsAttributes
      }];
    }
  }
} else {
  // If no filterId, use your default include logic
  include = [{
    model: DealDetails,
    as: "details",
    attributes: dealDetailsAttributes
  }];
}

// ...rest of your code...