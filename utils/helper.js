const moment = require("moment");

function convertRelativeDate(keyword) {
  const now = moment().startOf('day');
  let start, end;

  switch (keyword) {
    case "today":
      start = now.clone();
      end = now.clone().endOf('day');
      break;
    case "yesterday":
      start = now.clone().subtract(1, 'day');
      end = now.clone().subtract(1, 'day').endOf('day');
      break;
    case "tomorrow":
      start = now.clone().add(1, 'day');
      end = now.clone().add(1, 'day').endOf('day');
      break;
    case "this week":
      start = now.clone().startOf('week');
      end = now.clone().endOf('week');
      break;
    case "last week":
      start = now.clone().subtract(1, 'week').startOf('week');
      end = now.clone().subtract(1, 'week').endOf('week');
      break;
    case "next week":
      start = now.clone().add(1, 'week').startOf('week');
      end = now.clone().add(1, 'week').endOf('week');
      break;
    case "this month":
      start = now.clone().startOf('month');
      end = now.clone().endOf('month');
      break;
    case "last month":
      start = now.clone().subtract(1, 'month').startOf('month');
      end = now.clone().subtract(1, 'month').endOf('month');
      break;
    case "next month":
      start = now.clone().add(1, 'month').startOf('month');
      end = now.clone().add(1, 'month').endOf('month');
      break;
    case "this quarter":
      start = now.clone().startOf('quarter');
      end = now.clone().endOf('quarter');
      break;
    case "last quarter":
      start = now.clone().subtract(1, 'quarter').startOf('quarter');
      end = now.clone().subtract(1, 'quarter').endOf('quarter');
      break;
    case "next quarter":
      start = now.clone().add(1, 'quarter').startOf('quarter');
      end = now.clone().add(1, 'quarter').endOf('quarter');
      break;
    case "this year":
      start = now.clone().startOf('year');
      end = now.clone().endOf('year');
      break;
    case "last year":
      start = now.clone().subtract(1, 'year').startOf('year');
      end = now.clone().subtract(1, 'year').endOf('year');
      break;
    case "next year":
      start = now.clone().add(1, 'year').startOf('year');
      end = now.clone().add(1, 'year').endOf('year');
      break;
    case "now":
      start = now.clone();
      end = now.clone();
      break;
    case "before today":
      start = null;
      end = now.clone().subtract(1, 'day').endOf('day');
      break;
    case "today or later":
      start = now.clone();
      end = null;
      break;
    case "before tomorrow":
      start = null;
      end = now.clone().add(1, 'day').startOf('day').subtract(1, 'second');
      break;
    case "tomorrow or later":
      start = now.clone().add(1, 'day').startOf('day');
      end = null;
      break;
    default:
      // Handle "in X days/weeks/months/years" and "X days/weeks/months/years ago"
      const inMatch = keyword.match(/^in (\d+) (day|week|month|year|days|weeks|months|years)$/);
      const agoMatch = keyword.match(/^(\d+) (day|week|month|year|days|weeks|months|years) ago$/);
      if (inMatch) {
        const num = parseInt(inMatch[1]);
        const unit = inMatch[2];
        start = now.clone().add(num, unit);
        end = start.clone().endOf(unit.replace(/s$/, ''));
        break;
      }
      if (agoMatch) {
        const num = parseInt(agoMatch[1]);
        const unit = agoMatch[2];
        start = now.clone().subtract(num, unit).startOf(unit.replace(/s$/, ''));
        end = now.clone().subtract(num, unit).endOf(unit.replace(/s$/, ''));
        break;
      }
      return null;
  }
  return { start: start ? start.toDate() : null, end: end ? end.toDate() : null };
}

module.exports = {convertRelativeDate};