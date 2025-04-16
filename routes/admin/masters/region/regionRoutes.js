const express = require("express");
const regionController = require("../../../../controllers/admin/masters/region/regionController");
const router = express.Router();

router.post("/create",regionController.createRegion); // Add region
router.get("/:countryId", regionController.getRegions); // Get regions by country
//router.get("/", regionController.getRegionsWithCountry); // Get regions with country details
router.post("/edit/:regionID", regionController.editRegion); // Edit region
router.post("/delete/:regionID", regionController.deleteRegion); // Delete region
router.post("/bulk-create", regionController.createRegions);
router.post("/bulk-edit", regionController.bulkEditRegions); // Bulk edit regions

module.exports = router;
