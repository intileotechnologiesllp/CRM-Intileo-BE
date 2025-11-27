const express = require("express");
const currencyController = require("../../../../controllers/admin/masters/currency/currencyController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

// Currency CRUD routes (REST style)
// router.post("/", verifyToken, validatePrivilege(11, "create"), currencyController.createcurrency); // Create currency
// router.get("/", verifyToken, validatePrivilege(11, "view"), currencyController.getcurrencys); // Get currencies (with filtering)
router.put("/:currencyId", verifyToken,currencyController.editcurrency); // Update currency
router.delete("/:currencyId", verifyToken, currencyController.deletecurrency); // Deactivate currency

// Special endpoints
router.post("/get-different-code", verifyToken, currencyController.getDifferentCode); // Generate alternative codes
router.post("/refresh", verifyToken, currencyController.refreshCurrencies); // Populate standard currencies
router.get("/search", verifyToken, currencyController.searchCurrencies); // Search currencies

// Legacy routes for backwards compatibility
router.post("/create", verifyToken, currencyController.createcurrency); // Add currency (legacy)
router.post("/edit/:currencyId", verifyToken, currencyController.editcurrency); // Edit currency (legacy)
router.post("/delete/:currencyId", verifyToken, currencyController.deletecurrency); // Delete currency (legacy)
router.get("/get", verifyToken, currencyController.getcurrencys); // Get currencies (legacy)

module.exports = router;
