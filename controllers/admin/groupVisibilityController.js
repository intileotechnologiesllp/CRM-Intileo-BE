const {
  VisibilityGroup,
  GroupMembership,
  PipelineVisibilityRule,
  ItemVisibilityRule,
} = require("../../models/admin/visibilityAssociations");
const Pipeline = require("../../models/deals/pipelineModel");
const MasterUser = require("../../models/master/masterUserModel");
const GroupVisibility = require("../../models/admin/groupVisibilityModel")
const { Op } = require("sequelize");
const sequelize = require("../../config/db");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const historyLogger = require("../../utils/historyLogger").logHistory;

exports.getVisibilityGroups = async (req, res) => {
  try {
    // Get all groups
    const groups = await GroupVisibility.findAll({
      include: [
        {
          model: MasterUser,
          as: 'creator',
          attributes: ['masterUserID', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Extract all unique user IDs from all groups
    const allUserIds = [];
    groups.forEach(group => {
      const userIds = group.group; // This uses the getter to return array
      if (userIds && userIds.length > 0) {
        allUserIds.push(...userIds);
      }
    });

    // Remove duplicates
    const uniqueUserIds = [...new Set(allUserIds)];

    // Fetch all users in one query
    let usersMap = {};
    if (uniqueUserIds.length > 0) {
      const users = await MasterUser.findAll({
        where: {
          masterUserID: {
            [Op.in]: uniqueUserIds
          }
        },
        attributes: ['masterUserID', 'name', 'email']
      });

      // Create a map for quick lookup
      usersMap = users.reduce((map, user) => {
        map[user.masterUserID] = user.toJSON();
        return map;
      }, {});
    }

    // Format the response with users data
    const formattedGroups = groups.map(group => {
      const groupData = group.toJSON();
      
      // Get user IDs from the group field
      const userIds = groupData.group;
      
      // Get user details from the map
      const users = userIds.map(userId => usersMap[userId]).filter(user => user !== undefined);
      
      return {
        ...groupData,
        users: users, // Array of user objects
        userCount: users.length,
        creator: groupData.creator // Include creator info
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedGroups.length,
      data: formattedGroups
    });

  } catch (error) {
    console.error("Error fetching groups with users:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// Alternative: Get single group with users by ID
exports.getVisibilityGroupsWithId = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await GroupVisibility.findOne({
      where: { groupId },
      include: [
        {
          model: MasterUser,
          as: 'creator',
          attributes: ['masterUserID','name', 'email']
        }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found"
      });
    }

    const groupData = group.toJSON();
    const userIds = groupData.group;

    let users = [];
    if (userIds && userIds.length > 0) {
      users = await MasterUser.findAll({
        where: {
          masterUserID: {
            [Op.in]: userIds
          }
        },
        attributes: ['masterUserID', 'name', 'email']
      });
    }

    const response = {
      ...groupData,
      users: users.map(user => user.toJSON()),
      userCount: users.length
    };

    return res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Error fetching group:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// Create a new visibility group
exports.createVisibilityGroup = async (req, res) => {
  try {
    const {
      groupName,
      description,
      parentGroupIds, // Changed to accept array of group IDs like [2,4,5] or "2,4,5"
      isDefault = false,
      isActive = true,
      pipeline,
      lead,
      deal,
      person,
      organization,
    } = req.body;

    const createdBy = req.adminId;

    // Convert parentGroupIds to array if it's a string
    let groupIdsArray = [];
    if (parentGroupIds) {
      if (Array.isArray(parentGroupIds)) {
        groupIdsArray = parentGroupIds;
      } else if (typeof parentGroupIds === 'string') {
        groupIdsArray = parentGroupIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
    }

    // Validate group IDs exist if provided
    if (groupIdsArray.length > 0) {
      const existingGroups = await MasterUser.findAll({
        where: {
          masterUserID: {
            [Op.in]: groupIdsArray,
          },
        },
      });

      if (existingGroups.length !== groupIdsArray.length) {
        const existingGroupIds = existingGroups.map(group => group.groupId);
        const missingGroupIds = groupIdsArray.filter(id => !existingGroupIds.includes(id));
        return res.status(400).json({
          error: `Some group Types do not exist! Missing group IDs: ${missingGroupIds.join(', ')}`
        });
      }
    }

    // Check if group with the same name already exists
    const existingGroup = await GroupVisibility.findOne({
      where: { groupName, description },
    });

    if (existingGroup) {
      return res.status(400).json({
        error: `Group with name '${groupName}' already exists!`
      });
    }

    // Create the group visibility
    const groupVisibility = await GroupVisibility.create({
      groupName,
      description,
      isDefault,
      isActive,
      pipeline,
      lead,
      deal,
      person,
      Organization: organization,
      group: groupIdsArray, // This will be stored as comma-separated string
      createdBy
    });

    return res.status(201).json({
      message: "Group visibility created successfully!",
      groupId: groupVisibility.groupId,
      data: groupVisibility
    });

  } catch (error) {
    console.error("Error creating group visibility:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
};

// Update a visibility group
exports.updateVisibilityGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const {
      groupName,
      description,
      userIds, // Can be array [1,2,3] or string "1,2,3" to replace existing users
      addUserIds, // Array or string of user IDs to add
      removeUserIds, // Array or string of user IDs to remove
      isDefault,
      isActive,
      pipeline,
      lead,
      deal,
      person,
      organization
    } = req.body;

    // Find the group
    const group = await GroupVisibility.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found"
      });
    }

    // Prepare update data
    const updateData = {};

    // Handle group name update with uniqueness check
    if (groupName && groupName !== group.groupName) {
      const existingGroup = await GroupVisibility.findOne({
        where: { groupName, groupId: { [Op.ne]: groupId } }
      });
      
      if (existingGroup) {
        return res.status(400).json({
          success: false,
          error: `Group with name '${groupName}' already exists!`
        });
      }
      updateData.groupName = groupName;
    }

    // Handle other simple fields
    if (description !== undefined) updateData.description = description;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (pipeline !== undefined) updateData.pipeline = pipeline;
    if (lead !== undefined) updateData.lead = lead;
    if (deal !== undefined) updateData.deal = deal;
    if (person !== undefined) updateData.person = person;
    if (organization !== undefined) updateData.Organization = organization;

    // Handle user IDs management
    let finalUserIds = group.group; // Get current user IDs array

    // Option 1: Replace all user IDs
    if (userIds !== undefined) {
      let newUserIds = [];
      if (Array.isArray(userIds)) {
        newUserIds = userIds;
      } else if (typeof userIds === 'string') {
        newUserIds = userIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      
      // Validate new user IDs exist
      if (newUserIds.length > 0) {
        const existingUsers = await MasterUser.findAll({
          where: { masterUserID: { [Op.in]: newUserIds } }
        });
        
        if (existingUsers.length !== newUserIds.length) {
          const existingUserIds = existingUsers.map(user => user.masterUserID);
          const missingUserIds = newUserIds.filter(id => !existingUserIds.includes(id));
          return res.status(400).json({
            success: false,
            error: `Some users do not exist! Missing user IDs: ${missingUserIds.join(', ')}`
          });
        }
      }
      
      finalUserIds = newUserIds;
    }

    // Option 2: Add specific user IDs
    if (addUserIds !== undefined) {
      let usersToAdd = [];
      if (Array.isArray(addUserIds)) {
        usersToAdd = addUserIds;
      } else if (typeof addUserIds === 'string') {
        usersToAdd = addUserIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }

      // Validate users to add exist
      if (usersToAdd.length > 0) {
        const existingUsers = await MasterUser.findAll({
          where: { masterUserID: { [Op.in]: usersToAdd } }
        });
        
        if (existingUsers.length !== usersToAdd.length) {
          const existingUserIds = existingUsers.map(user => user.masterUserID);
          const missingUserIds = usersToAdd.filter(id => !existingUserIds.includes(id));
          return res.status(400).json({
            success: false,
            error: `Some users to add do not exist! Missing user IDs: ${missingUserIds.join(', ')}`
          });
        }
      }

      // Add users (avoid duplicates)
      finalUserIds = [...new Set([...finalUserIds, ...usersToAdd])];
    }

    // Option 3: Remove specific user IDs
    if (removeUserIds !== undefined) {
      let usersToRemove = [];
      if (Array.isArray(removeUserIds)) {
        usersToRemove = removeUserIds;
      } else if (typeof removeUserIds === 'string') {
        usersToRemove = removeUserIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }

      // Remove users
      finalUserIds = finalUserIds.filter(id => !usersToRemove.includes(id));
    }

    // Update the group field with final user IDs
    updateData.group = finalUserIds;

    // Update the group
    await group.update(updateData);

    // Fetch the updated group with user details
    const updatedGroup = await GroupVisibility.findByPk(groupId, {
      include: [
        {
          model: MasterUser,
          as: 'creator',
          attributes: ['masterUserID', 'name', 'email']
        }
      ]
    });

    // Get user details for the response
    let users = [];
    if (finalUserIds.length > 0) {
      users = await MasterUser.findAll({
        where: { masterUserID: { [Op.in]: finalUserIds } },
        attributes: ['masterUserID', 'name', 'email']
      });
    }

    const response = updatedGroup.toJSON();
    response.users = users.map(user => user.toJSON());
    response.userCount = users.length;

    return res.status(200).json({
      success: true,
      message: "Group updated successfully",
      data: response
    });

  } catch (error) {
    console.error("Error updating group:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Find the group first to check if it exists
    const group = await GroupVisibility.findByPk(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found"
      });
    }

    // Check if it's a default group (optional: prevent deletion of default groups)
    if (group.isDefault) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete default group"
      });
    }

    // Store group data for response before deletion
    const groupData = group.toJSON();

    // Delete the group
    await group.destroy();

    return res.status(200).json({
      success: true,
      message: "Group deleted successfully",
      data: {
        groupId: groupData.groupId,
        groupName: groupData.groupName,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error deleting group:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// Alternative: Soft delete (if you have deletedAt column)
exports.softDeleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await GroupVisibility.findByPk(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found"
      });
    }

    if (group.isDefault) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete default group"
      });
    }

    // Soft delete by updating isActive to false
    await group.update({ 
      isActive: false,
      deletedAt: new Date() 
    });

    return res.status(200).json({
      success: true,
      message: "Group soft deleted successfully",
      data: {
        groupId: group.groupId,
        groupName: group.groupName,
        isActive: false,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error soft deleting group:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

module.exports = exports;
