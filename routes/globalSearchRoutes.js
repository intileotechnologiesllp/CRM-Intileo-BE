const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const globalSearchController = require("../controllers/globalSearchController");

// Global search endpoint
router.get("/search", verifyToken, globalSearchController.globalSearch);

// Search suggestions/autocomplete endpoint
router.get(
  "/suggestions",
  verifyToken,
  globalSearchController.getSearchSuggestions
);

// Recent searches endpoint
router.get("/recent", verifyToken, globalSearchController.getRecentSearches);

// Clear recent searches endpoints
router.delete(
  "/recent",
  verifyToken,
  globalSearchController.clearRecentSearches
);
router.delete(
  "/recent/:searchId",
  verifyToken,
  globalSearchController.clearRecentSearches
);

module.exports = router;
