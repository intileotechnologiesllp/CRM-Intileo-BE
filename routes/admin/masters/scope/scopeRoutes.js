const express = require("express");
const scopeController = require("../../../../controllers/admin/masters/scope/scopeController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create",verifyToken, validatePrivilege(12, "create"), scopeController.createscope); // Add scope
router.post("/edit/:scopeId",verifyToken, validatePrivilege(12, "edit"), scopeController.editscope); // Edit scope
router.post("/delete/:scopeId",verifyToken, validatePrivilege(12, "delete"), scopeController.deletescope); // Delete scope
router.get("/get",verifyToken, validatePrivilege(12, "view"), scopeController.getscopes); // Get scopes

module.exports = router;
