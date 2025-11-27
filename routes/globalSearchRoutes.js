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

// Cleanup empty searches endpoint
router.delete(
  "/recent/empty",
  verifyToken,
  globalSearchController.cleanupEmptySearches
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

// Test endpoint for debugging person search
router.get(
  "/test-person",
  verifyToken,
  globalSearchController.testPersonSearch
);

router.get("/mark-recently-viewed", verifyToken, globalSearchController.markRecentlyViewed);
router.get("/get-recently-viewed", verifyToken, globalSearchController.getRecentlyViewed);
module.exports = router;
