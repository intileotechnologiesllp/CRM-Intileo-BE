const express = require("express");
const router = express.Router();
const userFavoritesController = require("../../controllers/favorites/userFavoritesController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const validatePrivilege = require("../../middlewares/validatePrivilege");

// Add a user to favorites
router.post("/add", verifyToken, validatePrivilege(2, "create"), userFavoritesController.addUserToFavorites);

// Remove a user from favorites
router.delete("/:favoriteUserId", verifyToken, validatePrivilege(2, "delete"), userFavoritesController.removeUserFromFavorites);

// Get all favorite users
router.get("/", verifyToken, validatePrivilege(2, "view"), userFavoritesController.getFavoriteUsers);

// Update favorite user nickname
router.put("/:favoriteId/nickname", verifyToken, validatePrivilege(2, "edit"), userFavoritesController.updateFavoriteNickname);

module.exports = router;