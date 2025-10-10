const express = require("express");
const currencyController = require("../../../../controllers/admin/masters/currency/currencyController");
const verifyToken = require("../../../../middlewares/authMiddleware").verifyToken; // Import verifyToken middleware if needed
const validatePrivilege = require("../../../../middlewares/validatePrivilege");
const router = express.Router();

// Currency CRUD routes (REST style)
// router.post("/", verifyToken, validatePrivilege(11, "create"), currencyController.createcurrency); // Create currency
// router.get("/", verifyToken, validatePrivilege(11, "view"), currencyController.getcurrencys); // Get currencies (with filtering)
router.put("/:currencyId", verifyToken, validatePrivilege(11, "edit"), currencyController.editcurrency); // Update currency
router.delete("/:currencyId", verifyToken, validatePrivilege(11, "delete"), currencyController.deletecurrency); // Deactivate currency

// Special endpoints
router.post("/get-different-code", verifyToken, validatePrivilege(11, "create"), currencyController.getDifferentCode); // Generate alternative codes
router.post("/refresh", verifyToken, validatePrivilege(11, "create"), currencyController.refreshCurrencies); // Populate standard currencies
router.get("/search", verifyToken, validatePrivilege(11, "view"), currencyController.searchCurrencies); // Search currencies

// Legacy routes for backwards compatibility
router.post("/create", verifyToken, validatePrivilege(11, "create"), currencyController.createcurrency); // Add currency (legacy)
router.post("/edit/:currencyId", verifyToken, validatePrivilege(11, "edit"), currencyController.editcurrency); // Edit currency (legacy)
router.post("/delete/:currencyId", verifyToken, validatePrivilege(11, "delete"), currencyController.deletecurrency); // Delete currency (legacy)
router.get("/get", verifyToken, validatePrivilege(11, "view"), currencyController.getcurrencys); // Get currencies (legacy)

module.exports = router;
