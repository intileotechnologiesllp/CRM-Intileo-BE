const express = require("express");
const scopeController = require("../../../../controllers/admin/masters/scope/scopeController");

const router = express.Router();

router.post("/", scopeController.createScope); // Add scope
router.put("/:id", scopeController.editScope); // Edit scope
router.delete("/:id", scopeController.deleteScope); // Delete scope
router.get("/", scopeController.getScopes); // Get scopes

module.exports = router;
