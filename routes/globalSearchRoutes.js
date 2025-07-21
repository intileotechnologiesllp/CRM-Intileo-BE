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

// Recent search statistics endpoint
router.get(
  "/recent/stats",
  verifyToken,
  globalSearchController.getRecentSearchStats
);

// Manual cleanup endpoint for recent searches
router.delete(
  "/recent/cleanup",
  verifyToken,
  globalSearchController.cleanupRecentSearches
);

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
