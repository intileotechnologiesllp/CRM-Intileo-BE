const  MasterUserPrivileges  = require("../models/privileges/masterUserPrivilegesModel");

const validatePrivilege = (programId, requestType) => async (req, res, next) => {
  console.log(req.adminId)
  try {
    const  masterUserID  = req.adminId || {}; // Adjust based on your auth middleware

    if (!masterUserID) {
      return res.status(401).json({ 
        message: "User ID not found in request" 
      });
    }

    // Fetch the user's privileges
    const userPrivileges = await MasterUserPrivileges.findOne({
      where: { masterUserID }
    });

    if (!userPrivileges) {
      return res.status(401).json({ 
        message: "No privileges found for this user" 
      });
    }

    // Parse permissions if it's a string
    const permissions = typeof userPrivileges.permissions === 'string' 
      ? JSON.parse(userPrivileges.permissions) 
      : userPrivileges.permissions;

    // Find the specific program permission
    const programPermission = permissions.find(perm => perm.programId === parseInt(programId));

    if (!programPermission) {
      return res.status(403).json({ 
        message: `No permission found for program ID: ${programId}` 
      });
    }

    // Check the specific request type permission
    if (!programPermission[requestType]) {
      return res.status(403).json({ 
        message: `Insufficient permissions for ${requestType} operation on program ID: ${programId}` 
      });
    }

    console.log("Permission granted");
    next();
  } catch (error) {
    console.error("Error occurred in checking privileges:", error);
    return res.status(500).json({ 
      message: "Internal server error while checking privileges" 
    });
  }
};

module.exports = validatePrivilege;