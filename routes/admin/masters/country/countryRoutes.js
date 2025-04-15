const express = require("express");
const countryController = require("../../../../controllers/admin/masters/country/countryController");
console.log("countryController", countryController); // Debugging line to check if the controller is loaded correctly

const router = express.Router();

router.post("/create", countryController.createCountry); // Add country
router.get("/get", countryController.getCountries); // Get countries
router.post("/edit/:countryID", countryController.editCountry); // Edit country
router.post("/delete/:countryID", countryController.deleteCountry); // Delete country

module.exports = router;