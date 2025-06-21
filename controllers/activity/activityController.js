const Activity = require("../../models/activity/activityModel");
const { Op } = require("sequelize");
const moment = require("moment"); // or use JS Date
const {convertRelativeDate} = require("../../utils/helper"); // Import the utility to convert relative dates
const Person = require("../../models/leads/leadPersonModel");
const Organizations = require("../../models/leads/leadOrganizationModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");

exports.createActivity = async (req, res) => {
  try {
    const {
      type,
      subject,
      startDateTime,
      endDateTime,
      priority,
      guests,
      location,
      videoCallIntegration,
      description,
      status,
      notes,
      assignedTo,
      dealId,
      leadId,
      personId,
      leadOrganizationId,
      isDone
    } = req.body;
    // Fetch contact person details
    let contactPerson = null;
    let email = null;
    if (personId) {
      const person = await Person.findByPk(personId);
      if (person) {
        contactPerson = person.contactPerson;
        email = person.email;
        console.log(person.contactPerson, person.email, "Contact Person and Email fetched in inside createActivity");
        
      }
    }
    console.log(contactPerson, email, "Contact Person and Email fetched");
    

    // Fetch organization details
    let organization = null;
    if (leadOrganizationId) {
      const org = await Organizations.findByPk(leadOrganizationId);
      if (org) {
        organization = org.organization;
      }
      console.log(org.organization, "Organization fetched inside createActivity");
      
    }
    console.log(organization, "Organization fetched");
    
        // If guests is an array, convert to string for storage
    const guestsValue = Array.isArray(guests) ? JSON.stringify(guests) : guests;
    const activity = await Activity.create({
      type,
      subject,
      startDateTime,
      endDateTime,
      priority,
      guests:guestsValue,
      location,
      videoCallIntegration,
      description,
      status,
      notes,
      assignedTo,
      dealId,
      leadId,
      personId,
      leadOrganizationId,
      isDone,
      masterUserID: req.adminId, // Assuming adminId is the masterUserID
      contactPerson,
      email,
      organization,
      dueDate:endDateTime
    });

    res.status(201).json({ message: "Activity created successfully", activity });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

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
  const leadDateFields = Object.entries(Activity.rawAttributes)
  .filter(([_, attr]) => attr.type && attr.type.key === 'DATE')
  .map(([key]) => key);

// const DealDetailsDateFields = Object.entries(DealDetails.rawAttributes)
//   .filter(([_, attr]) => attr.type && attr.type.key === 'DATE')
//   .map(([key]) => key);

const allDateFields = [...leadDateFields];

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
    const isValidDate = d => d instanceof Date && !isNaN(d.getTime());

    if (dateRange && isValidDate(dateRange.start) && isValidDate(dateRange.end)) {
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


exports.markActivityAsDone = async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    activity.isDone = true;
    await activity.save();

    res.status(200).json({ message: "Activity marked as done", activity });
  } catch (error) {
    console.error("Error marking activity as done:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.updateActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const updateFields = req.body;

    // Fetch the activity to get personId and leadOrganizationId if not provided
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Use existing personId and leadOrganizationId if not provided in body
    if (!updateFields.personId) updateFields.personId = activity.personId;
    if (!updateFields.leadOrganizationId) updateFields.leadOrganizationId = activity.leadOrganizationId;

    // Update Person if needed
    if (
      updateFields.personId &&
      (updateFields.contactPerson || updateFields.email)
    ) {
      await Person.update(
        {
          ...(updateFields.contactPerson && { name: updateFields.contactPerson }),
          ...(updateFields.email && { email: updateFields.email }),
        },
        { where: { personId: updateFields.personId } }
      );
    }

    // Update Organizations if needed
    if (updateFields.leadOrganizationId && updateFields.organization) {
      await Organizations.update(
        { name: updateFields.organization },
        { where: { leadOrganizationId: updateFields.leadOrganizationId } }
      );
    }

    // If guests is present and is an array, stringify it
    if (updateFields.guests && Array.isArray(updateFields.guests)) {
      updateFields.guests = JSON.stringify(updateFields.guests);
    }

    await activity.update(updateFields);

    res.status(200).json({ message: "Activity updated successfully", activity });
  } catch (error) {
    console.error("Error updating activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
