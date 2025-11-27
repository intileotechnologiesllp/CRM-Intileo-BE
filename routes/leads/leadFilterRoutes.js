const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const leadFilterController = require("../../controllers/leads/leadFilterController");
const validatePrivilege = require("../../middlewares/validatePrivilege");

router.post("/create-filter",verifyToken,leadFilterController.saveLeadFilter);
router.get("/get-filters",verifyToken,leadFilterController.getLeadFilters);
router.get("/use-filter/:filterId",verifyToken,leadFilterController.useFilters);
router.post("/update-filters/:filterId",verifyToken, validatePrivilege(19, "edit_shared_filters"), leadFilterController.updateLeadFilter);
router.get("/get-lead-fields", verifyToken,leadFilterController.getLeadFields);
router.get("/get-all-contacts-persons", verifyToken,leadFilterController.getAllLeadContactPersons);

// Favorite filter routes
router.post("/add-to-favorites/:filterId", verifyToken,leadFilterController.addFilterToFavorites);
router.delete("/remove-from-favorites/:filterId", verifyToken,leadFilterController.removeFilterFromFavorites);
router.get("/get-favorites", verifyToken,leadFilterController.getFavoriteFilters);

module.exports = router;