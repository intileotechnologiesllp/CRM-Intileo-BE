class ActivityGrouper {
  // Get week number from date
  static getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  }
//   static getWeekNumber(date) {
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);

//   // Move date to Thursday of the current week (ISO week rule)
//   d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));

//   const week1 = new Date(d.getFullYear(), 0, 4);

//   const currentWeek =
//     1 +
//     Math.round(
//       ((d.getTime() - week1.getTime()) / 86400000 -
//         3 +
//         ((week1.getDay() + 6) % 7)) /
//         7
//     );

//   return currentWeek + 1; // NEXT WEEK
// }

  // Get quarter from date
  static getQuarter(date) {
    const month = date.getMonth();
    return Math.floor(month / 3) + 1;
  }

  // Get year from date
  static getYear(date) {
    return date.getFullYear();
  }

  // Get month key (YYYY-MM)
  static getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }

  // Get week key (YYYY-WW)
  static getWeekKey(date) {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `w${String(week).padStart(2, "0")} ${year}`;
  }

  // Get quarter key (YYYY-Q)
  static getQuarterKey(date) {
    const year = date.getFullYear();
    const quarter = this.getQuarter(date);
    return `Q${quarter} ${year}`;
  }

  // Get year key (YYYY)
  static getYearKey(date) {
    return date.getFullYear().toString();
  }
}

exports.groupActivitiesByInterval = (
  activities,
  interval,
  dateField = "createdAt"
) => {
  const grouped = {};

  activities.forEach((activity) => {
    if (!activity[dateField]) return;

    const date = new Date(activity[dateField]);
    let key;

    switch (interval) {
      case "weekly":
        key = ActivityGrouper.getWeekKey(date);
        break;
      case "monthly":
        key = ActivityGrouper.getMonthKey(date);
        break;
      case "quarterly":
        key = ActivityGrouper.getQuarterKey(date);
        break;
      case "yearly":
        key = ActivityGrouper.getYearKey(date);
        break;
      default:
        throw new Error(
          "Invalid interval. Use: weekly, monthly, quarterly, yearly"
        );
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(activity);
  });

  return grouped;
};

exports.groupActivitiesWithStats = (
  activities,
  interval,
  dateField = "createdAt"
) => {
  const grouped = {};

  activities.forEach((activity) => {
    if (!activity[dateField]) return;

    const date = new Date(activity[dateField]);
    let key, periodLabel, year;

    switch (interval) {
      case "daily":
        key = date.toISOString().split("T")[0]; // e.g. "2025-11-25"
        const split = key.split("-")
        key = `${split[2]}/${split[1]}/${split[0]}`
        const options = { day: "2-digit", month: "short", year: "numeric" };
        periodLabel = date.toLocaleDateString("en-US", options); // e.g. "25 Nov 2025"
        break;
      case "weekly":
        key = ActivityGrouper.getWeekKey(date);
        console.log(key,"group date")
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodLabel = `Week ${key.split("-W")[1]}, ${key.split("-")[0]}`;
        break;

      case "monthly":
        key = ActivityGrouper.getMonthKey(date);
        // console.log(`📅 Monthly key: ${key}, Date: ${date}`);
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        const [year1, month] = key.split("-");
        const monthIndex = parseInt(month, 10) - 1;
        periodLabel = `${monthNames[monthIndex]} ${year1}`;
        key = `${monthNames[monthIndex]} ${year1}`;
        break;

      case "quarterly":
        key = ActivityGrouper.getQuarterKey(date);
        const quarter = key.split("-Q")[1];
        year = key.split("-")[0];
        periodLabel = `Q${quarter} ${year}`;
        break;

      case "yearly":
        key = ActivityGrouper.getYearKey(date);
        periodLabel = `Year ${key}`;
        break;

      default:
        throw new Error(
          "Invalid interval. Use: daily, weekly, monthly, quarterly, yearly"
        );
    }

    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        periodLabel: periodLabel,
        activities: [],
        stats: {
          totalActivities: 0,
          meetingCount: 0,
          deadlineCount: 0,
          completedCount: 0,
          pendingCount: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
        },
      };
    }

    grouped[key].activities.push(activity);
    grouped[key].stats.totalActivities++;

    // Count by type
    if (activity.type === "Meeting") grouped[key].stats.meetingCount++;
    if (activity.type === "Deadline") grouped[key].stats.deadlineCount++;

    // Count by status
    if (activity.isDone) grouped[key].stats.completedCount++;
    else grouped[key].stats.pendingCount++;

    // Count by priority
    if (activity.priority === "High") grouped[key].stats.highPriorityCount++;
    else if (activity.priority === "Medium")
      grouped[key].stats.mediumPriorityCount++;
    else if (activity.priority === "Low") grouped[key].stats.lowPriorityCount++;
  });

  // Convert to array and sort by period
  return Object.values(grouped).sort((a, b) =>
    a.period.localeCompare(b.period)
  );
};
