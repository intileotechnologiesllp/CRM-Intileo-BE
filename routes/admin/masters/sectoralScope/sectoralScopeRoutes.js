const express = require("express");
// const sectoralscopeController = require("../../../../controllers/admin/masters/sectoralscope/sectoralscopeController");
const sectoralscopeController = require("../../../../controllers/admin/masters/sectoralScope/sectoralScopeController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const dbContextMiddleware = require("../../../../middlewares/dbContext");
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.use(dbContextMiddleware);

router.post("/create",verifyToken,sectoralscopeController.createsectoralscope); // Add sectoralscope
router.post("/edit/:sectoralscopeId",verifyToken, sectoralscopeController.editsectoralscope); // Edit sectoralscope
router.post("/delete/:sectoralscopeId", verifyToken, sectoralscopeController.deletesectoralscope); // Delete sectoralscope
router.get("/get",verifyToken, sectoralscopeController.getsectoralscopes); // Get sectoralscopes

module.exports = router;
