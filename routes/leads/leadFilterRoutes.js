const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const leadFilterController = require("../../controllers/leads/leadFilterController");
const validatePrivilege = require("../../middlewares/validatePrivilege");

router.post("/create-filter",verifyToken, validatePrivilege(2, "create"), leadFilterController.saveLeadFilter);
router.get("/get-filters",verifyToken, validatePrivilege(2, "view"), leadFilterController.getLeadFilters);
router.get("/use-filter/:filterId",verifyToken, validatePrivilege(2, "view"), leadFilterController.useFilters);
router.post("/update-filters/:filterId",verifyToken, validatePrivilege(2, "edit"), leadFilterController.updateLeadFilter);
router.get("/get-lead-fields", validatePrivilege(2, "view"), leadFilterController.getLeadFields);
router.get("/get-all-contacts-persons", validatePrivilege(2, "view"), leadFilterController.getAllLeadContactPersons);





module.exports = router;