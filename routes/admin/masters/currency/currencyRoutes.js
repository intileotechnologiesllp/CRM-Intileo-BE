const express = require("express");
const currencyController = require("../../../../controllers/admin/masters/currency/currencyController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const router = express.Router();

router.post("/create",verifyToken, currencyController.createcurrency); // Add currency
router.post("/edit/:currencyId", verifyToken,currencyController.editcurrency); // Edit currency
router.post("/delete/:currencyId", verifyToken,currencyController.deletecurrency); // Delete currency
router.get("/get",verifyToken, currencyController.getcurrencys); // Get currencys

module.exports = router;
