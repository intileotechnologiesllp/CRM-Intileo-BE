const Country = require("../../../../models/admin/masters/countryModel");
const Region = require("../../../../models/admin/masters/regionModel");
const Joi = require("joi");
const { Op } = require("sequelize");
const logAuditTrail = require("../../../../utils/auditTrailLogger").logAuditTrail;
const PROGRAMS = require("../../../../utils/programConstants");
const historyLogger = require("../../../../utils/historyLogger").logHistory; // Import history logger

// Add Country
exports.createCountry = async (req, res) => {
  const countrySchema = Joi.object({
    country_desc: Joi.string().min(3).max(100).required().messages({
      "string.empty": "Country description cannot be empty",
      "any.required": "Country description is required",
      "string.min": "Country description must be at least 3 characters",
      "string.max": "Country description cannot exceed 100 characters",
    }),
  });

  const { error } = countrySchema.validate(req.body);
  if (error) {
    
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  const { country_desc } = req.body;

  try {
    const country = await Country.create({
      country_desc,
      createdBy:req.role, // Set createdBy to "admin"
      createdById: req.adminId, // Set createdById to the authenticated admin ID
      mode: "added", // Set mode to "added"
    });
    console.log(country.countryID);
    console.log(country.createdById,"id of admin");
     // Get the creator ID from the country object

    
    await historyLogger(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "CREATE", // Mode
      country.createdById, // Created by (Admin ID)
      country.countryID, // Record ID (Country ID)
      null,
      `Country "${country_desc}" created by "${country.createdBy}"`, // Description
      { country_desc } // Changes logged as JSON
    );
    res.status(201).json({ message: "Country created successfully", country });
  } catch (error) {
    console.error("Error creating country:", error);
    await logAuditTrail(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "CREATE_COUNTRIES", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Countries with Regions
exports.getCountries = async (req, res) => {
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
    sortBy: Joi.string().valid("creationDate", "country_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    await logAuditTrail(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "GET_COUNTRIES", // Mode
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
        country_desc: {
          [Op.like]: `%${search}%`, // Search by country_desc
        },
      }),
      ...(createdBy && { createdBy }), // Filter by createdBy
      ...(mode && { mode }), // Filter by mode
    };

    const countries = await Country.findAndCountAll({
      where: whereClause, // Apply filters
      include: [
        {
          model: Region,
          as: "regions", // Alias defined in the association
          attributes: ["regionID", "region_desc", "countryId"], // Fetch only necessary fields
        },
      ],
      order: [[sortBy, order]], // Sorting
      limit: parseInt(limit), // Pagination limit
      offset: (page - 1) * limit, // Pagination offset
    });
    res.status(200).json({
      total: countries.count,
      pages: Math.ceil(countries.count / limit),
      currentPage: parseInt(page),
      countries: countries.rows,
    });
  } catch (error) {
    console.error("Error fetching countries with regions:", error);
    await logAuditTrail(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "GET_COUNTRIES", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Country
exports.editCountry = async (req, res) => {
  const countrySchema = Joi.object({
    country_desc: Joi.string().min(3).max(100).required().messages({
      "string.empty": "Country description cannot be empty",
      "any.required": "Country description is required",
      "string.min": "Country description must be at least 3 characters",
      "string.max": "Country description cannot exceed 100 characters",
    }),
  });

  const { error } = countrySchema.validate(req.body);
  if (error) {
    await logAuditTrail(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "EDIT_COUNTRY", // Mode
      req.role, // Admin ID from the authenticated request
      error.details[0].message, // Error description
      req.adminId
    );
    return res.status(400).json({ message: error.details[0].message }); // Return validation error
  }

  const { countryID } = req.params;
  const { country_desc } = req.body;

  try {
    const country = await Country.findByPk(countryID);
    if (!country) {
      await logAuditTrail(
        PROGRAMS.COUNTRY_MASTER, // Program ID for country management
        "EDIT_COUNTRY", // Mode
        req.role, // Admin ID from the authenticated request
        "Country not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Country not found" });
    }

    const originalData = {
      country_desc: country.country_desc,
    };

    await country.update({
      country_desc,
      mode: "modified", // Set mode to "modified"
    });

        // Capture the updated data
        const updatedData = {
          country_desc,
        };
    
        // Calculate the changes
        const changes = {};
        for (const key in updatedData) {
          if (originalData[key] !== updatedData[key]) {
            changes[key] = { from: originalData[key], to: updatedData[key] };
          }
        }

    await historyLogger(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "EDIT", // Mode
      country.createdById,
      countryID, // Record ID (Country ID)
      req.adminId,
      `Country "${country_desc}" modified by "${req.role}"`, // Description
      { country_desc } // Changes logged as JSON
    );
    res.status(200).json({ message: "Country updated successfully", country });
  } catch (error) {
    console.error("Error updating country:", error);
    await logAuditTrail(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "EDIT_COUNTRY", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Country
exports.deleteCountry = async (req, res) => {
  // const idSchema = Joi.object({
  //   id: Joi.number().integer().required().messages({
  //     "number.base": "Country ID must be a number",
  //     "any.required": "Country ID is required",
  //   }),
  // });

  // const { error } = idSchema.validate(req.params);
  // if (error) {
  //   return res.status(400).json({ message: error.details[0].message }); // Return validation error
  // }

  const { countryID } = req.params;

  try {
    const country = await Country.findByPk(countryID);
    if (!country) {
      await logAuditTrail(
        PROGRAMS.COUNTRY_MASTER, // Program ID for country management
        "DELETE_COUNTRY", // Mode
        req.role, // Admin ID from the authenticated request
        "Country not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Country not found" });
    }
    await historyLogger(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "DELETE", // Mode
      country.createdById,
      countryID, // Record ID (Country ID)
      req.adminId,
      `Country "${country.country_desc}" deleted by "${req.role}"`, // Description
      null // Changes logged as JSON
    );
    // Update mode to "deleted" before deleting
    await country.update({ mode: "deleted" });

    await country.destroy();
    res.status(200).json({ message: "Country deleted successfully" });
  } catch (error) {
    console.error("Error deleting country:", error);
    await logAuditTrail(
      PROGRAMS.COUNTRY_MASTER, // Program ID for country management
      "DELETE_COUNTRY", // Mode
      req.role, // Admin ID from the authenticated request
      error.message, // Error description
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};
