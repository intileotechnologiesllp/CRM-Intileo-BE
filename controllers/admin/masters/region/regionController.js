const Joi = require("joi");
const { Op } = require("sequelize");
const Region = require("../../../../models/admin/masters/regionModel");
const Country = require("../../../../models/admin/masters/countryModel");
console.log(Region);

// Add Region
exports.createRegion = async (req, res) => {
  const regionSchema = Joi.object({
    region_desc: Joi.string().min(3).max(100).required().messages({
      "string.empty": "Region description cannot be empty",
      "any.required": "Region description is required",
      "string.min": "Region description must be at least 3 characters",
      "string.max": "Region description cannot exceed 100 characters",
    }),
    countryId: Joi.number().integer().required().messages({
      "number.base": "Country ID must be a number",
      "any.required": "Country ID is required",
    }),
  });

  const { error } = regionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { region_desc, countryId } = req.body;

  try {
    const country = await Country.findByPk(countryId);
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    const region = await Region.create({
      region_desc,
      countryId,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
    });

    res.status(201).json({ message: "Region created successfully", region });
  } catch (error) {
    console.error("Error creating region:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Add Regions in Bulk
exports.createRegions = async (req, res) => {
  const schema = Joi.object({
    countryId: Joi.number().integer().required().messages({
      "number.base": "Country ID must be a number",
      "any.required": "Country ID is required",
    }),
    regions: Joi.array()
      .items(
        Joi.object({
          region_desc: Joi.string().min(3).max(100).required().messages({
            "string.empty": "Region description cannot be empty",
            "any.required": "Region description is required",
            "string.min": "Region description must be at least 3 characters",
            "string.max": "Region description cannot exceed 100 characters",
          }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one region must be provided",
        "any.required": "Regions array is required",
      }),
  });

  // Validate request body
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { countryId, regions } = req.body;

  try {
    // Check if the country exists
    const country = await Country.findByPk(countryId);
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    // Create regions in bulk
    const createdRegions = await Region.bulkCreate(
      regions.map((region) => ({
        region_desc: region.region_desc,
        countryId, // Use the single countryId provided in the request
        createdBy: "admin", // Set createdBy to "admin"
        mode: "added", // Set mode to "added"
      }))
    );

    res.status(201).json({
      message: "Regions created successfully",
      regions: createdRegions,
    });
  } catch (error) {
    console.error("Error creating regions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Regions by Country
exports.getRegionsByCountry = async (req, res) => {
  const { countryID } = req.params;

  try {
    const regions = await Region.findAll({
      where: { countryId },
    });

    res.status(200).json(regions);
  } catch (error) {
    console.error("Error fetching regions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Regions with Country Details
// exports.getRegionsWithCountry = async (req, res) => {
//   try {
//     const regions = await Region.findAll({
//       include: [
//         {
//           model: Country,
//           attributes: ["id", "country_desc"], // Fetch only necessary fields
//         },
//       ],
//     });

//     res.status(200).json(regions);
//   } catch (error) {
//     console.error("Error fetching regions with country details:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// Get Regions with Pagination and Filters
exports.getRegions = async (req, res) => {
  const {
    search,
    countryId,
    page = 1,
    limit = 10,
    sortBy = "creationDate",
    order = "DESC",
  } = req.query;

  const querySchema = Joi.object({
    search: Joi.string().optional(),
    countryId: Joi.number().integer().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    sortBy: Joi.string().valid("creationDate", "region_desc").optional(),
    order: Joi.string().valid("ASC", "DESC").optional(),
  });

  const { error } = querySchema.validate(req.query);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const whereClause = {
      ...(search && {
        region_desc: {
          [Op.like]: `%${search}%`,
        },
      }),
      ...(countryId && { countryId }),
    };

    const regions = await Region.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Country,
          as: "country",
          attributes: ["countryID", "country_desc"],
        },
      ],
      order: [[sortBy, order]],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    res.status(200).json({
      total: regions.count,
      pages: Math.ceil(regions.count / limit),
      currentPage: parseInt(page),
      regions: regions.rows,
    });
  } catch (error) {
    console.error("Error fetching regions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Region
exports.editRegion = async (req, res) => {
  const regionSchema = Joi.object({
    region_desc: Joi.string().min(3).max(100).required().messages({
      "string.empty": "Region description cannot be empty",
      "any.required": "Region description is required",
      "string.min": "Region description must be at least 3 characters",
      "string.max": "Region description cannot exceed 100 characters",
    }),
    countryId: Joi.number().integer().required().messages({
      "number.base": "Country ID must be a number",
      "any.required": "Country ID is required",
    }),
  });

  const { error } = regionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { regionID } = req.params;
  const { region_desc, countryId } = req.body;

  try {
    const region = await Region.findByPk(regionID);
    if (!region) {
      return res.status(404).json({ message: "Region not found" });
    }

    await region.update({
      region_desc,
      countryId,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({ message: "Region updated successfully", region });
  } catch (error) {
    console.error("Error updating region:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Region
exports.deleteRegion = async (req, res) => {
  // const idSchema = Joi.object({
  //   id: Joi.number().integer().required().messages({
  //     "number.base": "Region ID must be a number",
  //     "any.required": "Region ID is required",
  //   }),
  // });

  // const { error } = idSchema.validate(req.params);
  // if (error) {
  //   return res.status(400).json({ message: error.details[0].message });
  // }

  const { regionID } = req.params;

  try {
    const region = await Region.findByPk(regionID);
    if (!region) {
      return res.status(404).json({ message: "Region not found" });
    }

    await region.update({ mode: "deleted" });

    await region.destroy();

    res.status(200).json({ message: "Region deleted successfully" });
  } catch (error) {
    console.error("Error deleting region:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Bulk Edit Regions
exports.bulkEditRegions = async (req, res) => {
  const schema = Joi.object({
    regions: Joi.array()
      .items(
        Joi.object({
          regionID: Joi.number().integer().required().messages({
            "number.base": "Region ID must be a number",
            "any.required": "Region ID is required",
          }),
          region_desc: Joi.string().min(3).max(100).optional().messages({
            "string.empty": "Region description cannot be empty",
            "string.min": "Region description must be at least 3 characters",
            "string.max": "Region description cannot exceed 100 characters",
          }),
          countryId: Joi.number().integer().optional().messages({
            "number.base": "Country ID must be a number",
          }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one region must be provided",
        "any.required": "Regions array is required",
      }),
  });

  // Validate request body
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { regions } = req.body;

  try {
    const updatedRegions = [];

    for (const regionData of regions) {
      const { regionID, region_desc, countryId } = regionData;

      // Find the region by ID
      const region = await Region.findByPk(regionID);
      if (!region) {
        return res
          .status(404)
          .json({ message: `Region with ID ${regionID} not found` });
      }

      // Update the region
      await region.update({
        ...(region_desc && { region_desc }),
        ...(countryId && { countryId }),
        mode: "modified", // Set mode to "modified"
      });

      updatedRegions.push(region);
    }

    res.status(200).json({
      message: "Regions updated successfully",
      regions: updatedRegions,
    });
  } catch (error) {
    console.error("Error updating regions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
