const express = require("express");
const currencyController = require("../../../../controllers/admin/masters/currency/currencyController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

router.post("/create",verifyToken, validatePrivilege(11, "create"), currencyController.createcurrency); // Add currency
router.post("/edit/:currencyId",  verifyToken, validatePrivilege(11, "edit"), currencyController.editcurrency); // Edit currency
router.post("/delete/:currencyId", verifyToken, validatePrivilege(11, "delete"), currencyController.deletecurrency); // Delete currency
router.get("/get",verifyToken, validatePrivilege(11, "view"), currencyController.getcurrencys); // Get currencys

module.exports = router;
