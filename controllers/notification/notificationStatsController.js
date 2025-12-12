const { Op } = require('sequelize');
const sequelize = require('../../config/db');

/**
 * Get user's daily and monthly progress stats for notification panel
 */
exports.getUserProgress = async (req, res) => {
  try {
    const userId = req.user?.userId || req.adminId;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this month's date range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Daily Progress - Meetings (Activities of type meeting)
    const dailyMeetings = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM Activities 
      WHERE assignedTo = :userId 
      AND type = 'meeting'
      AND createdAt >= :today 
      AND createdAt < :tomorrow
    `, {
      replacements: { userId, today, tomorrow },
      type: sequelize.QueryTypes.SELECT
    });

    // Daily Progress - Emails sent
    const dailyEmails = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM Emails 
      WHERE masterUserID = :userId 
      AND folder = 'sent'
      AND createdAt >= :today 
      AND createdAt < :tomorrow
    `, {
      replacements: { userId, today, tomorrow },
      type: sequelize.QueryTypes.SELECT
    });

    // Daily Progress - Activities completed
    const dailyActivities = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM Activities 
      WHERE assignedTo = :userId 
      AND isDone = 1
      AND updatedAt >= :today 
      AND updatedAt < :tomorrow
    `, {
      replacements: { userId, today, tomorrow },
      type: sequelize.QueryTypes.SELECT
    });

    // Monthly Progress - New Deals
    const monthlyNewDeals = await sequelize.query(`
      SELECT COUNT(*) as count,
             COALESCE(COUNT(*), 0) - COALESCE(
               (SELECT COUNT(*) FROM Deals 
                WHERE ownerId = :userId 
                AND createdAt >= DATE_SUB(:monthStart, INTERVAL 1 MONTH)
                AND createdAt < :monthStart), 0
             ) as \`change\`
      FROM Deals 
      WHERE ownerId = :userId 
      AND createdAt >= :monthStart 
      AND createdAt <= :monthEnd
    `, {
      replacements: { userId, monthStart, monthEnd },
      type: sequelize.QueryTypes.SELECT
    });

    // Monthly Progress - Won Deals
    const monthlyWonDeals = await sequelize.query(`
      SELECT COUNT(*) as count,
             COALESCE(COUNT(*), 0) - COALESCE(
               (SELECT COUNT(*) FROM Deals 
                WHERE ownerId = :userId 
                AND status = 'won'
                AND updatedAt >= DATE_SUB(:monthStart, INTERVAL 1 MONTH)
                AND updatedAt < :monthStart), 0
             ) as \`change\`
      FROM Deals 
      WHERE ownerId = :userId 
      AND status = 'won'
      AND updatedAt >= :monthStart 
      AND updatedAt <= :monthEnd
    `, {
      replacements: { userId, monthStart, monthEnd },
      type: sequelize.QueryTypes.SELECT
    });

    // Monthly Progress - Revenue Forecast
    const monthlyRevenue = await sequelize.query(`
      SELECT COALESCE(SUM(value), 0) as total,
             COALESCE(SUM(value), 0) - COALESCE(
               (SELECT SUM(value) FROM Deals 
                WHERE ownerId = :userId 
                AND status = 'won'
                AND updatedAt >= DATE_SUB(:monthStart, INTERVAL 1 MONTH)
                AND updatedAt < :monthStart), 0
             ) as \`change\`
      FROM Deals 
      WHERE ownerId = :userId 
      AND status = 'won'
      AND updatedAt >= :monthStart 
      AND updatedAt <= :monthEnd
    `, {
      replacements: { userId, monthStart, monthEnd },
      type: sequelize.QueryTypes.SELECT
    });

    // Calculate percentage changes
    const calculatePercentChange = (current, change) => {
      const previous = current - change;
      if (previous === 0) return change > 0 ? 100 : 0;
      return ((change / previous) * 100).toFixed(1);
    };

    const newDeals = monthlyNewDeals[0];
    const wonDeals = monthlyWonDeals[0];
    const revenue = monthlyRevenue[0];

    res.status(200).json({
      success: true,
      data: {
        daily: {
          meetings: parseInt(dailyMeetings[0]?.count || 0),
          emails: parseInt(dailyEmails[0]?.count || 0),
          activities: parseInt(dailyActivities[0]?.count || 0)
        },
        monthly: {
          newDeals: {
            count: parseInt(newDeals?.count || 0),
            change: parseInt(newDeals?.change || 0),
            percentChange: calculatePercentChange(
              parseInt(newDeals?.count || 0),
              parseInt(newDeals?.change || 0)
            )
          },
          wonDeals: {
            count: parseInt(wonDeals?.count || 0),
            change: parseInt(wonDeals?.change || 0),
            percentChange: calculatePercentChange(
              parseInt(wonDeals?.count || 0),
              parseInt(wonDeals?.change || 0)
            )
          },
          revenue: {
            total: parseFloat(revenue?.total || 0),
            change: parseFloat(revenue?.change || 0),
            percentChange: calculatePercentChange(
              parseFloat(revenue?.total || 0),
              parseFloat(revenue?.change || 0)
            )
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user progress',
      error: error.message
    });
  }
};
