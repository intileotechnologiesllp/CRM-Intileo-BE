const {
  VisibilityGroup,
  GroupMembership,
  PipelineVisibilityRule,
  ItemVisibilityRule,
} = require("../../models/admin/visibilityAssociations");
const Pipeline = require("../../models/deals/pipelineModel");
const MasterUser = require("../../models/master/masterUserModel");
const { Op } = require("sequelize");
const sequelize = require("../../config/db");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const historyLogger = require("../../utils/historyLogger").logHistory;

// Get all visibility groups for the current user
exports.getVisibilityGroups = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History, GroupMembership, MasterUser, ItemVisibilityRule } = req.models;
  const { includeInactive = "false" } = req.query;
  const masterUserID = req.adminId;

  try {
    let whereClause = { masterUserID };

    if (includeInactive !== "true") {
      whereClause.isActive = true;
    }

    const groups = await VisibilityGroup.findAll({
      where: whereClause,
      include: [
        {
          model: GroupMembership,
          as: "memberships",
          include: [
            {
              model: MasterUser,
              as: "user",
              attributes: [
                "masterUserID",
                "name",
                "email",
                "loginType",
                "designation",
                "department",
                "status",
              ],
            },
          ],
          where: { isActive: true },
          required: false,
        },
        {
          model: PipelineVisibilityRule,
          as: "pipelineRules",
          include: [
            {
              model: Pipeline,
              as: "pipeline",
              attributes: ["pipelineId", "pipelineName", "color"],
            },
          ],
          where: { isActive: true },
          required: false,
        },
        {
          model: ItemVisibilityRule,
          as: "itemRules",
          where: { isActive: true },
          required: false,
        },
        {
          model: VisibilityGroup,
          as: "childGroups",
          where: { isActive: true },
          required: false,
        },
        {
          model: VisibilityGroup,
          as: "parentGroup",
          attributes: ["groupId", "groupName"],
          required: false,
        },
      ],
      order: [
        ["isDefault", "DESC"],
        ["hierarchyLevel", "ASC"],
        ["groupName", "ASC"],
      ],
    });

    // Fetch all MasterUsers for use in the default group
    const allMasterUsers = await MasterUser.findAll({
      attributes: [
        "masterUserID",
        "name",
        "email",
        "loginType",
        "designation",
        "department",
        "status",
      ],
    });

    // Process groups for frontend display
    const processedGroups = groups.map((group) => {
      const groupData = group.toJSON();

      // Count users in group
      groupData.userCount = groupData.memberships?.length || 0;

      // Count visible pipelines
      groupData.visiblePipelinesCount =
        groupData.pipelineRules?.filter((rule) => rule.canView)?.length || 0;

      // Get total pipelines for this user
      groupData.totalPipelinesCount = 0; // Will be set below

      // Process item visibility summary
      groupData.itemVisibilitySummary =
        groupData.itemRules?.reduce((acc, rule) => {
          acc[rule.entityType] = {
            defaultVisibility: rule.defaultVisibility,
            canCreate: rule.canCreate,
            canView: rule.canView,
            canEdit: rule.canEdit,
            canDelete: rule.canDelete,
          };
          return acc;
        }, {}) || {};

      // If this is the default group, add all master users
      if (groupData.isDefault) {
        groupData.users = allMasterUsers.map((user) => ({
          id: user.masterUserID,
          name: user.name,
          email: user.email,
          loginType: user.loginType,
          designation: user.designation,
          department: user.department,
          status: user.status,
        }));
      }

      return groupData;
    });

    // Get total pipeline count for user
    const totalPipelines = await Pipeline.count({
      where: { masterUserID, isActive: true },
    });

    // Update visible pipeline counts
    processedGroups.forEach((group) => {
      group.totalPipelinesCount = totalPipelines;
    });

    res.status(200).json({
      message: "Visibility groups retrieved successfully.",
      groups: processedGroups,
      totalGroups: processedGroups.length,
      defaultGroup: processedGroups.find((g) => g.isDefault),
    });
  } catch (error) {
    console.error("Error fetching visibility groups:", error);
    res.status(500).json({
      message: "Failed to fetch visibility groups.",
      error: error.message,
    });
  }
};

// Get a single visibility group with details
exports.getVisibilityGroupById = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History, GroupMembership, MasterUser, ItemVisibilityRule } = req.models;
  const { groupId } = req.params;
  const masterUserID = req.adminId;

  try {
    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
      include: [
        {
          model: GroupMembership,
          as: "memberships",
          include: [
            {
              model: MasterUser,
              as: "user",
              attributes: [
                "masterUserID",
                "name",
                "email",
                "loginType",
                "designation",
                "department",
                "status",
              ],
            },
          ],
          where: { isActive: true },
          required: false,
        },
        {
          model: PipelineVisibilityRule,
          as: "pipelineRules",
          include: [
            {
              model: Pipeline,
              as: "pipeline",
              attributes: ["pipelineId", "pipelineName", "color", "isDefault"],
            },
          ],
          required: false,
        },
        {
          model: ItemVisibilityRule,
          as: "itemRules",
          required: false,
        },
        {
          model: VisibilityGroup,
          as: "childGroups",
          attributes: ["groupId", "groupName"],
          where: { isActive: true },
          required: false,
        },
        {
          model: VisibilityGroup,
          as: "parentGroup",
          attributes: ["groupId", "groupName"],
          required: false,
        },
      ],
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    // Get all available pipelines for comparison
    const allPipelines = await Pipeline.findAll({
      where: { masterUserID, isActive: true },
      attributes: ["pipelineId", "pipelineName", "color", "isDefault"],
      order: [
        ["isDefault", "DESC"],
        ["pipelineName", "ASC"],
      ],
    });

    // Get all users for potential group membership
    const allUsers = await MasterUser.findAll({
      where: {
        masterUserID: { [Op.ne]: masterUserID }, // Exclude the main user
        status: "active", // Use status instead of isActive
      },
      attributes: [
        "masterUserID",
        "name",
        "email",
        "loginType",
        "designation",
        "department",
        "status",
      ],
      order: [["name", "ASC"]],
    });

    const groupData = group.toJSON();

    // Add pipeline visibility status
    groupData.pipelineVisibility = allPipelines.map((pipeline) => {
      const rule = groupData.pipelineRules?.find(
        (r) => r.pipelineId === pipeline.pipelineId
      );
      return {
        ...pipeline,
        hasAccess: !!rule?.canView,
        canEdit: !!rule?.canEdit,
        canDelete: !!rule?.canDelete,
        canCreateDeals: !!rule?.canCreateDeals,
      };
    });

    // Add available users (not in this group)
    const groupUserIds = groupData.memberships?.map((m) => m.userId) || [];
    groupData.availableUsers = allUsers.filter(
      (user) => !groupUserIds.includes(user.masterUserID)
    );

    res.status(200).json({
      message: "Visibility group retrieved successfully.",
      group: groupData,
      allPipelines,
      allUsers,
    });
  } catch (error) {
    console.error("Error fetching visibility group:", error);
    res.status(500).json({
      message: "Failed to fetch visibility group.",
      error: error.message,
    });
  }
};

// Create a new visibility group
exports.createVisibilityGroup = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History, GroupMembership, MasterUser, ItemVisibilityRule, AuditTrail } = req.models;
  const {
    groupName,
    description,
    parentGroupId,
    isDefault = false,
    pipelineAccess = [],
    itemRules = {},
    users = [],
  } = req.body;

  const masterUserID = req.adminId;
  const createdBy = req.adminId;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  try {
    // Validate required fields
    if (!groupName || groupName.trim().length === 0) {
      return res.status(400).json({
        message: "Group name is required.",
      });
    }

    if (groupName.trim().length > 70) {
      return res.status(400).json({
        message: "Group name cannot exceed 70 characters.",
      });
    }

    // Check if group name already exists for this user
    const existingGroup = await VisibilityGroup.findOne({
      where: {
        groupName: groupName.trim(),
        masterUserID,
      },
    });

    if (existingGroup) {
      return res.status(409).json({
        message: `A visibility group with name "${groupName}" already exists.`,
      });
    }

    // Calculate hierarchy level if parent group is specified
    let hierarchyLevel = 0;
    if (parentGroupId) {
      const parentGroup = await VisibilityGroup.findOne({
        where: { groupId: parentGroupId, masterUserID },
      });

      if (!parentGroup) {
        return res.status(404).json({
          message: "Parent group not found.",
        });
      }

      hierarchyLevel = parentGroup.hierarchyLevel + 1;

      // Limit hierarchy depth (like Pipedrive)
      if (hierarchyLevel > 3) {
        return res.status(400).json({
          message: "Maximum hierarchy depth (3 levels) exceeded.",
        });
      }
    }

    // If this is set as default, unset other default groups
    if (isDefault) {
      await VisibilityGroup.update(
        { isDefault: false },
        { where: { masterUserID, isDefault: true } }
      );
    }

    // Start transaction
    const transaction = await clientConnection.transaction();

    try {
      // Create the visibility group
      const group = await VisibilityGroup.create(
        {
          groupName: groupName.trim(),
          description: description?.trim() || null,
          parentGroupId: parentGroupId || null,
          masterUserID,
          isDefault,
          hierarchyLevel,
          createdBy,
        },
        { transaction }
      );

      // Create default item visibility rules
      const defaultEntityTypes = [
        "leads",
        "deals",
        "people",
        "organizations",
        "products",
        "activities",
      ];

      for (const entityType of defaultEntityTypes) {
        const ruleConfig = itemRules[entityType] || {};

        await ItemVisibilityRule.create(
          {
            groupId: group.groupId,
            entityType,
            masterUserID,
            defaultVisibility:
              ruleConfig.defaultVisibility || "item_owners_visibility_group",
            canCreate:
              ruleConfig.canCreate !== undefined ? ruleConfig.canCreate : true,
            canView:
              ruleConfig.canView !== undefined ? ruleConfig.canView : true,
            canEdit:
              ruleConfig.canEdit !== undefined ? ruleConfig.canEdit : true,
            canDelete:
              ruleConfig.canDelete !== undefined ? ruleConfig.canDelete : false,
            canExport:
              ruleConfig.canExport !== undefined ? ruleConfig.canExport : false,
            canBulkEdit:
              ruleConfig.canBulkEdit !== undefined
                ? ruleConfig.canBulkEdit
                : false,
            createdBy,
          },
          { transaction }
        );
      }

      // Create pipeline visibility rules
      if (pipelineAccess && pipelineAccess.length > 0) {
        for (const pipelineRule of pipelineAccess) {
          await PipelineVisibilityRule.create(
            {
              groupId: group.groupId,
              pipelineId: pipelineRule.pipelineId,
              masterUserID,
              canView:
                pipelineRule.canView !== undefined
                  ? pipelineRule.canView
                  : true,
              canEdit:
                pipelineRule.canEdit !== undefined
                  ? pipelineRule.canEdit
                  : false,
              canDelete:
                pipelineRule.canDelete !== undefined
                  ? pipelineRule.canDelete
                  : false,
              canCreateDeals:
                pipelineRule.canCreateDeals !== undefined
                  ? pipelineRule.canCreateDeals
                  : true,
              createdBy,
            },
            { transaction }
          );
        }
      } else {
        // Grant access to all pipelines by default
        const allPipelines = await Pipeline.findAll({
          where: { masterUserID, isActive: true },
          attributes: ["pipelineId"],
        });

        for (const pipeline of allPipelines) {
          await PipelineVisibilityRule.create(
            {
              groupId: group.groupId,
              pipelineId: pipeline.pipelineId,
              masterUserID,
              canView: true,
              canEdit: false,
              canDelete: false,
              canCreateDeals: true,
              createdBy,
            },
            { transaction }
          );
        }
      }

      // Add users to the group
      if (users && users.length > 0) {
        for (const userId of users) {
          await GroupMembership.create(
            {
              groupId: group.groupId,
              userId,
              masterUserID,
              assignedBy: createdBy,
            },
            { transaction }
          );
        }
      }

      await transaction.commit();

      await historyLogger(
        History,
        PROGRAMS.LEAD_MANAGEMENT,
        "VISIBILITY_GROUP_CREATION",
        masterUserID,
        group.groupId,
        null,
        `Visibility group "${group.groupName}" created with ${
          users?.length || 0
        } users`,
        null
      );

      res.status(201).json({
        message: "Visibility group created successfully.",
        group,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating visibility group:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "VISIBILITY_GROUP_CREATION",
      null,
      "Error creating visibility group: " + error.message,
      null
    );
    res.status(500).json({
      message: "Failed to create visibility group.",
      error: error.message,
    });
  }
};

// Update a visibility group
exports.updateVisibilityGroup = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History, } = req.models;
  const { groupId } = req.params;
  const { groupName, description, parentGroupId, isDefault, isActive } =
    req.body;

  const masterUserID = req.adminId;
  const updatedBy = req.adminId;

  try {
    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    // Prevent modifying default group name
    if (group.isDefault && groupName && groupName !== group.groupName) {
      return res.status(400).json({
        message: "Cannot change the name of the default group.",
      });
    }

    // Check for name conflicts if groupName is being updated
    if (groupName && groupName !== group.groupName) {
      const existingGroup = await VisibilityGroup.findOne({
        where: {
          groupName: groupName.trim(),
          masterUserID,
          groupId: { [Op.ne]: groupId },
        },
      });

      if (existingGroup) {
        return res.status(409).json({
          message: `A visibility group with name "${groupName}" already exists.`,
        });
      }
    }

    // Handle hierarchy changes
    let newHierarchyLevel = group.hierarchyLevel;
    if (parentGroupId !== undefined && parentGroupId !== group.parentGroupId) {
      if (parentGroupId) {
        const parentGroup = await VisibilityGroup.findOne({
          where: { groupId: parentGroupId, masterUserID },
        });

        if (!parentGroup) {
          return res.status(404).json({
            message: "Parent group not found.",
          });
        }

        newHierarchyLevel = parentGroup.hierarchyLevel + 1;

        if (newHierarchyLevel > 3) {
          return res.status(400).json({
            message: "Maximum hierarchy depth (3 levels) exceeded.",
          });
        }
      } else {
        newHierarchyLevel = 0;
      }
    }

    // If this is being set as default, unset other default groups
    if (isDefault === true && !group.isDefault) {
      await VisibilityGroup.update(
        { isDefault: false },
        {
          where: {
            masterUserID,
            isDefault: true,
            groupId: { [Op.ne]: groupId },
          },
        }
      );
    }

    // Store old values for history
    const oldValues = { ...group.toJSON() };

    // Update the group
    await group.update({
      groupName: groupName ? groupName.trim() : group.groupName,
      description:
        description !== undefined
          ? description?.trim() || null
          : group.description,
      parentGroupId:
        parentGroupId !== undefined ? parentGroupId : group.parentGroupId,
      hierarchyLevel: newHierarchyLevel,
      isDefault: isDefault !== undefined ? isDefault : group.isDefault,
      isActive: isActive !== undefined ? isActive : group.isActive,
      updatedBy,
    });

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "VISIBILITY_GROUP_UPDATE",
      masterUserID,
      group.groupId,
      null,
      `Visibility group "${group.groupName}" updated`,
      { old: oldValues, new: group.toJSON() }
    );

    res.status(200).json({
      message: "Visibility group updated successfully.",
      group,
    });
  } catch (error) {
    console.error("Error updating visibility group:", error);
    res.status(500).json({
      message: "Failed to update visibility group.",
      error: error.message,
    });
  }
};

// Delete a visibility group
exports.deleteVisibilityGroup = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History, GroupMembership, ItemVisibilityRule } = req.models;
  const { groupId } = req.params;
  const masterUserID = req.adminId;

  try {
    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    // Prevent deleting default group
    if (group.isDefault) {
      return res.status(400).json({
        message: "Cannot delete the default group.",
      });
    }

    // Check if there are child groups
    const childGroups = await VisibilityGroup.count({
      where: { parentGroupId: groupId, masterUserID },
    });

    if (childGroups > 0) {
      return res.status(400).json({
        message: `Cannot delete group. There are ${childGroups} child groups. Please move or delete child groups first.`,
      });
    }

    // Move users to default group
    const defaultGroup = await VisibilityGroup.findOne({
      where: { masterUserID, isDefault: true },
    });

    if (defaultGroup) {
      await GroupMembership.update(
        { groupId: defaultGroup.groupId },
        { where: { groupId, masterUserID } }
      );
    }

    // Delete associated rules
    await PipelineVisibilityRule.destroy({
      where: { groupId, masterUserID },
    });

    await ItemVisibilityRule.destroy({
      where: { groupId, masterUserID },
    });

    // Delete group memberships
    await GroupMembership.destroy({
      where: { groupId, masterUserID },
    });

    // Delete the group
    await group.destroy();

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "VISIBILITY_GROUP_DELETION",
      masterUserID,
      groupId,
      null,
      `Visibility group "${group.groupName}" deleted`,
      null
    );

    res.status(200).json({
      message: "Visibility group deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting visibility group:", error);
    res.status(500).json({
      message: "Failed to delete visibility group.",
      error: error.message,
    });
  }
};

module.exports = exports;
