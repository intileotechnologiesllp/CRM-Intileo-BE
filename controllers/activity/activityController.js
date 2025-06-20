const Activity = require("../../models/activity/activityModel");
const { Op } = require("sequelize");
const moment = require("moment"); // or use JS Date

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
      const person = await LeadPeople.findByPk(personId);
      if (person) {
        contactPerson = person.name;
        email = person.email;
      }
    }

    // Fetch organization details
    let organization = null;
    if (leadOrganizationId) {
      const org = await Organizations.findByPk(leadOrganizationId);
      if (org) {
        organization = org.organization;
      }
    }
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
      dateFilter
    } = req.query;

    const where = {};

    // Date filter logic
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
    // Search by subject or description
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

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: activities, count: total } = await Activity.findAndCountAll({
      where,
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

    // Update LeadPeople if needed
    if (
      updateFields.personId &&
      (updateFields.contactPerson || updateFields.email)
    ) {
      await LeadPeople.update(
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
