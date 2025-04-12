const express = require("express");
const regionController = require("../../../../controllers/admin/masters/region/regionController");

const router = express.Router();

router.post("/", regionController.createRegion); // Add region
router.get("/:countryId", regionController.getRegionsByCountry); // Get regions by country
router.get("/", regionController.getRegionsWithCountry); // Get regions with country details
router.put("/:id", regionController.editRegion); // Edit region
router.delete("/:id", regionController.deleteRegion); // Delete region

module.exports = router;
