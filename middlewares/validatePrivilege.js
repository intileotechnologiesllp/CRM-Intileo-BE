const MasterUser = require("../models/master/masterUserModel");
const permissionSet = require("../models/permissionsetModel");

// Permission mapping: numeric permission ID to programId + requestType
const PERMISSION_MAPPING = {
  // Deals permissions (programId: 1)
  "0": { programId: 1, requestType: "create" },      // Add deals
  "1": { programId: 1, requestType: "edit_others" }, // Edit deals owned by other users
  "2": { programId: 1, requestType: "edit_owner" },  // Edit the owner on a deal owned by other users
  "3": { programId: 1, requestType: "delete" },      // Delete deals
  "4": { programId: 1, requestType: "convert" },     // Convert deals to leads
  "5": { programId: 1, requestType: "merge" },       // Merge deals
  "6": { programId: 1, requestType: "edit_time" },   // Edit a deal's won/lost time
  
  // Leads permissions (programId: 2)
  "7": { programId: 2, requestType: "create" },      // Add lead
  "8": { programId: 2, requestType: "edit_others" }, // Edit leads owned by other users
  "9": { programId: 2, requestType: "edit_owner" },  // Edit the owner on a lead owned by other users
  "10": { programId: 2, requestType: "delete" },     // Delete leads
  "11": { programId: 2, requestType: "merge" },      // Merge leads
  
  // Analytics/Views permissions (programId: 3)
  "12": { programId: 3, requestType: "view_analytics" }, // See deals/value sum in pipelines and deal list views
  
  // Activities permissions (programId: 4)
  "21": { programId: 4, requestType: "edit_owner" },  // Edit the owner on an activity owned by other users
  "22": { programId: 4, requestType: "delete" },      // Delete activities
  
  // People/Organization permissions (programId: 5)
  "23": { programId: 5, requestType: "create" },      // Add people
  "25": { programId: 5, requestType: "delete" },      // Delete people
  "26": { programId: 5, requestType: "create_org" },  // Add organizations
  "28": { programId: 5, requestType: "delete_org" },  // Delete organizations
  
  // Filter permissions (programId: 6)
  "18": { programId: 6, requestType: "share_filters" },      // Share filters with other users
  "19": { programId: 6, requestType: "edit_shared_filters" }, // Edit shared filters of other users
  
  // Products permissions (programId: 7)
  "29": { programId: 7, requestType: "create" },            // Add products
  "30": { programId: 7, requestType: "edit_others" },       // Edit products owned by other users
  "31": { programId: 7, requestType: "edit_owner" },        // Edit the owner on a product owned by other users
  "32": { programId: 7, requestType: "delete" },            // Delete products
  "33": { programId: 7, requestType: "delete_variations" }, // Delete product price variations
};

const validatePrivilege = (permissionIdOrProgramId, requestType, options = {}) => async (req, res, next) => {
  console.log("🚀 ========== VALIDATE PRIVILEGE STARTED ==========");
  console.log(`📌 Permission ID/Program ID: ${permissionIdOrProgramId}`);
  console.log(`📌 Request Type: ${requestType}`);
  console.log(`📌 User ID (req.adminId): ${req.adminId}`);
  console.log(`📌 Options:`, options);
  
  try {
    const masterUserID = req.adminId;
    const { checkOwnership = false, ownershipModel = null } = options;

    if (!masterUserID) {
      console.log("❌ FAILED: User ID not found in request");
      return res.status(401).json({ 
        message: "User ID not found in request" 
      });
    }

    // If checkOwnership is enabled, verify ownership first (owners can always edit their own items)
    if (checkOwnership && ownershipModel && req.params) {
      const entityId = req.params.dealId || req.params.leadId || req.params.id;
      
      if (entityId) {
        try {
          const entity = await ownershipModel.findByPk(entityId, {
            attributes: ['masterUserID', 'ownerId']
          });
          
          if (entity) {
            const isOwner = (entity.masterUserID === masterUserID || entity.ownerId === masterUserID);
            
            if (isOwner) {
              console.log(`✅ User is owner - bypassing permission check for ${requestType}`);
              return next();
            }
          }
        } catch (ownershipError) {
          console.error("Error checking ownership:", ownershipError);
          // Continue to permission check if ownership check fails
        }
      }
    }

    // Fetch user to get permissionSetId and globalPermissionSetId
    console.log(`🔎 Fetching user ${masterUserID} from MasterUser table...`);
    const user = await MasterUser.findByPk(masterUserID, {
      attributes: ['masterUserID', 'permissionSetId', 'globalPermissionSetId']
    });

    if (!user) {
      console.log(`❌ FAILED: User ${masterUserID} not found in database`);
      return res.status(401).json({ 
        message: "User not found" 
      });
    }

    console.log(`✅ User found:`, {
      masterUserID: user.masterUserID,
      permissionSetId: user.permissionSetId,
      globalPermissionSetId: user.globalPermissionSetId
    });

    // Prioritize globalPermissionSetId over permissionSetId
    const permissionSetId = user.globalPermissionSetId || user.permissionSetId;
    console.log(`📊 Using permission set ID: ${permissionSetId} (${user.globalPermissionSetId ? 'global' : 'regular'})`);

    if (!permissionSetId) {
      console.log(`❌ FAILED: No permission set assigned to user ${masterUserID}`);
      return res.status(403).json({ 
        message: "No permission set assigned to user" 
      });
    }

    // Fetch the user's permission set
    console.log(`🔎 Fetching permission set ${permissionSetId}...`);
    const userPermissionSet = await permissionSet.findByPk(permissionSetId);

    if (!userPermissionSet || !userPermissionSet.permissions) {
      console.log(`❌ FAILED: Permission set ${permissionSetId} not found or has no permissions`);
      return res.status(403).json({ 
        message: "Permission set not found or has no permissions" 
      });
    }

    console.log(`✅ Permission set found:`, {
      permissionSetId: userPermissionSet.permissionSetId,
      name: userPermissionSet.name || 'N/A'
    });

    // Get permissions object (handle both string and object storage)
    const permissions = typeof userPermissionSet.permissions === 'string' 
      ? JSON.parse(userPermissionSet.permissions) 
      : userPermissionSet.permissions;

    console.log(`🔍 Checking permission: ID=${permissionIdOrProgramId}, requestType=${requestType}`);
    console.log(`📋 User ${masterUserID} permissions:`, JSON.stringify(permissions));

    // Strategy 1: Try direct numeric permission ID lookup first
    // Check if the first parameter is a numeric permission ID that exists in the mapping
    const directPermissionId = String(permissionIdOrProgramId);
    console.log(`🔍 Strategy 1: Checking direct permission ID "${directPermissionId}"...`);
    console.log(`   - Permission mapping exists: ${!!PERMISSION_MAPPING[directPermissionId]}`);
    if (PERMISSION_MAPPING[directPermissionId]) {
      console.log(`   - Mapped requestType: ${PERMISSION_MAPPING[directPermissionId].requestType}`);
      console.log(`   - Expected requestType: ${requestType}`);
      console.log(`   - Match: ${PERMISSION_MAPPING[directPermissionId].requestType === requestType}`);
    }
    
    if (PERMISSION_MAPPING[directPermissionId] && 
        PERMISSION_MAPPING[directPermissionId].requestType === requestType) {
      // Direct match found - check if user has this specific permission
      const hasDirectPermission = permissions[directPermissionId] === true;
      
      console.log(`🔑 Direct permission check: permission[${directPermissionId}] = ${permissions[directPermissionId]}, hasDirectPermission = ${hasDirectPermission}`);
      
      if (hasDirectPermission) {
        console.log(`✅ ========== PERMISSION GRANTED: Direct match for permission ${directPermissionId} ==========`);
        return next();
      } else {
        // Permission explicitly set to false or missing
        console.log(`❌ ========== PERMISSION DENIED: Permission ${directPermissionId} is ${permissions[directPermissionId]} (expected true) ==========`);
        return res.status(403).json({ 
          message: `Insufficient permissions for ${requestType} operation. You need permission ${directPermissionId} to perform this action.` 
        });
      }
    }
    
    console.log(`⚠️ Strategy 1 did not match, falling back to Strategy 2 (programId search)...`);

    // Strategy 2: Treat first parameter as programId and search by programId + requestType
    let hasPermission = false;
    const programId = parseInt(permissionIdOrProgramId);
    console.log(`🔍 Strategy 2: Searching for programId ${programId} + requestType "${requestType}"...`);
    
    for (const [permissionId, isAllowed] of Object.entries(permissions)) {
      if (isAllowed === true) {
        const mapping = PERMISSION_MAPPING[permissionId];
        if (mapping) {
          console.log(`   - Checking permission ${permissionId}: programId=${mapping.programId}, requestType="${mapping.requestType}"`);
        }
        if (mapping && 
            mapping.programId === programId && 
            mapping.requestType === requestType) {
          hasPermission = true;
          console.log(`✅ ========== PERMISSION GRANTED: Found via programId ${programId} + ${requestType} (permission ${permissionId}) ==========`);
          break;
        }
      }
    }

    if (!hasPermission) {
      console.log(`❌ ========== PERMISSION DENIED: No matching permission for programId ${programId} + ${requestType} ==========`);
      return res.status(403).json({ 
        message: `Insufficient permissions for ${requestType} operation (ID: ${permissionIdOrProgramId})` 
      });
    }

    console.log(`✅ ========== CALLING next() - PERMISSION CHECK PASSED ==========`);
    next();
  } catch (error) {
    console.error("Error occurred in checking privileges:", error);
    return res.status(500).json({ 
      message: "Internal server error while checking privileges" 
    });
  }
};

module.exports = validatePrivilege;