const {
  VisibilityGroup,
  GroupMembership,
  PipelineVisibilityRule,
  ItemVisibilityRule,
} = require("../models/admin/visibilityAssociations");
const { Op } = require("sequelize");

/**
 * Middleware to check if user has access to view/edit specific pipelines
 */
const checkPipelineAccess = (requiredPermission = "canView") => {
  return async (req, res, next) => {
    try {
      const userId = req.adminId;
      const userRole = req.role;
      const { pipelineId } = req.params;

      // Admin users bypass all restrictions
      if (userRole === "admin") {
        return next();
      }

      // If no pipelineId in params, skip check
      if (!pipelineId) {
        return next();
      }

      // Get user's current group membership
      const membership = await GroupMembership.findOne({
        where: {
          userId,
          isActive: true,
        },
        include: [
          {
            model: VisibilityGroup,
            as: "group",
            where: { isActive: true },
          },
        ],
      });

      if (!membership) {
        return res.status(403).json({
          message: "Access denied. No group membership found.",
        });
      }

      // Check pipeline visibility rule
      const pipelineRule = await PipelineVisibilityRule.findOne({
        where: {
          groupId: membership.groupId,
          pipelineId,
          isActive: true,
        },
      });

      if (!pipelineRule) {
        return res.status(403).json({
          message: "Access denied. Pipeline not visible to your group.",
        });
      }

      // Check specific permission
      if (!pipelineRule[requiredPermission]) {
        return res.status(403).json({
          message: `Access denied. You don't have ${requiredPermission} permission for this pipeline.`,
        });
      }

      // Store pipeline rule in request for later use
      req.pipelineAccess = pipelineRule;
      next();
    } catch (error) {
      console.error("Error in pipeline access check:", error);
      res.status(500).json({
        message: "Error checking pipeline access.",
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to filter data based on user's visibility group
 */
const applyVisibilityFilter = (entityType) => {
  return async (req, res, next) => {
    try {
      const userId = req.adminId;
      const userRole = req.role;

      // Admin users bypass all restrictions
      if (userRole === "admin") {
        req.visibilityFilter = {}; // No filter for admin
        return next();
      }

      // Get user's current group membership
      const membership = await GroupMembership.findOne({
        where: {
          userId,
          isActive: true,
        },
        include: [
          {
            model: VisibilityGroup,
            as: "group",
            where: { isActive: true },
          },
        ],
      });

      if (!membership) {
        req.visibilityFilter = { masterUserID: userId }; // Fallback to user-only data
        return next();
      }

      // Get item visibility rules for this entity type
      const itemRule = await ItemVisibilityRule.findOne({
        where: {
          groupId: membership.groupId,
          entityType,
          isActive: true,
        },
      });

      if (!itemRule) {
        req.visibilityFilter = { masterUserID: userId }; // Fallback to user-only data
        return next();
      }

      // Apply visibility filter based on rule
      let visibilityFilter = {};

      switch (itemRule.defaultVisibility) {
        case "owner_only":
          visibilityFilter = { masterUserID: userId };
          break;

        case "group_only":
          // Get all users in the same group
          const groupUsers = await GroupMembership.findAll({
            where: {
              groupId: membership.groupId,
              isActive: true,
            },
            attributes: ["userId"],
          });
          const userIds = groupUsers.map((gu) => gu.userId);
          visibilityFilter = { masterUserID: { [Op.in]: userIds } };
          break;

        case "everyone":
          visibilityFilter = {}; // No filter - see everything
          break;

        case "item_owners_visibility_group":
        default:
          // This is the default Pipedrive behavior - see items from users in your visibility group
          const groupUsers2 = await GroupMembership.findAll({
            where: {
              groupId: membership.groupId,
              isActive: true,
            },
            attributes: ["userId"],
          });
          const userIds2 = groupUsers2.map((gu) => gu.userId);
          visibilityFilter = { masterUserID: { [Op.in]: userIds2 } };
          break;
      }

      req.visibilityFilter = visibilityFilter;
      req.itemPermissions = {
        canCreate: itemRule.canCreate,
        canView: itemRule.canView,
        canEdit: itemRule.canEdit,
        canDelete: itemRule.canDelete,
        canExport: itemRule.canExport,
        canBulkEdit: itemRule.canBulkEdit,
      };

      next();
    } catch (error) {
      console.error("Error applying visibility filter:", error);
      req.visibilityFilter = { masterUserID: req.adminId }; // Fallback to safe filter
      next();
    }
  };
};

/**
 * Middleware to check item-level permissions
 */
const checkItemPermission = (requiredPermission) => {
  return (req, res, next) => {
    const userRole = req.role;

    // Admin users bypass all restrictions
    if (userRole === "admin") {
      return next();
    }

    // Check if permissions were set by visibility filter
    if (!req.itemPermissions) {
      return res.status(403).json({
        message: "Access denied. No item permissions found.",
      });
    }

    if (!req.itemPermissions[requiredPermission]) {
      return res.status(403).json({
        message: `Access denied. You don't have ${requiredPermission} permission.`,
      });
    }

    next();
  };
};

/**
 * Get user's accessible pipelines
 */
const getUserAccessiblePipelines = async (userId, userRole) => {
  try {
    // Admin users can access all pipelines
    if (userRole === "admin") {
      return null; // Return null to indicate no filter needed
    }

    // Get user's group membership
    const membership = await GroupMembership.findOne({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      return []; // No group membership = no pipeline access
    }

    // Get accessible pipeline IDs
    const pipelineRules = await PipelineVisibilityRule.findAll({
      where: {
        groupId: membership.groupId,
        canView: true,
        isActive: true,
      },
      attributes: ["pipelineId"],
    });

    return pipelineRules.map((rule) => rule.pipelineId);
  } catch (error) {
    console.error("Error getting accessible pipelines:", error);
    return []; // Return empty array on error for safety
  }
};

/**
 * Utility function to add visibility filtering to existing queries
 */
const addVisibilityToQuery = async (
  baseWhere,
  userId,
  userRole,
  entityType
) => {
  try {
    // Admin users see everything
    if (userRole === "admin") {
      return baseWhere;
    }

    // Get user's group membership
    const membership = await GroupMembership.findOne({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      return { ...baseWhere, masterUserID: userId }; // Fallback to user-only data
    }

    // Get item visibility rule
    const itemRule = await ItemVisibilityRule.findOne({
      where: {
        groupId: membership.groupId,
        entityType,
        isActive: true,
      },
    });

    if (!itemRule) {
      return { ...baseWhere, masterUserID: userId }; // Fallback to user-only data
    }

    // Apply visibility filter
    let visibilityWhere = {};

    switch (itemRule.defaultVisibility) {
      case "owner_only":
        visibilityWhere = { masterUserID: userId };
        break;

      case "group_only":
      case "item_owners_visibility_group":
        const groupUsers = await GroupMembership.findAll({
          where: {
            groupId: membership.groupId,
            isActive: true,
          },
          attributes: ["userId"],
        });
        const userIds = groupUsers.map((gu) => gu.userId);
        visibilityWhere = { masterUserID: { [Op.in]: userIds } };
        break;

      case "everyone":
        visibilityWhere = {}; // No additional filter
        break;

      default:
        visibilityWhere = { masterUserID: userId };
        break;
    }

    return { ...baseWhere, ...visibilityWhere };
  } catch (error) {
    console.error("Error adding visibility to query:", error);
    return { ...baseWhere, masterUserID: userId }; // Fallback to safe filter
  }
};

module.exports = {
  checkPipelineAccess,
  applyVisibilityFilter,
  checkItemPermission,
  getUserAccessiblePipelines,
  addVisibilityToQuery,
};
