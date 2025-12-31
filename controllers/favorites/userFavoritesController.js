const { Op } = require("sequelize");
const UserFavorites = require("../../models/favorites/userFavoritesModel");
const MasterUser = require("../../models/master/masterUserModel");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");

/**
 * Add a user to favorites
 */
exports.addUserToFavorites = async (req, res) => {
  const { MasterUser, UserFavorites, AuditTrail, History } = req.models;

  try {
    const { favoriteUserId, nickname } = req.body;
    const userId = req.adminId;

    // Validation
    if (!favoriteUserId) {
      return res.status(400).json({
        message: "Favorite user ID is required."
      });
    }

    // Check if user exists
    const userToFavorite = await MasterUser.findByPk(favoriteUserId);
    if (!userToFavorite) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    // Check if user is trying to favorite themselves
    if (parseInt(favoriteUserId) === parseInt(userId)) {
      return res.status(400).json({
        message: "You cannot add yourself to favorites."
      });
    }

    // Check if already in favorites (including inactive ones)
    const existingFavorite = await UserFavorites.findOne({
      where: {
        userId: userId,
        favoriteUserId: favoriteUserId
      }
    });

    if (existingFavorite) {
      if (existingFavorite.isActive) {
        // User is already in active favorites
        return res.status(409).json({
          message: "User is already in your favorites.",
          existingFavorite: {
            favoriteId: existingFavorite.favoriteId,
            nickname: existingFavorite.nickname
          }
        });
      } else {
        // User was previously favorited but deactivated, reactivate them
        await existingFavorite.update({
          isActive: true,
          nickname: nickname || existingFavorite.nickname || userToFavorite.name
        });

        // Log audit trail for reactivation
        await logAuditTrail(
          AuditTrail,
          PROGRAMS.LEAD_MANAGEMENT,
          "REACTIVATE_USER_FAVORITE",
          userId,
          `Reactivated user ${userToFavorite.name} in favorites`,
          existingFavorite.favoriteId
        );

        return res.status(200).json({
          message: "User reactivated in favorites successfully",
          favorite: {
            favoriteId: existingFavorite.favoriteId,
            favoriteUserId: existingFavorite.favoriteUserId,
            userName: userToFavorite.name,
            nickname: existingFavorite.nickname,
            createdAt: existingFavorite.createdAt,
            updatedAt: existingFavorite.updatedAt
          }
        });
      }
    }

    // Create the favorite
    const newFavorite = await UserFavorites.create({
      userId: userId,
      favoriteUserId: favoriteUserId,
      nickname: nickname || userToFavorite.name,
      isActive: true
    });

    // Log audit trail
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "ADD_USER_TO_FAVORITES",
      userId,
      `Added user ${userToFavorite.name} to favorites`,
      newFavorite.favoriteId
    );

    res.status(201).json({
      message: "User added to favorites successfully",
      favorite: {
        favoriteId: newFavorite.favoriteId,
        favoriteUserId: newFavorite.favoriteUserId,
        userName: userToFavorite.name,
        nickname: newFavorite.nickname,
        createdAt: newFavorite.createdAt
      }
    });

  } catch (error) {
    console.error("Error adding user to favorites:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Remove a user from favorites
 */
exports.removeUserFromFavorites = async (req, res) => {
  const { MasterUser, UserFavorites, AuditTrail, History } = req.models;
  try {
    const { favoriteUserId } = req.params;
    const userId = req.adminId;

    // Find the favorite
    const favorite = await UserFavorites.findOne({
      where: {
        userId: userId,
        favoriteUserId: favoriteUserId,
        isActive: true
      }
    });

    if (!favorite) {
      return res.status(404).json({
        message: "User not found in your favorites."
      });
    }

    // Soft delete (set isActive to false)
    await favorite.update({ isActive: false });

    // Log audit trail
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "REMOVE_USER_FROM_FAVORITES",
      userId,
      `Removed user from favorites`,
      favorite.favoriteId
    );

    res.status(200).json({
      message: "User removed from favorites successfully",
      removedFavorite: {
        favoriteId: favorite.favoriteId,
        favoriteUserId: favorite.favoriteUserId,
        nickname: favorite.nickname
      }
    });

  } catch (error) {
    console.error("Error removing user from favorites:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all favorite users for current user
 */
exports.getFavoriteUsers = async (req, res) => {
  const { MasterUser, UserFavorites, AuditTrail, History } = req.models;
  try {
    const userId = req.adminId;

    // Get favorites with user details
    const favorites = await UserFavorites.findAll({
      where: {
        userId: userId,
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });

    // Get user details for each favorite
    const favoriteUsersWithDetails = await Promise.all(
      favorites.map(async (favorite) => {
        const user = await MasterUser.findByPk(favorite.favoriteUserId, {
          attributes: ['masterUserID', 'name', 'email', 'isActive']
        });

        return {
          favoriteId: favorite.favoriteId,
          favoriteUserId: favorite.favoriteUserId,
          user: user ? {
            masterUserID: user.masterUserID,
            name: user.name,
            email: user.email,
            // role: user.role,
            isActive: user.isActive
          } : null,
          nickname: favorite.nickname,
          createdAt: favorite.createdAt
        };
      })
    );

    // Filter out favorites where user no longer exists
    const validFavorites = favoriteUsersWithDetails.filter(fav => fav.user !== null);

    res.status(200).json({
      message: "Favorite users retrieved successfully",
      data: validFavorites,
      total: validFavorites.length
    });

  } catch (error) {
    console.error("Error fetching favorite users:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update favorite user nickname
 */
exports.updateFavoriteNickname = async (req, res) => {
  const { MasterUser, UserFavorites, AuditTrail, History } = req.models;
  try {
    const { favoriteId } = req.params;
    const { nickname } = req.body;
    const userId = req.adminId;

    // Find the favorite
    const favorite = await UserFavorites.findOne({
      where: {
        favoriteId: favoriteId,
        userId: userId,
        isActive: true
      }
    });

    if (!favorite) {
      return res.status(404).json({
        message: "Favorite not found."
      });
    }

    // Update the nickname
    await favorite.update({ nickname: nickname });

    // Log audit trail
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "UPDATE_FAVORITE_NICKNAME",
      userId,
      `Updated favorite nickname to: ${nickname}`,
      favoriteId
    );

    res.status(200).json({
      message: "Favorite nickname updated successfully",
      updatedFavorite: {
        favoriteId: favorite.favoriteId,
        nickname: favorite.nickname,
        updatedAt: favorite.updatedAt
      }
    });

  } catch (error) {
    console.error("Error updating favorite nickname:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};
