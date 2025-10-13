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

    // Extract all unique user IDs from all groups' memberIds
    const allUserIds = [];
    // Extract all unique pipeline IDs from all groups' pipelineIds
    const allPipelineIds = [];
    
    groups.forEach(group => {
      // Process memberIds for users
      const memberIds = group.memberIds;
      if (memberIds) {
        const userIdsArray = memberIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (userIdsArray.length > 0) {
          allUserIds.push(...userIdsArray);
        }
      }

      // Process pipelineIds for pipelines
      const pipelineIds = group.pipelineIds;
      if (pipelineIds) {
        const pipelineIdsArray = pipelineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (pipelineIdsArray.length > 0) {
          allPipelineIds.push(...pipelineIdsArray);
        }
      }
    });

    // Remove duplicates
    const uniqueUserIds = [...new Set(allUserIds)];
    const uniquePipelineIds = [...new Set(allPipelineIds)];

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

      usersMap = users.reduce((map, user) => {
        map[user.masterUserID] = user.toJSON();
        return map;
      }, {});
    }

    // Fetch all pipelines in one query
    let pipelinesMap = {};
    if (uniquePipelineIds.length > 0) {
      const pipelines = await Pipeline.findAll({
        where: {
          pipelineId: {
            [Op.in]: uniquePipelineIds
          }
        },
        attributes: ['pipelineId', 'pipelineName', 'color', 'isActive']
      });

      pipelinesMap = pipelines.reduce((map, pipeline) => {
        map[pipeline.pipelineId] = pipeline.toJSON();
        return map;
      }, {});
    }

    // Format the response with users and pipelines data
    const formattedGroups = groups.map(group => {
      const groupData = group.toJSON();
      
      // Convert memberIds to array and get user details
      const memberIds = groupData.memberIds;
      let userIds = [];
      let users = [];
      
      if (memberIds) {
        userIds = memberIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        users = userIds.map(userId => usersMap[userId]).filter(user => user !== undefined);
      }

      // Convert pipelineIds to array and get pipeline details
      const pipelineIds = groupData.pipelineIds;
      let pipelineIdArray = [];
      let pipelines = [];
      
      if (pipelineIds) {
        pipelineIdArray = pipelineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        pipelines = pipelineIdArray.map(pipelineId => pipelinesMap[pipelineId]).filter(pipeline => pipeline !== undefined);
      }
      
      return {
        ...groupData,
        users: users, // Array of user objects
        userCount: users.length,
        memberIds: userIds, // Return as array instead of string
        pipelineIds: pipelineIdArray, // Return as array instead of string
        pipelines: pipelines, // Array of pipeline objects with details
        pipelineCount: pipelines.length,
        creator: groupData.creator // Include creator info
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedGroups.length,
      data: formattedGroups
    });

  } catch (error) {
    console.error("Error fetching groups with users and pipelines:", error);
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
    
    // Convert comma-separated strings to arrays
    const userIds = groupData.memberIds ? 
      groupData.memberIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
    
    const pipelineIds = groupData.pipelineIds ? 
      groupData.pipelineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];

    // Fetch users and pipelines in parallel
    const [users, pipelines] = await Promise.all([
      // Fetch users
      userIds.length > 0 ? MasterUser.findAll({
        where: {
          masterUserID: {
            [Op.in]: userIds
          }
        },
        attributes: ['masterUserID', 'name', 'email']
      }) : Promise.resolve([]),
      
      // Fetch pipelines
      pipelineIds.length > 0 ? Pipeline.findAll({
        where: {
          pipelineId: {
            [Op.in]: pipelineIds
          }
        },
        attributes: ['pipelineId', 'pipelineName', 'color', 'isActive']
      }) : Promise.resolve([])
    ]);

    const response = {
      ...groupData,
      memberIds: userIds,
      pipelineIds: pipelineIds,
      pipelines: pipelines.map(pipeline => pipeline.toJSON()),
      pipelineCount: pipelines.length,
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
      memberIds,
      isDefault = false,
      isActive = true,
      pipelineIds,
      lead,
      deal,
      person,
      organization,
    } = req.body;

    const createdBy = req.adminId;

    const memberIdsArray = Array.isArray(memberIds)
      ? memberIds
      : [memberIds];

    // Validate that all memberIds belong to the owner
    for (const masterUserID of memberIdsArray) {
      const member = await MasterUser.findOne({
        where: { masterUserID },
      });
      if (!member) {
        return res.status(404).json({
          success: false,
          message: `member ${masterUserID} not found or access denied`,
        });
      }
    }
    
    const pipelineIdsArray = Array.isArray(pipelineIds)
      ? pipelineIds
      : [pipelineIds];

    // Validate that all pipelineIds belong to the owner
    for (const pipelineId of pipelineIdsArray) {
      const pipeline = await Pipeline.findOne({
        where: { pipelineId },
      });
      if (!pipeline) {
        return res.status(404).json({
          success: false,
          message: `pipeline ${pipelineId} not found or access denied`,
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
      pipelineIds: pipelineIdsArray.join(","),
      lead,
      deal,
      person,
      Organization: organization,
      memberIds: memberIdsArray.join(","),
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
      memberIds, // Can be array [1,2,3] or string "1,2,3"
      pipelineIds, // Can be array [1,2,3] or string "1,2,3"
      isDefault,
      isActive,
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
    if (lead !== undefined) updateData.lead = lead;
    if (deal !== undefined) updateData.deal = deal;
    if (person !== undefined) updateData.person = person;
    if (organization !== undefined) updateData.Organization = organization;

    // Handle memberIds - convert to comma-separated string
    if (memberIds !== undefined) {
      let finalMemberIds = [];
      
      if (Array.isArray(memberIds)) {
        finalMemberIds = memberIds;
      } else if (typeof memberIds === 'string') {
        finalMemberIds = memberIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      
      // Validate member IDs exist
      if (finalMemberIds.length > 0) {
        const existingMembers = await MasterUser.findAll({
          where: { masterUserID: { [Op.in]: finalMemberIds } }
        });
        
        if (existingMembers.length !== finalMemberIds.length) {
          const existingMemberIds = existingMembers.map(user => user.masterUserID);
          const missingMemberIds = finalMemberIds.filter(id => !existingMemberIds.includes(id));
          return res.status(400).json({
            success: false,
            error: `Some members do not exist! Missing member IDs: ${missingMemberIds.join(', ')}`
          });
        }
      }
      
      // Convert array to comma-separated string for database storage
      updateData.memberIds = finalMemberIds.join(',');
    }

    // Handle pipelineIds - convert to comma-separated string
    if (pipelineIds !== undefined) {
      let finalPipelineIds = [];
      
      if (Array.isArray(pipelineIds)) {
        finalPipelineIds = pipelineIds;
      } else if (typeof pipelineIds === 'string') {
        finalPipelineIds = pipelineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      
      // Validate pipeline IDs exist (if you have a Pipeline model)
      // If you have a Pipeline model, you can add validation here:
      
      if (finalPipelineIds.length > 0) {
        const existingPipelines = await Pipeline.findAll({
          where: { pipelineId: { [Op.in]: finalPipelineIds } }
        });
        
        if (existingPipelines.length !== finalPipelineIds.length) {
          const existingPipelineIds = existingPipelines.map(pipe => pipe.pipelineId);
          const missingPipelineIds = finalPipelineIds.filter(id => !existingPipelineIds.includes(id));
          return res.status(400).json({
            success: false,
            error: `Some pipelines do not exist! Missing pipeline IDs: ${missingPipelineIds.join(', ')}`
          });
        }
      }
      
      
      // Convert array to comma-separated string for database storage
      updateData.pipelineIds = finalPipelineIds.join(',');
    }

    // Update the group
    await group.update(updateData);

    // Fetch the updated group with creator details
    const updatedGroup = await GroupVisibility.findByPk(groupId, {
      include: [
        {
          model: MasterUser,
          as: 'creator',
          attributes: ['masterUserID', 'name', 'email']
        }
      ]
    });

    // Get member details for the response
    const groupData = updatedGroup.toJSON();
    
    let members = [];
    let memberIdArray = [];
    if (groupData.memberIds) {
      memberIdArray = groupData.memberIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (memberIdArray.length > 0) {
        members = await MasterUser.findAll({
          where: { masterUserID: { [Op.in]: memberIdArray } },
          attributes: ['masterUserID', 'name', 'email']
        });
      }
    }

    // Convert pipelineIds to array for response
    let pipelineIdArray = [];
    if (groupData.pipelineIds) {
      pipelineIdArray = groupData.pipelineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    const response = {
      ...groupData,
      memberIds: memberIdArray, // Return as array
      pipelineIds: pipelineIdArray, // Return as array
      users: members.map(user => user.toJSON()),
      userCount: members.length
    };

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

exports.getMyGroups = async (req, res) => {
  try {
    const masterUserId = req.adminId; // Assuming this is set from authentication middleware
    console.log(masterUserId)
    if (!masterUserId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Find all groups
    const allGroups = await GroupVisibility.findAll({
      where: { isActive: true },
      include: [{
        model: MasterUser,
        as: 'creator',
        attributes: ['masterUserID', 'name', 'email']
      }]
    });

    // Filter groups where the user exists in the group's user list
    const userGroups = allGroups.filter(group => {
      const groupUserIds = group.memberIds; // This uses the getter which returns an array
      return groupUserIds.includes(parseInt(masterUserId));
    });

    // Format the response
    const formattedGroups = userGroups.map(group => ({
      groupId: group.groupId,
      groupName: group.groupName,
      description: group.description,
      isDefault: group.isDefault,
      isActive: group.isActive,
      pipeline: group.pipeline,
      lead: group.lead,
      deal: group.deal,
      person: group.person,
      Organization: group.Organization,
      group: group.group, // Array of user IDs
      createdBy: group.createdBy,
      creator: group.creator ? {
        masterUserID: group.creator.masterUserID,
        firstName: group.creator.name,
        email: group.creator.email
      } : null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "Groups fetched successfully",
      data: formattedGroups,
      totalCount: formattedGroups.length
    });

  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

exports.getGroupsByEntity = async (req, res) => {
  try {
    const {
      pipeline,
      lead,
      deal,
      person,
      organization,
      isActive = 'true'
    } = req.query;

    // Build the where clause based on query parameters
    const whereClause = {};

    // Handle isActive filter
    if (isActive !== 'all') {
      whereClause.isActive = isActive === 'true';
    }

    // Add entity filters if provided and not 'all'
    if (pipeline && pipeline !== 'all') {
      whereClause.pipeline = pipeline === 'true';
    }
    if (lead && lead !== 'all') {
      whereClause.lead = lead === 'true';
    }
    if (deal && deal !== 'all') {
      whereClause.deal = deal === 'true';
    }
    if (person && person !== 'all') {
      whereClause.person = person === 'true';
    }
    if (organization && organization !== 'all') {
      whereClause.Organization = organization === 'true';
    }

    // Find groups based on the filters
    const groups = await GroupVisibility.findAll({
      where: whereClause,
      include: [{
        model: MasterUser,
        as: 'creator',
        attributes: ['masterUserID', 'name', 'email']
      }],
      order: [['groupName', 'ASC']]
    });

    // Format the response
    const formattedGroups = groups.map(group => ({
      groupId: group.groupId,
      groupName: group.groupName,
      description: group.description,
      isDefault: group.isDefault,
      isActive: group.isActive,
      pipeline: group.pipeline,
      lead: group.lead,
      deal: group.deal,
      person: group.person,
      Organization: group.Organization,
      group: group.group,
      createdBy: group.createdBy,
      creator: group.creator ? {
        masterUserID: group.creator.masterUserID,
        firstName: group.creator.name,
        email: group.creator.email
      } : null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "Groups filtered successfully",
      data: formattedGroups,
      totalCount: formattedGroups.length,
      filters: {
        pipeline: pipeline || 'all',
        lead: lead || 'all',
        deal: deal || 'all',
        person: person || 'all',
        organization: organization || 'all',
        isActive: isActive === 'true'
      }
    });

  } catch (error) {
    console.error("Error filtering groups by entity:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = exports;
