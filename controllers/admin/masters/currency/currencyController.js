const Joi = require("joi");
const { Op } = require("sequelize");
const sequelize = require("../../../../config/db");
const Currency = require("../../../../models/admin/masters/currencyModel");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants"); // Import program constants
const historyLogger = require("../../../../utils/historyLogger").logHistory; // Import history logger
// Validation schema for currency
const currencySchema = Joi.object({
  currency_desc: Joi.string().min(1).max(150).required().messages({
    "string.empty": "Currency description cannot be empty",
    "any.required": "Currency description is required",
    "string.min": "Currency description must be at least 1 character",
    "string.max": "Currency description must not exceed 150 characters"
  }),
  symbol: Joi.string().min(1).max(15).required().messages({
    "string.empty": "Symbol cannot be empty", 
    "any.required": "Symbol is required",
    "string.min": "Symbol must be at least 1 character",
    "string.max": "Symbol must not exceed 15 characters"
  }),
  decimalPoints: Joi.number().integer().min(0).max(10).optional().default(2).messages({
    "number.min": "Decimal points cannot be negative",
    "number.max": "Decimal points cannot exceed 10",
    "number.integer": "Decimal points must be an integer"
  }),
  code: Joi.string().min(1).max(10).optional().messages({
    "string.min": "Code must be at least 1 character",
    "string.max": "Code must not exceed 10 characters"
  }),
  isActive: Joi.boolean().optional().default(true)
});

// Function to generate currency code
const generateCurrencyCode = (currency_desc) => {
  // Extract first 3-4 characters from the currency description, convert to uppercase
  let code = currency_desc.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  
  // If less than 3 characters, pad with underscores
  while (code.length < 3) {
    code += '_';
  }
  
  return code;
};

// Function to ensure unique currency code
const ensureUniqueCode = async (baseCode, excludeId = null, Currency) => {
  let code = baseCode;
  let counter = 1;
  
  while (true) {
    const whereClause = { code };
    if (excludeId) {
      whereClause.currencyId = { [Op.ne]: excludeId };
    }
    
    const existing = await Currency.findOne({ where: whereClause });
    if (!existing) {
      break;
    }
    
    // Generate new code with suffix
    code = `${baseCode.substring(0, 2)}${counter}`;
    counter++;
  }
  
  return code;
};

// Add currency
exports.createcurrency = async (req, res) => {
  const { History, AuditTrail, Currency } = req.models;
  const { currency_desc, symbol, decimalPoints = 2, code, isActive = true } = req.body;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  // Validate the request body
  const { error, value } = currencySchema.validate({ 
    currency_desc, 
    symbol, 
    decimalPoints, 
    code, 
    isActive 
  });
  
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "CREATE_CURRENCY",
      req.role,
      error.details[0].message,
      req.adminId
    );
    return res.status(400).json({ 
      message: error.details[0].message,
      errors: error.details.reduce((acc, err) => {
        acc[err.path[0]] = err.message;
        return acc;
      }, {})
    });
  }

  try {
    // Generate code if not provided
    let finalCode = code;
    if (!finalCode) {
      const baseCode = generateCurrencyCode(currency_desc);
      finalCode = await ensureUniqueCode(baseCode, Currency);
    } else {
      // Ensure provided code is unique
      finalCode = await ensureUniqueCode(code, Currency);
    }

    // Check if currency with same description already exists
    const existingCurrency = await Currency.findOne({
      where: clientConnection.where(
        clientConnection.fn('LOWER', clientConnection.col('currency_desc')),
        clientConnection.fn('LOWER', currency_desc)
      )
    });

    if (existingCurrency) {
      return res.status(409).json({ 
        message: "Currency with this description already exists",
        errors: { currency_desc: "Currency with this description already exists" }
      });
    }

    const currency = await Currency.create({
      currency_desc,
      symbol,
      decimalPoints,
      code: finalCode,
      isActive,
      isCustom: true, // Mark as custom currency
      createdBy: req.role || "admin",
      createdById: req.adminId,
      mode: "added"
    });

    await historyLogger(
      History,
      PROGRAMS.CURRENCY_MASTER,
      "CREATE_CURRENCY",
      currency.createdById,
      currency.currencyId,
      null,
      `Custom currency "${currency_desc}" created by "${req.role}"`,
      { currency_desc, symbol, decimalPoints, code: finalCode, isActive }
    );

    res.status(201).json({
      message: "Custom currency created successfully",
      currency: {
        currencyId: currency.currencyId,
        currency_desc: currency.currency_desc,
        symbol: currency.symbol,
        decimalPoints: currency.decimalPoints,
        code: currency.code,
        isActive: currency.isActive,
        isCustom: currency.isCustom,
        createdBy: currency.createdBy,
        mode: currency.mode,
        createdAt: currency.createdAt,
        updatedAt: currency.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating currency:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "CREATE_CURRENCY",
      req.role,
      error.message,
      req.adminId
    );
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        message: "Currency code already exists",
        errors: { code: "Currency code must be unique" }
      });
    }
    
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit currency
exports.editcurrency = async (req, res) => {
  const { History, AuditTrail, Currency } = req.models;
  const { currencyId } = req.params;
  const { currency_desc, symbol, decimalPoints, code, isActive } = req.body;

  // Create validation schema for update (all fields optional)
  const updateSchema = Joi.object({
    currency_desc: Joi.string().min(1).max(150).optional(),
    symbol: Joi.string().min(1).max(15).optional(),
    decimalPoints: Joi.number().integer().min(0).max(10).optional(),
    code: Joi.string().min(1).max(10).optional(),
    isActive: Joi.boolean().optional()
  });

  // Validate the request body
  const { error } = updateSchema.validate({ currency_desc, symbol, decimalPoints, code, isActive });
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "EDIT_CURRENCY",
      req.role,
      error.details[0].message,
      req.adminId
    );
    return res.status(400).json({ 
      message: error.details[0].message,
      errors: error.details.reduce((acc, err) => {
        acc[err.path[0]] = err.message;
        return acc;
      }, {})
    });
  }

  try {
    const currency = await Currency.findByPk(currencyId);
    if (!currency) {
      return res.status(404).json({ message: "Currency not found" });
    }

    // Store original data for history logging
    const originalData = {
      currency_desc: currency.currency_desc,
      symbol: currency.symbol,
      decimalPoints: currency.decimalPoints,
      code: currency.code,
      isActive: currency.isActive
    };

    // Prepare update data
    const updateData = { mode: "modified" };
    
    if (currency_desc !== undefined) {
      // Check if new currency description already exists (excluding current currency)
      const existingCurrency = await Currency.findOne({
        where: {
          [Op.and]: [
            clientConnection.where(
              clientConnection.fn('LOWER', clientConnection.col('currency_desc')),
              clientConnection.fn('LOWER', currency_desc)
            ),
            { currencyId: { [Op.ne]: currencyId } }
          ]
        }
      });

      if (existingCurrency) {
        return res.status(409).json({ 
          message: "Currency with this description already exists",
          errors: { currency_desc: "Currency with this description already exists" }
        });
      }
      updateData.currency_desc = currency_desc;
    }

    if (symbol !== undefined) updateData.symbol = symbol;
    if (decimalPoints !== undefined) updateData.decimalPoints = decimalPoints;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (code !== undefined) {
      // Ensure new code is unique (excluding current currency)
      const finalCode = await ensureUniqueCode(code, currencyId, Currency);
      updateData.code = finalCode;
    }

    await currency.update(updateData);

    // Calculate changes for history logging
    const updatedData = {
      currency_desc: currency.currency_desc,
      symbol: currency.symbol,
      decimalPoints: currency.decimalPoints,
      code: currency.code,
      isActive: currency.isActive
    };

    const changes = {};
    for (const key in updatedData) {
      if (originalData[key] !== updatedData[key]) {
        changes[key] = { from: originalData[key], to: updatedData[key] };
      }
    }

    await historyLogger(
      History,
      PROGRAMS.CURRENCY_MASTER,
      "EDIT_CURRENCY",
      currency.createdById,
      currencyId,
      req.adminId,
      `Currency "${currency.currency_desc}" updated by "${req.role}"`,
      changes
    );

    res.status(200).json({
      message: "Currency updated successfully",
      currency: {
        currencyId: currency.currencyId,
        currency_desc: currency.currency_desc,
        symbol: currency.symbol,
        decimalPoints: currency.decimalPoints,
        code: currency.code,
        isActive: currency.isActive,
        isCustom: currency.isCustom,
        mode: currency.mode,
        createdAt: currency.createdAt,
        updatedAt: currency.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating currency:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "EDIT_CURRENCY",
      req.role,
      error.message,
      req.adminId
    );

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        message: "Currency code already exists",
        errors: { code: "Currency code must be unique" }
      });
    }

    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete currency (soft delete by deactivating)
exports.deletecurrency = async (req, res) => {
  const { currencyId } = req.params;
  const { History, AuditTrail, Currency } = req.models;
  try {
    const currency = await Currency.findByPk(currencyId);
    if (!currency) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.CURRENCY_MASTER,
        "DELETE_CURRENCY",
        req.role,
        "Currency not found",
        req.adminId
      );
      return res.status(404).json({ message: "Currency not found" });
    }

    // Soft delete by setting isActive to false instead of hard delete
    await currency.update({ 
      isActive: false,
      mode: "deleted" 
    });

    await historyLogger(
      History,
      PROGRAMS.CURRENCY_MASTER,
      "DELETE_CURRENCY",
      currency.createdById,
      currencyId,
      req.adminId,
      `Currency "${currency.currency_desc}" deactivated by "${req.role}"`,
      { isActive: { from: true, to: false } }
    );

    res.status(200).json({
      message: "Currency deactivated successfully",
      currencyId,
    });
  } catch (error) {
    console.error("Error deactivating currency:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "DELETE_CURRENCY",
      req.role,
      error.message,
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort currencies with active/deactivated filter
exports.getcurrencys = async (req, res) => {
  const {
    search,
    createdBy,
    mode,
    isActive, // New filter for active/deactivated
    isCustom, // Filter for custom vs standard currencies
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;
  const { History, AuditTrail, Currency } = req.models;
  // Validate query parameters using Joi
  const querySchema = Joi.object({
    search: Joi.string().optional(),
    createdBy: Joi.string().optional(),
    mode: Joi.string().valid("added", "modified", "deleted").optional(),
    isActive: Joi.boolean().optional(),
    isCustom: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    sortBy: Joi.string().valid("creationDate", "currency_desc", "symbol", "code", "decimalPoints").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "GET_CURRENCYS",
      req.role,
      error.details[0].message,
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    // Build the whereClause with filters
    const whereClause = {
      ...(search && {
        [Op.or]: [
          { currency_desc: { [Op.like]: `%${search}%` } },
          { symbol: { [Op.like]: `%${search}%` } },
          { code: { [Op.like]: `%${search}%` } }
        ]
      }),
      ...(createdBy && { createdBy }),
      ...(mode && { mode }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(isCustom !== undefined && { isCustom: isCustom === 'true' }),
    };

    const currencies = await Currency.findAndCountAll({
      where: whereClause,
      order: [[sortBy, order]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    // Get count by status for tabs
    const activeCurrencies = await Currency.count({ where: { isActive: true } });
    const deactivatedCurrencies = await Currency.count({ where: { isActive: false } });

    // Get all active and deactivated currencies separately (without pagination for separate arrays)
    const allActiveCurrencies = await Currency.findAll({
      where: { isActive: true },
      order: [['currency_desc', 'ASC']]
    });

    const allDeactivatedCurrencies = await Currency.findAll({
      where: { isActive: false },
      order: [['currency_desc', 'ASC']]
    });

    const formatCurrency = (currency) => ({
      currencyId: currency.currencyId,
      currency_desc: currency.currency_desc,
      symbol: currency.symbol,
      decimalPoints: currency.decimalPoints,
      code: currency.code,
      isActive: currency.isActive,
      isCustom: currency.isCustom,
      mode: currency.mode,
      createdBy: currency.createdBy,
      createdAt: currency.createdAt,
      updatedAt: currency.updatedAt,
      // For frontend compatibility (if needed)
      fullName: currency.currency_desc
    });

    res.status(200).json({
      total: currencies.count,
      pages: Math.ceil(currencies.count / limit),
      currentPage: parseInt(page),
      counts: {
        active: activeCurrencies,
        deactivated: deactivatedCurrencies,
        total: activeCurrencies + deactivatedCurrencies
      },
      // Paginated results (filtered based on query parameters)
      currencys: currencies.rows.map(formatCurrency),
      // Separate arrays for all active and deactivated currencies
      activeCurrencies: allActiveCurrencies.map(formatCurrency),
      deactivatedCurrencies: allDeactivatedCurrencies.map(formatCurrency)
    });
  } catch (error) {
    console.error("Error fetching currencies:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "GET_CURRENCY",
      req.role,
      error.message,
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Generate a different currency code
exports.getDifferentCode = async (req, res) => {
  const { currency_desc } = req.body;
  const { History, AuditTrail, Currency } = req.models;

  if (!currency_desc) {
    return res.status(400).json({ 
      message: "Currency description is required to generate code",
      errors: { currency_desc: "Currency description is required" }
    });
  }

  try {
    // Generate multiple code options
    const baseCode = generateCurrencyCode(currency_desc);
    const codeOptions = [];

    // Option 1: Standard 3-letter code
    codeOptions.push(await ensureUniqueCode(baseCode, Currency));

    // Option 2: First 2 letters + first letter of second word
    const words = currency_desc.split(' ');
    if (words.length > 1) {
      const altCode = (words[0].substring(0, 2) + words[1].substring(0, 1)).toUpperCase();
      codeOptions.push(await ensureUniqueCode(altCode, Currency));
    }

    // Option 3: Random 3-letter combination from currency description
    const letters = currency_desc.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (letters.length >= 3) {
      const randomCode = letters[0] + letters[Math.floor(letters.length/2)] + letters[letters.length-1];
      codeOptions.push(await ensureUniqueCode(randomCode, Currency));
    }

    // Remove duplicates
    const uniqueOptions = [...new Set(codeOptions)];

    res.status(200).json({
      message: "Alternative currency codes generated",
      codes: uniqueOptions,
      suggested: uniqueOptions[0] // First option as suggested
    });

  } catch (error) {
    console.error("Error generating currency code:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Refresh/Populate standard currencies (like the standard ISO currencies)
exports.refreshCurrencies = async (req, res) => {
  const { History, AuditTrail, Currency } = req.models;
  try {
    const standardCurrencies = [
      { currency_desc: "US Dollar", symbol: "$", code: "USD", decimalPoints: 2 },
      { currency_desc: "Euro", symbol: "€", code: "EUR", decimalPoints: 2 },
      { currency_desc: "British Pound Sterling", symbol: "£", code: "GBP", decimalPoints: 2 },
      { currency_desc: "Japanese Yen", symbol: "¥", code: "JPY", decimalPoints: 0 },
      { currency_desc: "Canadian Dollar", symbol: "C$", code: "CAD", decimalPoints: 2 },
      { currency_desc: "Australian Dollar", symbol: "A$", code: "AUD", decimalPoints: 2 },
      { currency_desc: "Swiss Franc", symbol: "CHF", code: "CHF", decimalPoints: 2 },
      { currency_desc: "Chinese Yuan", symbol: "¥", code: "CNY", decimalPoints: 2 },
      { currency_desc: "Swedish Krona", symbol: "kr", code: "SEK", decimalPoints: 2 },
      { currency_desc: "New Zealand Dollar", symbol: "NZ$", code: "NZD", decimalPoints: 2 },
      { currency_desc: "Mexican Peso", symbol: "$", code: "MXN", decimalPoints: 2 },
      { currency_desc: "Singapore Dollar", symbol: "S$", code: "SGD", decimalPoints: 2 },
      { currency_desc: "Hong Kong Dollar", symbol: "HK$", code: "HKD", decimalPoints: 2 },
      { currency_desc: "Norwegian Krone", symbol: "kr", code: "NOK", decimalPoints: 2 },
      { currency_desc: "South Korean Won", symbol: "₩", code: "KRW", decimalPoints: 0 },
      { currency_desc: "Turkish Lira", symbol: "₺", code: "TRY", decimalPoints: 2 },
      { currency_desc: "Russian Ruble", symbol: "₽", code: "RUB", decimalPoints: 2 },
      { currency_desc: "Indian Rupee", symbol: "₹", code: "INR", decimalPoints: 2 },
      { currency_desc: "Brazilian Real", symbol: "R$", code: "BRL", decimalPoints: 2 },
      { currency_desc: "South African Rand", symbol: "R", code: "ZAR", decimalPoints: 2 }
    ];

    let created = 0;
    let skipped = 0;
    const results = [];

    for (const currencyData of standardCurrencies) {
      try {
        // Check if currency already exists
        const existing = await Currency.findOne({
          where: { code: currencyData.code }
        });

        if (existing) {
          skipped++;
          results.push({
            code: currencyData.code,
            status: 'skipped',
            reason: 'Already exists'
          });
        } else {
          const currency = await Currency.create({
            ...currencyData,
            isActive: true,
            isCustom: false, // Mark as standard currency
            createdBy: req.role || "system",
            createdById: req.adminId || 0,
            mode: "added"
          });

          created++;
          results.push({
            code: currencyData.code,
            status: 'created',
            currencyId: currency.currencyId
          });
        }
      } catch (error) {
        console.error(`Error processing currency ${currencyData.code}:`, error);
        results.push({
          code: currencyData.code,
          status: 'error',
          reason: error.message
        });
      }
    }

    await historyLogger(
      History,
      PROGRAMS.CURRENCY_MASTER,
      "REFRESH_CURRENCIES",
      req.adminId || 0,
      null,
      req.adminId,
      `Standard currencies refresh completed by "${req.role}". Created: ${created}, Skipped: ${skipped}`,
      { created, skipped, results }
    );

    res.status(200).json({
      message: "Standard currencies refresh completed",
      summary: {
        total: standardCurrencies.length,
        created,
        skipped,
        errors: results.filter(r => r.status === 'error').length
      },
      results
    });

  } catch (error) {
    console.error("Error refreshing currencies:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.CURRENCY_MASTER,
      "REFRESH_CURRENCIES",
      req.role,
      error.message,
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search currencies (for autocomplete/lookup)
exports.searchCurrencies = async (req, res) => {
  const { History, AuditTrail, Currency } = req.models;
  const { q, limit = 10, activeOnly = true } = req.query;

  if (!q || q.length < 1) {
    return res.status(400).json({ message: "Search query is required" });
  }

  try {
    const whereClause = {
      [Op.or]: [
        { currency_desc: { [Op.like]: `%${q}%` } },
        { symbol: { [Op.like]: `%${q}%` } },
        { code: { [Op.like]: `%${q}%` } }
      ]
    };

    if (activeOnly === 'true') {
      whereClause.isActive = true;
    }

    const currencies = await Currency.findAll({
      where: whereClause,
      limit: parseInt(limit),
      order: [['currency_desc', 'ASC']],
      attributes: ['currencyId', 'currency_desc', 'symbol', 'code', 'decimalPoints', 'isActive', 'isCustom']
    });

    res.status(200).json({
      message: "Currencies found",
      currencies: currencies.map(currency => ({
        currencyId: currency.currencyId,
        currency_desc: currency.currency_desc,
        symbol: currency.symbol,
        code: currency.code,
        decimalPoints: currency.decimalPoints,
        isActive: currency.isActive,
        isCustom: currency.isCustom,
        display: `${currency.currency_desc} (${currency.code})`, // For display in dropdowns
        // For frontend compatibility if needed
        fullName: currency.currency_desc
      }))
    });

  } catch (error) {
    console.error("Error searching currencies:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
