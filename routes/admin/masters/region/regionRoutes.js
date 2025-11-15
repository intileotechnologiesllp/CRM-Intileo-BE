const express = require("express");
const regionController = require("../../../../controllers/admin/masters/region/regionController");
const router = express.Router();
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const verifyToken =
  require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed

router.post("/create", verifyToken,regionController.createRegion); // Add region
router.get("/:countryId", verifyToken, regionController.getRegions); // Get regions by country
//router.get("/", regionController.getRegionsWithCountry); // Get regions with country details
router.post("/edit/:regionID", verifyToken, regionController.editRegion); // Edit region
router.post("/delete/:regionID", verifyToken, regionController.deleteRegion); // Delete region
router.post("/bulk-create", verifyToken, regionController.createRegions);
router.post("/bulk-edit", verifyToken, regionController.bulkEditRegions); // Bulk edit regions

module.exports = router;
