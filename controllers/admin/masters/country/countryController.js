const Country = require("../../../../models/admin/masters/countryModel");

// Add Country
exports.createCountry = async (req, res) => {
  const { country_desc } = req.body;

  try {
    const country = await Country.create({
      country_desc,
      createdBy: "admin", // Set createdBy to "admin"
      mode: "added", // Set mode to "added"
    });

    res.status(201).json({ message: "Country created successfully", country });
  } catch (error) {
    console.error("Error creating country:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get Countries
exports.getCountries = async (req, res) => {
  try {
    const countries = await Country.findAll();
    res.status(200).json(countries);
  } catch (error) {
    console.error("Error fetching countries:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit Country
exports.editCountry = async (req, res) => {
  const { id } = req.params;
  const { country_desc } = req.body;

  try {
    const country = await Country.findByPk(id);
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    await country.update({
      country_desc,
      mode: "modified", // Set mode to "modified"
    });

    res.status(200).json({ message: "Country updated successfully", country });
  } catch (error) {
    console.error("Error updating country:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Country
exports.deleteCountry = async (req, res) => {
  const { id } = req.params;

  try {
    const country = await Country.findByPk(id);
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }

    // Update mode to "deleted" before deleting
    await country.update({ mode: "deleted" });

    await country.destroy();

    res.status(200).json({ message: "Country deleted successfully" });
  } catch (error) {
    console.error("Error deleting country:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
