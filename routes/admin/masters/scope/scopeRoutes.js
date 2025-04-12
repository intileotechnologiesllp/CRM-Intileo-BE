const express = require("express");
const scopeController = require("../../../../controllers/admin/masters/scope/scopeController");

const router = express.Router();

router.post("/create", scopeController.createScope); // Add scope
router.put("/edit/:id", scopeController.editScope); // Edit scope
router.delete("/delete/:id", scopeController.deleteScope); // Delete scope
router.get("/get", scopeController.getScopes); // Get scopes

module.exports = router;
