const Currency = require("../../../../models/admin/masters/currencyModel");

// Add Currency
exports.createCurrency = async (req, res) => {
  const { currency_desc } = req.body;

  try {
    const currency = await Currency.create({
      currency_desc,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
    });

    res
      .status(201)
      .json({ message: "Currency created successfully", currency });
  } catch (error) {
    console.error("Error creating currency:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Currency
exports.editCurrency = async (req, res) => {
  const { id } = req.params;
  const { currency_desc } = req.body;

  try {
    const currency = await Currency.findByPk(id);
    if (!currency) {
      return res.status(404).json({ message: "Currency not found" });
    }

    await currency.update({
      currency_desc,
      mode: "modified", // Set mode to "modified"
    });

    res
      .status(200)
      .json({ message: "Currency updated successfully", currency });
  } catch (error) {
    console.error("Error updating currency:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Currency
exports.deleteCurrency = async (req, res) => {
  const { id } = req.params;

  try {
    const currency = await Currency.findByPk(id);
    if (!currency) {
      return res.status(404).json({ message: "Currency not found" });
    }

    // Update mode to "deleted" before deleting
    await currency.update({ mode: "deleted" });

    await currency.destroy();

    res.status(200).json({ message: "Currency deleted successfully" });
  } catch (error) {
    console.error("Error deleting currency:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search, paginate, and sort currencies
exports.getCurrencies = async (req, res) => {
  const {
    search,
    createdBy,
    mode,
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;

  try {
    // Build the whereClause with filters
    const whereClause = {
      ...(search && {
        currency_desc: {
          [require("sequelize").Op.like]: `%${search}%`, // Search by currency_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const currencies = await Currency.findAndCountAll({
      where: whereClause, // Apply filters
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });

    res.status(200).json({
      total: currencies.count,
      pages: Math.ceil(currencies.count / limit),
      currentPage: parseInt(page),
      currencies: currencies.rows,
    });
  } catch (error) {
    console.error("Error fetching currencies:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
