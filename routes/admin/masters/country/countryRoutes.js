const express = require("express");
const countryController = require("../../../../controllers/admin/masters/country/countryController");
console.log("countryController", countryController); // Debugging line to check if the controller is loaded correctly
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create", verifyToken, countryController.createCountry); // Add country
router.get("/get", verifyToken, countryController.getCountries); // Get countries
router.post("/edit/:countryID",verifyToken, countryController.editCountry); // Edit country
router.post("/delete/:countryID",verifyToken, countryController.deleteCountry); // Delete country
router.get("/searchCountries", verifyToken, countryController.searchCountries); // Search countries
router.get("/refreshCountries", verifyToken, countryController.refreshCountries); // Refresh countries from external API
// router.post("/create", verifyToken,countryController.createCountry); // Add country
// router.get("/get", verifyToken,countryController.getCountries); // Get countries
// router.post("/edit/:countryID",verifyToken, countryController.editCountry); // Edit country
// router.post("/delete/:countryID", verifyToken,countryController.deleteCountry); // Delete country

module.exports = router;