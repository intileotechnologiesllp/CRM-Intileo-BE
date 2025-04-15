const express = require("express");
const regionController = require("../../../../controllers/admin/masters/region/regionController");

const router = express.Router();

router.post("/create", regionController.createRegion); // Add region
router.get("/:countryId", regionController.getRegions); // Get regions by country
//router.get("/", regionController.getRegionsWithCountry); // Get regions with country details
router.post("/edit/:regionID", regionController.editRegion); // Edit region
router.post("/delete/:regionID", regionController.deleteRegion); // Delete region

module.exports = router;
