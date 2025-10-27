const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const leadFilterController = require("../../controllers/leads/leadFilterController");
const validatePrivilege = require("../../middlewares/validatePrivilege");

router.post("/create-filter",verifyToken, validatePrivilege(2, "create"), leadFilterController.saveLeadFilter);
router.get("/get-filters",verifyToken, validatePrivilege(2, "view"), leadFilterController.getLeadFilters);
router.get("/use-filter/:filterId",verifyToken, validatePrivilege(2, "view"), leadFilterController.useFilters);
router.post("/update-filters/:filterId",verifyToken, validatePrivilege(2, "edit"), leadFilterController.updateLeadFilter);
router.get("/get-lead-fields", verifyToken, validatePrivilege(2, "view"), leadFilterController.getLeadFields);
router.get("/get-all-contacts-persons", verifyToken, validatePrivilege(2, "view"), leadFilterController.getAllLeadContactPersons);

// Favorite filter routes
router.post("/add-to-favorites/:filterId", verifyToken, validatePrivilege(2, "edit"), leadFilterController.addFilterToFavorites);
router.delete("/remove-from-favorites/:filterId", verifyToken, validatePrivilege(2, "edit"), leadFilterController.removeFilterFromFavorites);
router.get("/get-favorites", verifyToken, validatePrivilege(2, "view"), leadFilterController.getFavoriteFilters);

module.exports = router;