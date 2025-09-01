const express = require("express");
// const sectoralscopeController = require("../../../../controllers/admin/masters/sectoralscope/sectoralscopeController");
const sectoralscopeController = require("../../../../controllers/admin/masters/sectoralScope/sectoralScopeController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create",verifyToken, validatePrivilege(13, "create"), sectoralscopeController.createsectoralscope); // Add sectoralscope
router.post("/edit/:sectoralscopeId",verifyToken, validatePrivilege(13, "create"), sectoralscopeController.editsectoralscope); // Edit sectoralscope
router.post("/delete/:sectoralscopeId", verifyToken, validatePrivilege(13, "create"), sectoralscopeController.deletesectoralscope); // Delete sectoralscope
router.get("/get",verifyToken, validatePrivilege(13, "create"), sectoralscopeController.getsectoralscopes); // Get sectoralscopes

module.exports = router;
