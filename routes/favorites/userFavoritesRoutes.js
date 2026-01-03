const express = require("express");
const router = express.Router();
const userFavoritesController = require("../../controllers/favorites/userFavoritesController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
const validatePrivilege = require("../../middlewares/validatePrivilege");



router.use(dbContextMiddleware);


// Add a user to favorites
router.post("/add", verifyToken,userFavoritesController.addUserToFavorites);

// Remove a user from favorites
router.delete("/:favoriteUserId", verifyToken, userFavoritesController.removeUserFromFavorites);

// Get all favorite users
router.get("/", verifyToken, userFavoritesController.getFavoriteUsers);

// Update favorite user nickname
router.put("/:favoriteId/nickname", verifyToken, userFavoritesController.updateFavoriteNickname);

module.exports = router;