const express = require("express");
const regionController = require("../../../../controllers/admin/masters/region/regionController");
const router = express.Router();
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const verifyToken =
  require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed

router.post("/create", verifyToken, validatePrivilege(14, "create"), regionController.createRegion); // Add region
router.get("/:countryId", verifyToken, validatePrivilege(14, "view"), regionController.getRegions); // Get regions by country
//router.get("/", regionController.getRegionsWithCountry); // Get regions with country details
router.post("/edit/:regionID", verifyToken, validatePrivilege(14, "edit"), regionController.editRegion); // Edit region
router.post("/delete/:regionID", verifyToken, validatePrivilege(14, "delete"), regionController.deleteRegion); // Delete region
router.post("/bulk-create", verifyToken, validatePrivilege(14, "create"), regionController.createRegions);
router.post("/bulk-edit", verifyToken, validatePrivilege(14, "edit"), regionController.bulkEditRegions); // Bulk edit regions

module.exports = router;
