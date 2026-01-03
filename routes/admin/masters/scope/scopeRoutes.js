const express = require("express");
const scopeController = require("../../../../controllers/admin/masters/scope/scopeController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const dbContextMiddleware = require("../../../../middlewares/dbContext");
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.use(dbContextMiddleware);

router.post("/create",verifyToken,scopeController.createscope); // Add scope
router.post("/edit/:scopeId",verifyToken, scopeController.editscope); // Edit scope
router.post("/delete/:scopeId",verifyToken, scopeController.deletescope); // Delete scope
router.get("/get",verifyToken, scopeController.getscopes); // Get scopes

module.exports = router;
