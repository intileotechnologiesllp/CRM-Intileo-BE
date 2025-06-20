const { Op } = require("sequelize");
const moment = require("moment"); // or use JS Date

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
      dateFilter, // <-- new
      startDate,  // for custom period
      endDate     // for custom period
    } = req.query;

    const where = {};

    // ...existing filters...

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

    // ...rest of your code (pagination, admin/user logic)...

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