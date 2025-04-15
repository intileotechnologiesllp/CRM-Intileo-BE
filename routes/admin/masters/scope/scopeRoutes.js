const express = require("express");
const scopeController = require("../../../../controllers/admin/masters/scope/scopeController");

const router = express.Router();

router.post("/create", scopeController.createscope); // Add scope
router.post("/edit/:scopeId", scopeController.editscope); // Edit scope
router.post("/delete/:scopeId", scopeController.deletescope); // Delete scope
router.get("/get", scopeController.getscopes); // Get scopes

module.exports = router;
