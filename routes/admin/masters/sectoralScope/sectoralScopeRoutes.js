const express = require("express");
// const sectoralscopeController = require("../../../../controllers/admin/masters/sectoralscope/sectoralscopeController");
const sectoralscopeController = require("../../../../controllers/admin/masters/sectoralScope/sectoralScopeController");

const router = express.Router();

router.post("/create", sectoralscopeController.createsectoralscope); // Add sectoralscope
router.post("/edit/:sectoralscopeId", sectoralscopeController.editsectoralscope); // Edit sectoralscope
router.post("/delete/:sectoralscopeId", sectoralscopeController.deletesectoralscope); // Delete sectoralscope
router.get("/get", sectoralscopeController.getsectoralscopes); // Get sectoralscopes

module.exports = router;
