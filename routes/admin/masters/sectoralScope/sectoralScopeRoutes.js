const express = require("express");
const sectoralScopeController = require("../../../../controllers/admin/masters/sectoralScope/sectoralScopeController");

const router = express.Router();

router.post("/", sectoralScopeController.createSectoralScope); // Add sectoral scope
router.put("/:id", sectoralScopeController.editSectoralScope); // Edit sectoral scope
router.delete("/:id", sectoralScopeController.deleteSectoralScope); // Delete sectoral scope
router.get("/", sectoralScopeController.getSectoralScopes); // Get sectoral scopes

module.exports = router;
