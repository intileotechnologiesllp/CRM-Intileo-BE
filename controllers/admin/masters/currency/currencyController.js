const Joi = require("joi");
const { Op } = require("sequelize");
const Currency = require("../../../../models/admin/masters/currencyModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
// Validation schema for currency
const currencySchema = Joi.object({
  currency_desc: Joi.string().min(3).max(100).required().messages({
    "string.empty": "currency description cannot be empty",
    "any.required": "currency description is required",
  }),
});

// Add currency
exports.createcurrency = async (req, res) => {
  const { currency_desc } = req.body;

  // Validate the request body
  const { error } = currencySchema.validate({ currency_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.CURRENCY_MASTER, // Program ID for country management
      "CREATE_CURRENCY", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const currency = await Currency.create({
      currency_desc,
      createdBy: "admin",
      mode: "added"
    });

    res.status(201).json({
      message: "currency created successfully",
      currency: {
        currencyId: currency.currencyId, // Include currencyId in the response
        currency_desc: currency.currency_desc,
        createdBy: currency.createdBy,
        mode: currency.mode,
        createdAt: currency.createdAt,
        updatedAt: currency.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating currency:", error);
    await logAuditTrail(
      PROGRAMS.CURRENCY_MASTER, // Program ID for country management
      "CREATE_CURRENCY", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit currency
exports.editcurrency = async (req, res) => {
  const { currencyId } = req.params; // Use currencyId instead of id
  const { currency_desc } = req.body;

  // Validate the request body
  const { error } = currencySchema.validate({ currency_desc });
  if (error) {
    await logAuditTrail(
      PROGRAMS.CURRENCY_MASTER, // Program ID for country management
      "EDIT_CURRENCY", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    const currency = await Currency.findByPk(currencyId); // Find currency by currencyId
    if (!currency) {
      return res.status(404).json({ message: "currency not found" });
    }

    await currency.update({
      currency_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({
      message: "currency updated successfully",
      currency: {
        currencyId: currency.currencyId, // Include currencyId in the response
        currency_desc: currency.currency_desc,
        mode: currency.mode,
        createdAt: currency.createdAt,
        updatedAt: currency.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating currency:", error);
    await logAuditTrail(
      PROGRAMS.CURRENCY_MASTER, // Program ID for country management
      "EDIT_CURRENCY", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    ); // Program ID for country management
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete currency
exports.deletecurrency = async (req, res) => {
  const { currencyId } = req.params; // Use currencyId instead of id

  try {
    const currency = await Currency.findByPk(currencyId); // Find currency by currencyId
    if (!currency) {
      await logAuditTrail(
        PROGRAMS.CURRENCY_MASTER, // Program ID for country management
        "DELETE_CURRENCY", // Mode
         req.role, // Admin ID from the authenticated request
        "currency not found", // Error description
        req.adminId
      );

      return res.status(404).json({ message: "currency not found" });
    }

    // Update mode to "deleted" before deleting
    await currency.update({ mode: "deleted" });

    await currency.destroy();

    res.status(200).json({
      message: "currency deleted successfully",
      currencyId, // Include currencyId in the response
    });
  } catch (error) {
    console.error("Error deleting currency:", error);
    await logAuditTrail(
      PROGRAMS.CURRENCY_MASTER, // Program ID for country management
      "DELETE_CURRENCY", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort currencys
exports.getcurrencys = async (req, res) => {
  const {
    search,
    createdBy,
    mode,
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;

  // Validate query parameters using Joi
  const querySchema = Joi.object({
    search: Joi.string().optional(),
    createdBy: Joi.string().optional(),
    mode: Joi.string().valid("added", "modified", "deleted").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    sortBy: Joi.string().valid("creationDate", "currency_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      PROGRAMS.CURRENCY_MASTER, // Program ID for country management
      "GET_CURRENCYS", // Mode
       req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );

    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  try {
    // Build the whereClause with filters
    const whereClause = {
      ...(search && {
        currency_desc: {
          [Op.like]: `%${search}%`, // Search by currency_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const currencys = await Currency.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: currencys.count,
      pages: Math.ceil(currencys.count / limit),
      currentPage: parseInt(page),
      currencys: currencys.rows.map((currency) => ({
        currencyId: currency.currencyId, // Include currencyId in the response
        currency_desc: currency.currency_desc,
        mode: currency.mode,
        createdBy: currency.createdBy,
        createdAt: currency.createdAt,
        updatedAt: currency.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching currencys:", error);
    await logAuditTrail(
      PROGRAMS.CURRENCY_MASTER, // Program ID for country management
      "GET_CURRENCY", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};
