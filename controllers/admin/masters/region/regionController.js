const Region = require("../../../../models/admin/masters/regionModel");
const Country = require("../../../../models/admin/masters/countryModel");
console.log(Region);

// Add Region
exports.createRegion = async (req, res) => {
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

// Get Regions by Country
exports.getRegionsByCountry = async (req, res) => {
  const { countryId } = req.params;

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
exports.getRegionsWithCountry = async (req, res) => {
  try {
    const regions = await Region.findAll({
      include: [
        {
          model: Country,
          attributes: ["id", "country_desc"], // Fetch only necessary fields
        },
      ],
    });

    res.status(200).json(regions);
  } catch (error) {
    console.error("Error fetching regions with country details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Region
exports.editRegion = async (req, res) => {
  const { id } = req.params;
  const { region_desc, countryId } = req.body;

  try {
    const region = await Region.findByPk(id);
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
  const { id } = req.params;

  try {
    const region = await Region.findByPk(id);
    if (!region) {
      return res.status(404).json({ message: "Region not found" });
    }

    // Update mode to "deleted" before deleting
    await region.update({ mode: "deleted" });

    await region.destroy();

    res.status(200).json({ message: "Region deleted successfully" });
  } catch (error) {
    console.error("Error deleting region:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
