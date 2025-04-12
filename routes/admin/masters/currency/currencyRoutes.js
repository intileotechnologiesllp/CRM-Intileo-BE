const express = require("express");
const currencyController = require("../../../../controllers/admin/masters/currency/currencyController");

const router = express.Router();

router.post("/create", currencyController.createCurrency); // Add currency
router.put("/edit/:id", currencyController.editCurrency); // Edit currency
router.delete("/delete/:id", currencyController.deleteCurrency); // Delete currency
router.get("/get", currencyController.getCurrencies); // Get currencies

module.exports = router;
