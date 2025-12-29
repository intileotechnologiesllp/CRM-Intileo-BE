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

exports.addPipelineToGroup = async (req, res) => {
  const { GroupVisibility, Pipeline } = req.models;
  try {
    const { groupId } = req.params;
    const { pipelineId } = req.body;
    // Find the group
    const group = await GroupVisibility.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found"
      });
    }
    // Check if pipeline exists
    const pipeline = await Pipeline.findByPk(pipelineId);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: "Pipeline not found"
      });
    }
    // Check if pipeline is already in the group
    const currentPipelines = group.pipelineIds ? group.pipelineIds.split(',').map(id => id.trim()) : [];
    if (currentPipelines.includes(pipelineId.toString())) {
      return res.status(400).json({
        success: false,
        error: "Pipeline is already associated with the group"
      });
    }
    // Add pipeline to the group
    currentPipelines.push(pipelineId.toString());
    group.pipelineIds = currentPipelines.join(',');
    await group.save();
    return res.status(200).json({
      success: true,
      message: "Pipeline added to group successfully",
      data: group
    });
  } catch (error) {
    console.error("Error adding pipeline to group:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
}
exports.addUserToGroup = async (req, res)=>{
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
  try{
    const { groupId } = req.params;
    const { masterUserID } = req.body;
    // Find the group
    const group = await GroupVisibility.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found"
      });
    }
    // Check if user exists
    const user = await MasterUser.findOne({ where: { masterUserID } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    // Check if user is already in the group
    const currentMembers = group.memberIds ? group.memberIds.split(',').map(id => id.trim()) : [];
    if (currentMembers.includes(masterUserID.toString())) {
      return res.status(400).json({
        success: false,
        error: "User is already a member of the group"
      });
    }
    // Add user to the group
    currentMembers.push(masterUserID.toString());
    group.memberIds = currentMembers.join(',');
    await group.save();
    return res.status(200).json({
      success: true,
      message: "User added to group successfully",
      data: group
    });
    
  }catch(error){
    console.error("Error adding user to group:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
}

exports.getVisibilityGroups = async (req, res) => {
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
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
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
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
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
  const transaction = await sequelize.transaction();
  
  try {
    const {
      groupName,
      description,
      memberIds,
      // isDefault = false,
      isActive = true,
      pipelineIds,
      lead,
      deal,
      person,
      organization,
    } = req.body;

    const createdBy = req.adminId;

    // Parse memberIds properly
    let memberIdsArray;
    if (typeof memberIds === 'string') {
      memberIdsArray = memberIds.split(',').map(id => id.trim()).filter(id => id !== '');
    } else if (Array.isArray(memberIds)) {
      memberIdsArray = memberIds.map(id => id.toString().trim());
    } else if (memberIds) {
      memberIdsArray = [memberIds.toString().trim()];
    } else {
      memberIdsArray = [];
    }

    console.log('Final memberIdsArray:', memberIdsArray);

    // Validate members
    for (const masterUserID of memberIdsArray) {
      const member = await MasterUser.findOne({
        where: { masterUserID },
        transaction
      });
      if (!member) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: `member ${masterUserID} not found or access denied`,
        });
      }
    }

    // Check for duplicate group name
    const existingGroup = await GroupVisibility.findOne({
      where: { groupName },
      transaction
    });

    if (existingGroup) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Group with name '${groupName}' already exists!`
      });
    }

    // Remove users from all other groups
    if (memberIdsArray.length > 0) {
      const allGroups = await GroupVisibility.findAll({ transaction });
      
      for (const group of allGroups) {
        if (group.memberIds) {
          const currentMembers = group.memberIds.split(',').map(id => id.trim()).filter(id => id !== '');
          const membersToKeep = currentMembers.filter(id => !memberIdsArray.includes(id));
          
          if (membersToKeep.length !== currentMembers.length) {
            await GroupVisibility.update(
              {
                memberIds: membersToKeep.length > 0 ? membersToKeep.join(",") : null,
                updatedAt: new Date()
              },
              {
                where: { groupId: group.groupId },
                transaction
              }
            );
          }
        }
      }
    }

    // Create new group
    const groupVisibility = await GroupVisibility.create({
      groupName,
      description,
      // isDefault,
      isActive,
      pipelineIds: Array.isArray(pipelineIds) ? pipelineIds.join(",") : pipelineIds,
      lead,
      deal,
      person,
      Organization: organization,
      memberIds: memberIdsArray.join(","),
      createdBy
    }, { transaction });

    await transaction.commit();

    return res.status(201).json({
      message: "Group visibility created successfully!",
      groupId: groupVisibility.groupId,
      data: groupVisibility
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Error creating group visibility:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
};

// Update a visibility group
exports.updateVisibilityGroup = async (req, res) => {
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
  const transaction = await sequelize.transaction();

  try {
    const { groupId } = req.params;

    const {
      groupName,
      description,
      memberIds,     // array [1,2,3] or string "1,2,3"
      pipelineIds,   // array [1,2,3] or string "1,2,3"
      isActive,
      lead,
      deal,
      person,
      organization,
      itemVisibility
    } = req.body;

    // 1) Find group
    const group = await GroupVisibility.findByPk(groupId, { transaction });
    if (!group) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: "Group not found" });
    }

    const updateData = {};

    // 2) Unique groupName check
    if (groupName !== undefined && groupName !== null && groupName !== group.groupName) {
      const existingGroup = await GroupVisibility.findOne({
        where: {
          groupName,
          groupId: { [Op.ne]: groupId } // ensure your PK is actually groupId, else change to id
        },
        transaction
      });

      if (existingGroup) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Group with name '${groupName}' already exists!`
        });
      }
      updateData.groupName = groupName;
    }

    // 3) Simple fields
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (itemVisibility?.leads !== undefined) updateData.lead = itemVisibility?.leads?.toLowerCase();
    if (itemVisibility?.deals !== undefined) updateData.deal = itemVisibility?.deals?.toLowerCase();
    if (itemVisibility?.people !== undefined) updateData.person = itemVisibility?.people?.toLowerCase();

    console.log("itemVisibility?.organizations?.toLowerCase()",itemVisibility?.organizations?.toLowerCase())
    // IMPORTANT FIX: correct attribute name
    if (itemVisibility?.organizations !== undefined) updateData.Organization = itemVisibility?.organizations?.toLowerCase();

    // 4) Parse + validate memberIds
    let finalMemberIds = null; // will become array of ints
    if (memberIds !== undefined) {
      let parsed = [];

      if (typeof memberIds === "string") {
        parsed = memberIds
          .split(",")
          .map(x => x.trim())
          .filter(x => x !== "");
      } else if (Array.isArray(memberIds)) {
        parsed = memberIds.map(x => String(x).trim()).filter(x => x !== "");
      } else if (memberIds !== null && memberIds !== "") {
        parsed = [String(memberIds).trim()];
      }

      // normalize to integers
      finalMemberIds = parsed
        .map(x => parseInt(x, 10))
        .filter(x => !Number.isNaN(x));

      // Validate members exist
      if (finalMemberIds.length > 0) {
        const existingMembers = await MasterUser.findAll({
          where: { masterUserID: { [Op.in]: finalMemberIds } },
          attributes: ["masterUserID"],
          transaction
        });

        const existingIds = new Set(existingMembers.map(u => Number(u.masterUserID)));
        const missing = finalMemberIds.filter(id => !existingIds.has(id));

        if (missing.length > 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: `Some members do not exist! Missing member IDs: ${missing.join(", ")}`
          });
        }
      }

      // Remove these members from all OTHER groups
      if (finalMemberIds.length > 0) {
        const allGroups = await GroupVisibility.findAll({ transaction });

        for (const otherGroup of allGroups) {
          if (String(otherGroup.groupId) === String(groupId)) continue;

          if (otherGroup.memberIds && otherGroup.memberIds.trim() !== "") {
            const currentMembers = otherGroup.memberIds
              .split(",")
              .map(x => parseInt(x.trim(), 10))
              .filter(x => !Number.isNaN(x));

            const common = currentMembers.filter(id => finalMemberIds.includes(id));
            if (common.length > 0) {
              const updatedMemberIds = currentMembers.filter(id => !finalMemberIds.includes(id));

              await GroupVisibility.update(
                {
                  memberIds: updatedMemberIds.length ? updatedMemberIds.join(",") : null
                },
                {
                  where: { groupId: otherGroup.groupId },
                  transaction
                }
              );
            }
          }
        }
      }

      // store memberIds as CSV or null
      updateData.memberIds = finalMemberIds.length ? finalMemberIds.join(",") : null;
    }

    // 5) Parse + validate pipelineIds
    let finalPipelineIds = null; // array of ints
    if (pipelineIds !== undefined) {
      let parsed = [];

      if (Array.isArray(pipelineIds)) {
        parsed = pipelineIds.map(x => String(x).trim()).filter(x => x !== "");
      } else if (typeof pipelineIds === "string") {
        parsed = pipelineIds
          .split(",")
          .map(x => x.trim())
          .filter(x => x !== "");
      } else if (pipelineIds !== null && pipelineIds !== "") {
        parsed = [String(pipelineIds).trim()];
      }

      finalPipelineIds = parsed
        .map(x => parseInt(x, 10))
        .filter(x => !Number.isNaN(x));

      // Validate pipelines exist
      if (finalPipelineIds.length > 0) {
        const existingPipelines = await Pipeline.findAll({
          where: { pipelineId: { [Op.in]: finalPipelineIds } },
          attributes: ["pipelineId"],
          transaction
        });

        const existingIds = new Set(existingPipelines.map(p => Number(p.pipelineId)));
        const missing = finalPipelineIds.filter(id => !existingIds.has(id));

        if (missing.length > 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: `Some pipelines do not exist! Missing pipeline IDs: ${missing.join(", ")}`
          });
        }
      }

      updateData.pipelineIds = finalPipelineIds.length ? finalPipelineIds.join(",") : null;
    }

    console.log("Update data prepared:", updateData);

    // Optional guard: avoid "update nothing"
    if (Object.keys(updateData).length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "No fields provided to update"
      });
    }

    // 6) Update group
    await group.update(updateData, { transaction });

    // 7) Commit
    await transaction.commit();

    // 8) Fetch updated group + creator details
    const updatedGroup = await GroupVisibility.findByPk(groupId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name", "email"]
        }
      ]
    });

    const groupData = updatedGroup.toJSON();

    // Build members in response
    let memberIdArray = [];
    let members = [];

    if (groupData.memberIds) {
      memberIdArray = groupData.memberIds
        .split(",")
        .map(x => parseInt(x.trim(), 10))
        .filter(x => !Number.isNaN(x));

      if (memberIdArray.length > 0) {
        members = await MasterUser.findAll({
          where: { masterUserID: { [Op.in]: memberIdArray } },
          attributes: ["masterUserID", "name", "email"]
        });
      }
    }

    // Build pipelines in response
    let pipelineIdArray = [];
    if (groupData.pipelineIds) {
      pipelineIdArray = groupData.pipelineIds
        .split(",")
        .map(x => parseInt(x.trim(), 10))
        .filter(x => !Number.isNaN(x));
    }

    return res.status(200).json({
      success: true,
      message: "Group updated successfully! Users have been removed from all other groups.",
      data: {
        ...groupData,
        memberIds: memberIdArray,
        pipelineIds: pipelineIdArray,
        users: members.map(u => u.toJSON()),
        userCount: members.length
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Error updating group:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// exports.updateVisibilityGroup = async (req, res) => {
//   const transaction = await sequelize.transaction();
  
//   try {
//     const { groupId } = req.params;
//     const {
//       groupName,
//       description,
//       memberIds, // Can be array [1,2,3] or string "1,2,3"
//       pipelineIds, // Can be array [1,2,3] or string "1,2,3"
//       // isDefault,
//       isActive,
//       lead,
//       deal,
//       person,
//       organization
//     } = req.body;

//     // Find the group
//     const group = await GroupVisibility.findByPk(groupId, { transaction });
//     if (!group) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         error: "Group not found"
//       });
//     }

//     // Prepare update data
//     const updateData = {};

//     // Handle group name update with uniqueness check
//     if (groupName && groupName !== group.groupName) {
//       const existingGroup = await GroupVisibility.findOne({
//         where: { groupName, groupId: { [Op.ne]: groupId } },
//         transaction
//       });
      
//       if (existingGroup) {
//         await transaction.rollback();
//         return res.status(400).json({
//           success: false,
//           error: `Group with name '${groupName}' already exists!`
//         });
//       }
//       updateData.groupName = groupName;
//     }

//     // Handle other simple fields
//     if (description !== undefined) updateData.description = description;
//     // if (isDefault !== undefined) updateData.isDefault = isDefault;
//     if (isActive !== undefined) updateData.isActive = isActive;
//     if (lead !== undefined) updateData.lead = lead;
//     if (deal !== undefined) updateData.deal = deal;
//     if (person !== undefined) updateData.person = person;
//     if (organization !== undefined) updateData.Organization = organization;

//     // Handle memberIds - convert to comma-separated string
//     let finalMemberIds = [];
//     if (memberIds !== undefined) {
//       // Parse memberIds properly
//       if (typeof memberIds === 'string') {
//         finalMemberIds = memberIds.split(',').map(id => id.trim()).filter(id => id !== '');
//       } else if (Array.isArray(memberIds)) {
//         finalMemberIds = memberIds.map(id => id.toString().trim());
//       } else if (memberIds) {
//         finalMemberIds = [memberIds.toString().trim()];
//       }

//       console.log('Final memberIdsArray for update:', finalMemberIds);

//       // Validate member IDs exist
//       if (finalMemberIds.length > 0) {
//         const existingMembers = await MasterUser.findAll({
//           where: { masterUserID: { [Op.in]: finalMemberIds } },
//           transaction
//         });
        
//         if (existingMembers.length !== finalMemberIds.length) {
//           const existingMemberIds = existingMembers.map(user => user.masterUserID);
//           const missingMemberIds = finalMemberIds.filter(id => !existingMemberIds.includes(id));
//           await transaction.rollback();
//           return res.status(400).json({
//             success: false,
//             error: `Some members do not exist! Missing member IDs: ${missingMemberIds.join(', ')}`
//           });
//         }
//       }

//       // NEW LOGIC: Remove users from ALL other groups (including current group's previous state)
//       if (finalMemberIds.length > 0) {
//         // Get ALL groups (we'll handle the current group separately)
//         const allGroups = await GroupVisibility.findAll({ transaction });
        
//         for (const otherGroup of allGroups) {
//           // Skip if this is the current group and we have no members to process
//           if (otherGroup.groupId.toString() === groupId.toString()) {
//             continue; // We'll handle current group update separately
//           }
          
//           if (otherGroup.memberIds && otherGroup.memberIds.trim() !== '') {
//             const currentMembers = otherGroup.memberIds.split(',').map(id => id.trim()).filter(id => id !== '');
//             console.log(`Checking group ${otherGroup.groupId} (${otherGroup.groupName}) with members:`, currentMembers);
            
//             // Check if any of the new memberIds exist in this group
//             const commonMembers = currentMembers.filter(id => 
//               finalMemberIds.includes(id)
//             );
            
//             if (commonMembers.length > 0) {
//               console.log(`Found common members in group ${otherGroup.groupName}:`, commonMembers);
              
//               // Remove the common members from this existing group
//               const updatedMemberIds = currentMembers.filter(id => 
//                 !finalMemberIds.includes(id)
//               );
              
//               // Update the existing group
//               await GroupVisibility.update(
//                 { 
//                   memberIds: updatedMemberIds.length > 0 ? updatedMemberIds.join(",") : null,
//                   updatedAt: new Date()
//                 },
//                 { 
//                   where: { groupId: otherGroup.groupId },
//                   transaction
//                 }
//               );
              
//               console.log(`Removed members ${commonMembers.join(', ')} from group ${otherGroup.groupName}`);
//             }
//           }
//         }
//       }
      
//       // Convert array to comma-separated string for database storage
//       updateData.memberIds = finalMemberIds.join(',');
//     }

//     // Handle pipelineIds - convert to comma-separated string
//     if (pipelineIds !== undefined) {
//       let finalPipelineIds = [];
      
//       if (Array.isArray(pipelineIds)) {
//         finalPipelineIds = pipelineIds;
//       } else if (typeof pipelineIds === 'string') {
//         finalPipelineIds = pipelineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
//       }
      
//       // Validate pipeline IDs exist
//       if (finalPipelineIds.length > 0) {
//         const existingPipelines = await Pipeline.findAll({
//           where: { pipelineId: { [Op.in]: finalPipelineIds } },
//           transaction
//         });
        
//         if (existingPipelines.length !== finalPipelineIds.length) {
//           const existingPipelineIds = existingPipelines.map(pipe => pipe.pipelineId);
//           const missingPipelineIds = finalPipelineIds.filter(id => !existingPipelineIds.includes(id));
//           await transaction.rollback();
//           return res.status(400).json({
//             success: false,
//             error: `Some pipelines do not exist! Missing pipeline IDs: ${missingPipelineIds.join(', ')}`
//           });
//         }
//       }
      
//       // Convert array to comma-separated string for database storage
//       updateData.pipelineIds = finalPipelineIds.join(',');
//     }

//     console.log('Update data prepared:', updateData);
//     // Update the current group
//     await group.update(updateData, { transaction });

//     // Commit transaction
//     await transaction.commit();

//     // Fetch the updated group with creator details
//     const updatedGroup = await GroupVisibility.findByPk(groupId, {
//       include: [
//         {
//           model: MasterUser,
//           as: 'creator',
//           attributes: ['masterUserID', 'name', 'email']
//         }
//       ]
//     });

//     // Get member details for the response
//     const groupData = updatedGroup.toJSON();
    
//     let members = [];
//     let memberIdArray = [];
//     if (groupData.memberIds) {
//       memberIdArray = groupData.memberIds.split(',').map(id => id.trim()).filter(id => id !== '');
//       if (memberIdArray.length > 0) {
//         members = await MasterUser.findAll({
//           where: { masterUserID: { [Op.in]: memberIdArray } },
//           attributes: ['masterUserID', 'name', 'email']
//         });
//       }
//     }

//     // Convert pipelineIds to array for response
//     let pipelineIdArray = [];
//     if (groupData.pipelineIds) {
//       pipelineIdArray = groupData.pipelineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
//     }

//     const response = {
//       ...groupData,
//       memberIds: memberIdArray, // Return as array
//       pipelineIds: pipelineIdArray, // Return as array
//       users: members.map(user => user.toJSON()),
//       userCount: members.length
//     };

//     return res.status(200).json({
//       success: true,
//       message: "Group updated successfully! Users have been removed from all other groups.",
//       data: response
//     });

//   } catch (error) {
//     await transaction.rollback();
//     console.error("Error updating group:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Internal server error",
//       message: error.message
//     });
//   }
// };

exports.deleteGroup = async (req, res) => {
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
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
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
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
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
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
      // isDefault: group.isDefault,
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
  const { GroupVisibility, Pipeline, MasterUser } = req.models;
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
      // isDefault: group.isDefault,
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
