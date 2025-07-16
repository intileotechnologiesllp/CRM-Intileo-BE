const Activity = require("../../models/activity/activityModel");
const { Op } = require("sequelize");
const moment = require("moment"); // or use JS Date
const { convertRelativeDate } = require("../../utils/helper"); // Import the utility to convert relative dates
const Person = require("../../models/leads/leadPersonModel");
const Organizations = require("../../models/leads/leadOrganizationModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
const ActivityColumnPreference = require("../../models/activity/activityColumnModel"); // Adjust path as needed
const Lead = require("../../models/leads/leadsModel");
const LeadDetails = require("../../models/leads/leadDetailsModel");
const Deal = require("../../models/deals/dealsModels");
//const Organizations = require("../../models/leads/leadOrganizationModel"); // Adjust path as needed

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
      isDone,
    } = req.body;
    // Fetch contact person details
    let contactPerson = null;
    let email = null;
    if (personId) {
      const person = await Person.findByPk(personId);
      if (person) {
        contactPerson = person.contactPerson;
        email = person.email;
        console.log(
          person.contactPerson,
          person.email,
          "Contact Person and Email fetched in inside createActivity"
        );
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
      console.log(
        org.organization,
        "Organization fetched inside createActivity"
      );
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
      guests: guestsValue,
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
      dueDate: endDateTime,
    });

    // Update nextActivity in Lead if leadId is present
    if (leadId) {
      await updateNextActivityForLead(leadId);
    }

    res
      .status(201)
      .json({ message: "Activity created successfully", activity });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
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
      endDate,
    } = req.query;
    // --- Get checked columns ---
    const pref = await ActivityColumnPreference.findOne();
    let attributes = [];
    if (pref) {
      const columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;
      const activityFields = Object.keys(Activity.rawAttributes);
      columns
        .filter((col) => col.check && activityFields.includes(col.key))
        .forEach((col) => {
          attributes.push(col.key);
        });
      if (attributes.length === 0) attributes = undefined;
    }
    const where = {};
    let filterWhere = {};
    // --- Dynamic Filter Logic ---
    if (filterId) {
      const filter = await LeadFilter.findByPk(filterId); // Or ActivityFilter if you have one
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }
      const filterConfig =
        typeof filter.filterConfig === "string"
          ? JSON.parse(filter.filterConfig)
          : filter.filterConfig;

      const { all = [], any = [] } = filterConfig;
      const activityFields = Object.keys(Activity.rawAttributes);

      // "all" conditions (AND)
      if (all.length > 0) {
        filterWhere[Op.and] = [];
        all.forEach((cond) => {
          if (activityFields.includes(cond.field)) {
            filterWhere[Op.and].push(buildCondition(cond));
          }
        });
        if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
      }

      // "any" conditions (OR)
      if (any.length > 0) {
        filterWhere[Op.or] = [];
        any.forEach((cond) => {
          if (activityFields.includes(cond.field)) {
            filterWhere[Op.or].push(buildCondition(cond));
          }
        });
        if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
      }
    }

    // --- Date filter logic (applies after dynamic filter) ---
    const now = moment().startOf("day");
    switch (dateFilter) {
      case "overdue":
        where.startDateTime = { [Op.lt]: now.toDate() };
        where.isDone = false;
        break;
      case "today":
        where.startDateTime = {
          [Op.gte]: now.toDate(),
          [Op.lt]: moment(now).add(1, "day").toDate(),
        };
        break;
      case "tomorrow":
        where.startDateTime = {
          [Op.gte]: moment(now).add(1, "day").toDate(),
          [Op.lt]: moment(now).add(2, "day").toDate(),
        };
        break;
      case "this_week":
        where.startDateTime = {
          [Op.gte]: now.toDate(),
          [Op.lt]: moment(now).endOf("week").toDate(),
        };
        break;
      case "next_week":
        where.startDateTime = {
          [Op.gte]: moment(now).add(1, "week").startOf("week").toDate(),
          [Op.lt]: moment(now).add(1, "week").endOf("week").toDate(),
        };
        break;
      case "select_period":
        if (startDate && endDate) {
          where.startDateTime = {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate),
          };
        }
        break;
      case "To-do":
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
        { description: { [Op.like]: `%${search}%` } },
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
        { assignedTo: req.adminId },
      ];
    }

    // Merge dynamic filter with standard filters
    const finalWhere = { ...filterWhere, ...where };
    const alwaysInclude = [
      "dealId",
      "leadId",
      "assignedTo",
      "leadOrganizationId",
      "personId",
      "activityId",
      "type",
      "startDateTime",
      "endDateTime",
    ];
    if (attributes) {
      alwaysInclude.forEach((field) => {
        if (!attributes.includes(field)) attributes.push(field);
      });
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: activities, count: total } = await Activity.findAndCountAll({
      where: finalWhere,
      limit: parseInt(limit),
      offset,
      order: [["startDateTime", "DESC"]],
      attributes, // <-- only checked columns will be returned
      include: [
        {
          model: Lead,
          attributes: ["title"],
          required: false,
        },
        {
          model: Deal,
          attributes: ["title"],
          required: false,
        },
      ],
    });

    const activitiesWithTitle = activities.map((activity) => {
      const data = activity.get ? activity.get({ plain: true }) : activity;
      const { Lead, Deal, ...rest } = data;
      let title = null;
      if (rest.leadId && Lead) {
        title = Lead.title;
      } else if (rest.dealId && Deal) {
        title = Deal.title;
      }
      return {
        ...rest,
        title,
      };
    });

    res.status(200).json({
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      activities: activitiesWithTitle,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
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
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
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

exports.markActivityAsDone = async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    activity.isDone = true;
    await activity.save();

    // Update next activity date for the lead if this activity was linked to a lead
    if (activity.leadId) {
      await updateNextActivityForLead(activity.leadId);
    }

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
    if (!updateFields.leadOrganizationId)
      updateFields.leadOrganizationId = activity.leadOrganizationId;

    // Update Person if needed
    if (
      updateFields.personId &&
      (updateFields.contactPerson || updateFields.email)
    ) {
      await Person.update(
        {
          ...(updateFields.contactPerson && {
            name: updateFields.contactPerson,
          }),
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

    // Update next activity date for the lead if this activity is linked to a lead
    // and if the update affects scheduling (startDateTime, isDone, etc.)
    if (
      activity.leadId &&
      (updateFields.startDateTime ||
        updateFields.isDone !== undefined ||
        updateFields.leadId)
    ) {
      await updateNextActivityForLead(activity.leadId);

      // If leadId was changed, also update the previous lead
      if (updateFields.leadId && updateFields.leadId !== activity.leadId) {
        const originalLeadId = activity.getDataValue("leadId"); // Get original value before update
        if (originalLeadId) {
          await updateNextActivityForLead(originalLeadId);
        }
      }
    }

    res
      .status(200)
      .json({ message: "Activity updated successfully", activity });
  } catch (error) {
    console.error("Error updating activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.saveAllActivityFieldsWithCheck = async (req, res) => {
  // Get all field names from Activity model
  const activityFields = Object.keys(Activity.rawAttributes);

  // Exclude fields that are likely IDs (case-insensitive, ends with 'id' or is 'id')
  const filteredFieldNames = activityFields.filter(
    (field) => !/^id$/i.test(field) && !/id$/i.test(field)
  );

  // Accept array of { value, check } from req.body
  const { checkedFields } = req.body || {};

  // Build columns to save: always include all fields, set check from checkedFields if provided
  let columnsToSave = filteredFieldNames.map((field) => {
    let check = false;
    if (Array.isArray(checkedFields)) {
      const found = checkedFields.find((item) => item.value === field);
      check = found ? !!found.check : false;
    }
    return { key: field, check };
  });

  try {
    let pref = await ActivityColumnPreference.findOne();
    if (!pref) {
      // Create the record if it doesn't exist
      pref = await ActivityColumnPreference.create({ columns: columnsToSave });
    } else {
      // Update the existing record
      pref.columns = columnsToSave;
      await pref.save();
    }
    res
      .status(200)
      .json({ message: "All activity columns saved", columns: pref.columns });
  } catch (error) {
    console.log("Error saving all activity columns:", error);
    res.status(500).json({ message: "Error saving all activity columns" });
  }
};

exports.updateActivityColumnChecks = async (req, res) => {
  // Expecting: { columns: [ { key: "columnName", check: true/false }, ... ] }
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    // Find the global ActivityColumnPreference record
    let pref = await ActivityColumnPreference.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Parse columns if stored as string
    let prefColumns =
      typeof pref.columns === "string"
        ? JSON.parse(pref.columns)
        : pref.columns;

    // Update check status for matching columns
    prefColumns = prefColumns.map((col) => {
      const found = columns.find((c) => c.key === col.key);
      if (found) {
        return { ...col, check: !!found.check };
      }
      return col;
    });

    pref.columns = prefColumns;
    await pref.save();
    res.status(200).json({ message: "Columns updated", columns: pref.columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating columns" });
  }
};

exports.getActivityFields = (req, res) => {
  const fields = [
    // { key: "activityId", label: "Activity ID", check: false }, // removed
    { key: "type", label: "Type", check: false },
    { key: "subject", label: "Subject", check: false },
    { key: "startDateTime", label: "Start Date & Time", check: false },
    { key: "endDateTime", label: "End Date & Time", check: false },
    { key: "priority", label: "Priority", check: false },
    { key: "guests", label: "Guests", check: false },
    { key: "location", label: "Location", check: false },
    {
      key: "videoCallIntegration",
      label: "Video Call Integration",
      check: false,
    },
    { key: "description", label: "Description", check: false },
    { key: "status", label: "Status", check: false },
    { key: "notes", label: "Notes", check: false },
    { key: "assignedTo", label: "Assigned To", check: false }, // keep
    // { key: "dealId", label: "Deal ID", check: false }, // removed
    // { key: "leadId", label: "Lead ID", check: false }, // removed
    // { key: "personId", label: "Person ID", check: false }, // removed
    // { key: "leadOrganizationId", label: "Organization ID", check: false }, // removed
    { key: "isDone", label: "Is Done", check: false },
    // { key: "masterUserID", label: "Master User ID", check: false }, // removed
    { key: "contactPerson", label: "Contact Person", check: false },
    { key: "email", label: "Email", check: false },
    { key: "organization", label: "Organization", check: false },
    { key: "dueDate", label: "Due Date", check: false },
    { key: "createdAt", label: "Created At", check: false },
    { key: "updatedAt", label: "Updated At", check: false },
  ];

  res.status(200).json({ fields });
};

exports.getAllLeadsAndDeals = async (req, res) => {
  try {
    // Pagination and search params
    const { page = 1, limit = 20, search = "" } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Search condition for leads and deals
    const leadWhere = search ? { title: { [Op.like]: `%${search}%` } } : {};
    const dealWhere = search ? { title: { [Op.like]: `%${search}%` } } : {};

    // Fetch leads with pagination
    const { rows: leadsRows, count: totalLeads } = await Lead.findAndCountAll({
      attributes: ["leadId", "title"],
      where: leadWhere,
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Fetch deals with pagination
    const { rows: dealsRows, count: totalDeals } = await Deal.findAndCountAll({
      attributes: ["dealId", "title"],
      where: dealWhere,
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Format response
    const leads = leadsRows.map((lead) => ({
      leadId: lead.leadId,
      title: lead.title,
    }));

    const deals = dealsRows.map((deal) => ({
      dealId: deal.dealId,
      title: deal.title,
    }));

    res.status(200).json({
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalLeads,
        totalDeals,
        totalLeadPages: Math.ceil(totalLeads / limit),
        totalDealPages: Math.ceil(totalDeals / limit),
      },
      leads,
      deals,
    });
  } catch (error) {
    console.error("Error fetching leads and deals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllOrganizations = async (req, res) => {
  try {
    // Pagination and search params
    const {
      page = 1,
      limit = 20,
      search = "",
      // Add more filters as needed, e.g. country, status, etc.
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where condition for search/filter
    const where = {};
    if (search) {
      where.organization = { [Op.like]: `%${search}%` };
    }
    // Add more filters here if needed, e.g.:
    // if (req.query.country) where.country = req.query.country;

    // Fetch organizations with pagination and search
    const { rows: organizations, count: total } =
      await Organizations.findAndCountAll({
        attributes: ["leadOrganizationId", "organization"],
        where,
        limit: parseInt(limit),
        offset,
        order: [["organization", "ASC"]],
      });

    res.status(200).json({
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      organizations,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCalendarActivities = async (req, res) => {
  try {
    // Optional filters: user, date range, type, etc.
    const {
      startDate, // e.g. "2025-06-22"
      endDate, // e.g. "2025-06-28"
      assignedTo,
      type,
    } = req.query;

    const where = {};

    // Filter by date range
    if (startDate && endDate) {
      where.startDateTime = { [Op.gte]: new Date(startDate) };
      where.endDateTime = { [Op.lte]: new Date(endDate) };
    } else if (startDate) {
      where.startDateTime = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.endDateTime = { [Op.lte]: new Date(endDate) };
    }

    // Filter by assigned user
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // Filter by activity type (Meeting, Task, etc.)
    if (type) {
      where.type = type;
    }

    // Fetch activities
    const activities = await Activity.findAll({
      where,
      attributes: [
        "activityId",
        "type",
        "subject",
        "startDateTime",
        "endDateTime",
        "status",
        "assignedTo",
        "dealId",
        "leadId",
      ],
      order: [["startDateTime", "ASC"]],
    });

    // Optionally, group by date or format as needed for your frontend calendar
    res.status(200).json({ activities });
  } catch (error) {
    console.error("Error fetching calendar activities:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to update next activity date for a lead
const updateNextActivityForLead = async (leadId) => {
  try {
    // Find the earliest upcoming activity for this lead that is not done
    const nextActivity = await Activity.findOne({
      where: {
        leadId,
        isDone: false,
        startDateTime: { [Op.gte]: new Date() }, // Only future activities
      },
      order: [["startDateTime", "ASC"]], // Get the earliest one
      attributes: ["startDateTime", "activityId"],
    });

    let nextActivityDate = null;
    let nextActivityStatus = null;

    if (nextActivity) {
      nextActivityDate = nextActivity.startDateTime;

      // Calculate status based on how close the activity is
      const now = new Date();
      const activityDate = new Date(nextActivity.startDateTime);
      const timeDiff = activityDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      if (daysDiff < 0) {
        nextActivityStatus = "overdue"; // Red - Past due
      } else if (daysDiff <= 1) {
        nextActivityStatus = "today"; // Red/Orange - Due today or tomorrow
      } else if (daysDiff <= 3) {
        nextActivityStatus = "upcoming"; // Yellow - Due within 3 days
      } else {
        nextActivityStatus = "normal"; // Default color
      }
    }

    // Update the lead details
    await LeadDetails.update(
      {
        nextActivityDate,
        nextActivityStatus,
      },
      { where: { leadId } }
    );

    console.log(
      `Updated next activity for lead ${leadId}: ${nextActivityDate} (${nextActivityStatus})`
    );
  } catch (error) {
    console.error(`Error updating next activity for lead ${leadId}:`, error);
  }
};

// Utility function to update next activity dates for all leads (can be called via API)
exports.updateAllLeadsNextActivity = async (req, res) => {
  try {
    // Get all leads that have activities
    const leadsWithActivities = await Activity.findAll({
      attributes: ["leadId"],
      where: {
        leadId: { [Op.ne]: null },
      },
      group: ["leadId"],
      raw: true,
    });

    const leadIds = leadsWithActivities.map((item) => item.leadId);
    let updatedCount = 0;

    for (const leadId of leadIds) {
      await updateNextActivityForLead(leadId);
      updatedCount++;
    }

    res.status(200).json({
      message: `Updated next activity dates for ${updatedCount} leads`,
      updatedLeads: updatedCount,
    });
  } catch (error) {
    console.error("Error updating all leads next activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
