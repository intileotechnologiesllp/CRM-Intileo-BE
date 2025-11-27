const auditHistory = require("../../models/reports/auditTrailModel");
const { Op } = require("sequelize");
const PROGRAMS = require("../../utils/programConstants"); // Import program constants

exports.getAuditHistory = async (req, res) => {
  try {
    // Extract query parameters for pagination, sorting, filtering, and search
    const {
      page = 1, // Default page is 1
      limit = 10, // Default limit is 10
      sortBy = "createdAt", // Default sorting column
      sortOrder = "DESC", // Default sorting order
      search = "", // Default search term
      programId, // Optional filter by programId
      mode, // Optional filter by mode
    } = req.query;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the where clause for filtering and search
    const whereClause = {};

    if (programId) {
      whereClause.programId = programId; // Filter by programId
    }

    if (mode) {
      whereClause.mode = mode; // Filter by mode
    }

    if (search) {
      whereClause.createdBy = {
        [Op.like]: `%${search}%`, // Search by createdBy (case-insensitive)
      };
    }

    // Fetch audit history with pagination, sorting, filtering, and search
    const { count, rows } = await auditHistory.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]], // Sorting
      limit: parseInt(limit), // Limit for pagination
      offset: parseInt(offset), // Offset for pagination
    });

    // Check if no records are found
    if (!rows.length) {
      return res.status(404).json({ message: "No audit history found" });
    }

    // Map programId to program names
    const mappedAuditHistory = rows.map((history) => ({
      id: history.id,
      programId: history.programId,
      programName: Object.keys(PROGRAMS).find(
        (key) => PROGRAMS[key] === history.programId
      ), // Map programId to program name
      mode: history.mode,
      createdBy: history.createdBy,
      error_desc: history.error_desc,
      creatorId: history.creatorId,
      timestamp: history.timestamp,
    }));

    // Return paginated response
    res.status(200).json({
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      auditHistory: mappedAuditHistory,
    });
  } catch (error) {
    console.error("Error fetching audit history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
