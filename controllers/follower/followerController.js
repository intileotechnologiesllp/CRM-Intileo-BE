const Follower = require("../../models/follower/followerModel");
const MasterUser = require("../../models/master/masterUserModel");
const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const { Op } = require("sequelize");

/**
 * Add a follower to an entity (deal, lead, person, organization)
 * @route POST /api/followers/:entityType/:entityId
 */
exports.addFollower = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { userId } = req.body;
    const masterUserID = req.adminId;
    const addedBy = req.userId || req.adminId;

    // Validate entityType
    const validEntityTypes = ["deal", "lead", "person", "organization"];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    // Validate required fields
    if (!entityId) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: "Entity ID is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: "User ID is required",
      });
    }

    // Verify the entity exists
    let entity;
    switch (entityType) {
      case "deal":
        entity = await Deal.findOne({
          where: { dealId: entityId, masterUserID },
        });
        break;
      case "lead":
        entity = await Lead.findOne({
          where: { leadId: entityId, masterUserID },
        });
        break;
      case "person":
        entity = await Person.findOne({
          where: { personId: entityId, masterUserID },
        });
        break;
      case "organization":
        entity = await Organization.findOne({
          where: { leadOrganizationId: entityId, masterUserID },
        });
        break;
    }

    if (!entity) {
      return res.status(404).json({
        statusCode: 404,
        status: "error",
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found`,
      });
    }

    // Verify the user exists
    const user = await MasterUser.findOne({
      where: { masterUserID: userId },
    });

    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        status: "error",
        message: "User not found",
      });
    }

    // Check if already following
    const existingFollower = await Follower.findOne({
      where: {
        entityType,
        entityId,
        userId,
      },
    });

    if (existingFollower) {
      return res.status(409).json({
        statusCode: 409,
        status: "error",
        message: "User is already following this entity",
        data: existingFollower,
      });
    }

    // Add follower
    const follower = await Follower.create({
      entityType,
      entityId,
      userId,
      masterUserID,
      addedBy,
    });

    res.status(201).json({
      statusCode: 201,
      status: "success",
      message: "Follower added successfully",
      data: follower,
    });
  } catch (error) {
    console.error("Error adding follower:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to add follower",
      error: error.message,
    });
  }
};

/**
 * Remove a follower from an entity
 * @route DELETE /api/followers/:entityType/:entityId/:userId
 */
exports.removeFollower = async (req, res) => {
  try {
    const { entityType, entityId, userId } = req.params;
    const masterUserID = req.adminId;

    // Validate entityType
    const validEntityTypes = ["deal", "lead", "person", "organization"];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    // Find and delete follower
    const follower = await Follower.findOne({
      where: {
        entityType,
        entityId,
        userId,
        masterUserID,
      },
    });

    if (!follower) {
      return res.status(404).json({
        statusCode: 404,
        status: "error",
        message: "Follower relationship not found",
      });
    }

    await follower.destroy();

    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "Follower removed successfully",
    });
  } catch (error) {
    console.error("Error removing follower:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to remove follower",
      error: error.message,
    });
  }
};

/**
 * Get all followers for an entity
 * @route GET /api/followers/:entityType/:entityId
 */
exports.getFollowers = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const masterUserID = req.adminId;

    // Validate entityType
    const validEntityTypes = ["deal", "lead", "person", "organization"];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    // Get all followers for this entity
    const followers = await Follower.findAll({
      where: {
        entityType,
        entityId,
        masterUserID,
      },
      include: [
        {
          model: MasterUser,
          as: "user",
          attributes: ["masterUserID", "name", "email", "profilePhoto"],
        },
      ],
      order: [["addedAt", "DESC"]],
    });

    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "Followers retrieved successfully",
      data: {
        count: followers.length,
        followers: followers,
      },
    });
  } catch (error) {
    console.error("Error getting followers:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to get followers",
      error: error.message,
    });
  }
};

/**
 * Get follower count for an entity
 * @route GET /api/followers/:entityType/:entityId/count
 */
exports.getFollowerCount = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const masterUserID = req.adminId;

    // Validate entityType
    const validEntityTypes = ["deal", "lead", "person", "organization"];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    // Count followers
    const count = await Follower.count({
      where: {
        entityType,
        entityId,
        masterUserID,
      },
    });

    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "Follower count retrieved successfully",
      data: {
        count: count,
      },
    });
  } catch (error) {
    console.error("Error getting follower count:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to get follower count",
      error: error.message,
    });
  }
};

/**
 * Check if a user is following an entity
 * @route GET /api/followers/:entityType/:entityId/check/:userId
 */
exports.checkIfFollowing = async (req, res) => {
  try {
    const { entityType, entityId, userId } = req.params;
    const masterUserID = req.adminId;

    // Validate entityType
    const validEntityTypes = ["deal", "lead", "person", "organization"];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    // Check if following
    const follower = await Follower.findOne({
      where: {
        entityType,
        entityId,
        userId,
        masterUserID,
      },
    });

    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "Follow status checked successfully",
      data: {
        isFollowing: !!follower,
        follower: follower || null,
      },
    });
  } catch (error) {
    console.error("Error checking follow status:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to check follow status",
      error: error.message,
    });
  }
};

/**
 * Get all entities followed by a user
 * @route GET /api/followers/user/:userId
 */
exports.getUserFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { entityType } = req.query; // Optional filter by entity type
    const masterUserID = req.adminId;

    const where = {
      userId,
      masterUserID,
    };

    if (entityType) {
      const validEntityTypes = ["deal", "lead", "person", "organization"];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({
          statusCode: 400,
          status: "error",
          message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
        });
      }
      where.entityType = entityType;
    }

    const following = await Follower.findAll({
      where,
      order: [["addedAt", "DESC"]],
    });

    // Group by entity type
    const groupedFollowing = {
      deals: following.filter((f) => f.entityType === "deal"),
      leads: following.filter((f) => f.entityType === "lead"),
      persons: following.filter((f) => f.entityType === "person"),
      organizations: following.filter((f) => f.entityType === "organization"),
    };

    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "User following retrieved successfully",
      data: {
        totalCount: following.length,
        groupedFollowing: groupedFollowing,
        following: following,
      },
    });
  } catch (error) {
    console.error("Error getting user following:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to get user following",
      error: error.message,
    });
  }
};

/**
 * Bulk add followers to an entity
 * @route POST /api/followers/:entityType/:entityId/bulk
 */
exports.bulkAddFollowers = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { userIds } = req.body; // Array of user IDs
    const masterUserID = req.adminId;
    const addedBy = req.userId || req.adminId;

    // Validate entityType
    const validEntityTypes = ["deal", "lead", "person", "organization"];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: "userIds must be a non-empty array",
      });
    }

    // Verify the entity exists
    let entity;
    switch (entityType) {
      case "deal":
        entity = await Deal.findOne({
          where: { dealId: entityId, masterUserID },
        });
        break;
      case "lead":
        entity = await Lead.findOne({
          where: { leadId: entityId, masterUserID },
        });
        break;
      case "person":
        entity = await Person.findOne({
          where: { personId: entityId, masterUserID },
        });
        break;
      case "organization":
        entity = await Organization.findOne({
          where: { leadOrganizationId: entityId, masterUserID },
        });
        break;
    }

    if (!entity) {
      return res.status(404).json({
        statusCode: 404,
        status: "error",
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found`,
      });
    }

    // Get existing followers
    const existingFollowers = await Follower.findAll({
      where: {
        entityType,
        entityId,
        userId: { [Op.in]: userIds },
      },
      attributes: ["userId"],
    });

    const existingUserIds = existingFollowers.map((f) => f.userId);
    const newUserIds = userIds.filter((id) => !existingUserIds.includes(id));

    // Add new followers
    const followersToCreate = newUserIds.map((userId) => ({
      entityType,
      entityId,
      userId,
      masterUserID,
      addedBy,
    }));

    let created = [];
    if (followersToCreate.length > 0) {
      created = await Follower.bulkCreate(followersToCreate);
    }

    res.status(201).json({
      statusCode: 201,
      status: "success",
      message: "Bulk followers added successfully",
      data: {
        added: created.length,
        skipped: existingUserIds.length,
        total: userIds.length,
        followers: created,
      },
    });
  } catch (error) {
    console.error("Error bulk adding followers:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to bulk add followers",
      error: error.message,
    });
  }
};

/**
 * Bulk remove followers from an entity
 * @route DELETE /api/followers/:entityType/:entityId/bulk
 */
exports.bulkRemoveFollowers = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { userIds } = req.body; // Array of user IDs
    const masterUserID = req.adminId;

    // Validate entityType
    const validEntityTypes = ["deal", "lead", "person", "organization"];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        status: "error",
        message: "userIds must be a non-empty array",
      });
    }

    // Remove followers
    const deletedCount = await Follower.destroy({
      where: {
        entityType,
        entityId,
        userId: { [Op.in]: userIds },
        masterUserID,
      },
    });

    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "Bulk followers removed successfully",
      data: {
        removed: deletedCount,
        total: userIds.length,
      },
    });
  } catch (error) {
    console.error("Error bulk removing followers:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Failed to bulk remove followers",
      error: error.message,
    });
  }
};
