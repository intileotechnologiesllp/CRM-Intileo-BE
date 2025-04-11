const express = require("express");
const countryController = require("../../../../controllers/admin/masters/country/countryController");

const router = express.Router();

router.post("/", countryController.createCountry); // Add country
router.get("/", countryController.getCountries); // Get countries
router.put("/:id", countryController.editCountry); // Edit country
router.delete("/:id", countryController.deleteCountry); // Delete country

module.exports = router;
