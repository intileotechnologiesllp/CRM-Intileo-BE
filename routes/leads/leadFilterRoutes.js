const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const leadFilterController = require("../../controllers/leads/leadFilterController");

router.post("/create-filter",verifyToken,leadFilterController.saveLeadFilter);
router.get("/get-filters",verifyToken,leadFilterController.getLeadFilters);
router.get("/use-filter/:filterId",verifyToken,leadFilterController.useFilters);
router.post("/update-filters/:filterId",verifyToken,leadFilterController.updateLeadFilter);
router.get("/get-lead-fields", leadFilterController.getLeadFields);





module.exports = router;