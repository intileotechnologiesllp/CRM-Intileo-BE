const express = require("express");
const currencyController = require("../../../../controllers/admin/masters/currency/currencyController");

const router = express.Router();

router.post("/create", currencyController.createcurrency); // Add currency
router.post("/edit/:currencyId", currencyController.editcurrency); // Edit currency
router.post("/delete/:currencyId", currencyController.deletecurrency); // Delete currency
router.get("/get", currencyController.getcurrencys); // Get currencys

module.exports = router;
