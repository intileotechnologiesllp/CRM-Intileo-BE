const {
  VisibilityGroup,
  GroupMembership,
} = require("../../models/admin/visibilityAssociations");
const MasterUser = require("../../models/master/masterUserModel");
const { Op } = require("sequelize");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const historyLogger = require("../../utils/historyLogger").logHistory;

// Get users in a specific group
exports.getGroupUsers = async (req, res) => {
  const { VisibilityGroup, GroupMembership, MasterUser } = req.models;
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

    const memberships = await GroupMembership.findAll({
      where: { groupId, masterUserID, isActive: true },
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
            "createdAt",
          ],
        },
        {
          model: MasterUser,
          as: "assignedByUser",
          attributes: ["masterUserID", "name"],
        },
      ],
      order: [[{ model: MasterUser, as: "user" }, "name", "ASC"]],
    });

    const users = memberships.map((membership) => ({
      membershipId: membership.membershipId,
      userId: membership.userId,
      joinedAt: membership.joinedAt,
      assignedBy: membership.assignedByUser,
      user: membership.user,
    }));

    res.status(200).json({
      message: "Group users retrieved successfully.",
      group: {
        groupId: group.groupId,
        groupName: group.groupName,
      },
      users,
      totalUsers: users.length,
    });
  } catch (error) {
    console.error("Error fetching group users:", error);
    res.status(500).json({
      message: "Failed to fetch group users.",
      error: error.message,
    });
  }
};

// Add users to a group
exports.addUsersToGroup = async (req, res) => {
  const { VisibilityGroup, GroupMembership, MasterUser, History } = req.models;
  const { groupId } = req.params;
  const { userIds } = req.body;
  const masterUserID = req.adminId;
  const assignedBy = req.adminId;

  try {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        message: "userIds array is required and must not be empty.",
      });
    }

    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    // Validate that all users exist and are not already in the group
    const validUsers = await MasterUser.findAll({
      where: {
        masterUserID: { [Op.in]: userIds },
        isActive: true,
      },
    });

    if (validUsers.length !== userIds.length) {
      const foundUserIds = validUsers.map((u) => u.masterUserID);
      const invalidUserIds = userIds.filter((id) => !foundUserIds.includes(id));
      return res.status(400).json({
        message: `Invalid user IDs: ${invalidUserIds.join(", ")}`,
      });
    }

    // Check for existing memberships
    const existingMemberships = await GroupMembership.findAll({
      where: {
        groupId,
        userId: { [Op.in]: userIds },
        isActive: true,
      },
    });

    const existingUserIds = existingMemberships.map((m) => m.userId);
    const newUserIds = userIds.filter((id) => !existingUserIds.includes(id));

    if (newUserIds.length === 0) {
      return res.status(400).json({
        message: "All specified users are already in this group.",
      });
    }

    // Remove users from other groups first (users can only be in one group at a time)
    await GroupMembership.update(
      { isActive: false },
      {
        where: {
          userId: { [Op.in]: newUserIds },
          masterUserID,
          isActive: true,
        },
      }
    );

    // Create new memberships
    const newMemberships = newUserIds.map((userId) => ({
      groupId,
      userId,
      masterUserID,
      assignedBy,
    }));

    await GroupMembership.bulkCreate(newMemberships);

    // Log the action
    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "GROUP_MEMBERSHIP_ADD",
      masterUserID,
      groupId,
      null,
      `${newUserIds.length} users added to group "${group.groupName}"`,
      { addedUserIds: newUserIds }
    );

    res.status(200).json({
      message: `${newUserIds.length} users added to group successfully.`,
      addedUsers: newUserIds.length,
      skippedUsers: existingUserIds.length,
    });
  } catch (error) {
    console.error("Error adding users to group:", error);
    res.status(500).json({
      message: "Failed to add users to group.",
      error: error.message,
    });
  }
};

// Remove a user from a group
exports.removeUserFromGroup = async (req, res) => {
  const { VisibilityGroup, GroupMembership, MasterUser, History } = req.models;
  const { groupId, userId } = req.params;
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

    // Prevent removing users from default group
    if (group.isDefault) {
      return res.status(400).json({
        message:
          "Cannot remove users from the default group. Move them to another group instead.",
      });
    }

    const membership = await GroupMembership.findOne({
      where: {
        groupId,
        userId,
        masterUserID,
        isActive: true,
      },
      include: [
        {
          model: MasterUser,
          as: "user",
          attributes: ["name", "email"],
        },
      ],
    });

    if (!membership) {
      return res.status(404).json({
        message: "User is not a member of this group.",
      });
    }

    // Deactivate membership
    await membership.update({ isActive: false });

    // Move user to default group
    const defaultGroup = await VisibilityGroup.findOne({
      where: { masterUserID, isDefault: true },
    });

    if (defaultGroup) {
      await GroupMembership.create({
        groupId: defaultGroup.groupId,
        userId,
        masterUserID,
        assignedBy: masterUserID,
      });
    }

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "GROUP_MEMBERSHIP_REMOVE",
      masterUserID,
      groupId,
      null,
      `User "${membership.user.name}" removed from group "${group.groupName}"`,
      { removedUserId: userId }
    );

    res.status(200).json({
      message: "User removed from group successfully.",
      user: membership.user,
      movedToDefaultGroup: !!defaultGroup,
    });
  } catch (error) {
    console.error("Error removing user from group:", error);
    res.status(500).json({
      message: "Failed to remove user from group.",
      error: error.message,
    });
  }
};

// Move user between groups
exports.moveUserToGroup = async (req, res) => {
  const { VisibilityGroup, GroupMembership, MasterUser, History } = req.models;
  const { userId } = req.params;
  const { targetGroupId } = req.body;
  const masterUserID = req.adminId;

  try {
    if (!targetGroupId) {
      return res.status(400).json({
        message: "targetGroupId is required.",
      });
    }

    const targetGroup = await VisibilityGroup.findOne({
      where: { groupId: targetGroupId, masterUserID },
    });

    if (!targetGroup) {
      return res.status(404).json({
        message: "Target group not found.",
      });
    }

    const user = await MasterUser.findOne({
      where: { masterUserID: userId, isActive: true },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Deactivate current membership
    await GroupMembership.update(
      { isActive: false },
      {
        where: {
          userId,
          masterUserID,
          isActive: true,
        },
      }
    );

    // Create new membership
    await GroupMembership.create({
      groupId: targetGroupId,
      userId,
      masterUserID,
      assignedBy: masterUserID,
    });

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "GROUP_MEMBERSHIP_MOVE",
      masterUserID,
      targetGroupId,
      null,
      `User "${user.name}" moved to group "${targetGroup.groupName}"`,
      { movedUserId: userId }
    );

    res.status(200).json({
      message: "User moved to group successfully.",
      user: {
        masterUserID: user.masterUserID,
        name: user.name,
        email: user.email,
      },
      targetGroup: {
        groupId: targetGroup.groupId,
        groupName: targetGroup.groupName,
      },
    });
  } catch (error) {
    console.error("Error moving user to group:", error);
    res.status(500).json({
      message: "Failed to move user to group.",
      error: error.message,
    });
  }
};

// Get available users (not in any group or available for reassignment)
exports.getAvailableUsers = async (req, res) => {
  const { VisibilityGroup, GroupMembership, MasterUser } = req.models;
  const masterUserID = req.adminId;

  try {
    // Get all users except the main user
    const allUsers = await MasterUser.findAll({
      where: {
        masterUserID: { [Op.ne]: masterUserID },
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
        "createdAt",
      ],
      order: [["name", "ASC"]],
    });

    // Get current group memberships
    const memberships = await GroupMembership.findAll({
      where: {
        masterUserID,
        isActive: true,
      },
      include: [
        {
          model: VisibilityGroup,
          as: "group",
          attributes: ["groupId", "groupName"],
        },
      ],
    });

    // Add group information to users
    const usersWithGroups = allUsers.map((user) => {
      const membership = memberships.find(
        (m) => m.userId === user.masterUserID
      );
      return {
        ...user.toJSON(),
        currentGroup: membership ? membership.group : null,
        membershipId: membership ? membership.membershipId : null,
      };
    });

    res.status(200).json({
      message: "Available users retrieved successfully.",
      users: usersWithGroups,
      totalUsers: usersWithGroups.length,
    });
  } catch (error) {
    console.error("Error fetching available users:", error);
    res.status(500).json({
      message: "Failed to fetch available users.",
      error: error.message,
    });
  }
};

module.exports = exports;
