const express = require("express");
const sectoralScopeController = require("../../../../controllers/admin/masters/sectoralScope/sectoralScopeController");

const router = express.Router();

router.post("/create", sectoralScopeController.createSectoralScope); // Add sectoral scope
router.put("/edit/:id", sectoralScopeController.editSectoralScope); // Edit sectoral scope
router.delete("/delete/:id", sectoralScopeController.deleteSectoralScope); // Delete sectoral scope
router.get("/get", sectoralScopeController.getSectoralScopes); // Get sectoral scopes

module.exports = router;
