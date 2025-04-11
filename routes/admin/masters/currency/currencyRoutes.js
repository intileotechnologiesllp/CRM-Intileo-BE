const express = require("express");
const currencyController = require("../../../../controllers/admin/masters/currency/currencyController");

const router = express.Router();

router.post("/", currencyController.createCurrency); // Add currency
router.put("/:id", currencyController.editCurrency); // Edit currency
router.delete("/:id", currencyController.deleteCurrency); // Delete currency
router.get("/", currencyController.getCurrencies); // Get currencies

module.exports = router;
