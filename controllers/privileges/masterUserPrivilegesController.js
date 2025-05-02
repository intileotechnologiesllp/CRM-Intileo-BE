const MasterUserPrivileges = require("../../models/privileges/masterUserPrivilegesModel");
const MasterUser = require("../../models/master/masterUserModel");
const Program = require("../../models/admin/masters/programModel")
exports.createPrivileges = async (req, res) => {
  const { masterUserID, permissions, mode } = req.body;

  try {
    // Validate the input
    if (!masterUserID || !Array.isArray(permissions)) {
      return res.status(400).json({
        message:
          "Invalid input. Please provide masterUserID and permissions as an array.",
      });
    }

    // Check if privileges already exist for the user
    const existingPrivilege = await MasterUserPrivileges.findOne({
      where: { masterUserID },
    });
    if (existingPrivilege) {
      return res.status(400).json({
        message:
          "Privileges already exist for this Master User. Please update instead.",
      });
    }

    // Validate each permission in the array
    for (const permission of permissions) {
      if (!permission.programId || typeof permission.programId !== "string") {
        return res.status(400).json({
          message: "Each permission must include a valid programId.",
        });
      }
      if (
        typeof permission.view !== "boolean" ||
        typeof permission.edit !== "boolean" ||
        typeof permission.delete !== "boolean" ||
        typeof permission.create !== "boolean"
      ) {
        return res.status(400).json({
          message:
            "Each permission must include valid boolean values for view, edit, delete, and create.",
        });
      }
    }

    // Create new privileges
    const privilege = await MasterUserPrivileges.create({
      masterUserID,
      permissions, // Convert permissions to a JSON string // Store the array of permissions
      createdById: req.adminId, // Admin ID from the authenticated request
      createdBy: req.role, // Role of the creator (e.g., "admin")
      mode: mode || "create", // Optional mode field
    });

    res.status(201).json({
      message: "Privileges created successfully.",
      privilege,
    });
  } catch (error) {
    console.error("Error creating privileges:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updatePrivileges = async (req, res) => {
  const { masterUserID, permissions } = req.body;

  try {
    // Validate the input
    if (!masterUserID || !Array.isArray(permissions)) {
      return res.status(400).json({
        message:
          "Invalid input. Please provide masterUserID and permissions as an array.",
      });
    }

    // Check if privileges exist for the user
    const existingPrivilege = await MasterUserPrivileges.findOne({
      where: { masterUserID },
    });
    if (!existingPrivilege) {
      return res.status(404).json({
        message:
          "Privileges do not exist for this Master User. Please use the create API instead.",
      });
    }

    // Parse the existing permissions
    const existingPermissions = existingPrivilege.permissions || [];

    // Update specific privileges based on programId
    for (const updatedPermission of permissions) {
      if (
        !updatedPermission.programId ||
        typeof updatedPermission.programId !== "string"
      ) {
        return res.status(400).json({
          message: "Each permission must include a valid programId.",
        });
      }

      // Find the existing permission for the given programId
      const index = existingPermissions.findIndex(
        (perm) => perm.programId === updatedPermission.programId
      );

      if (index !== -1) {
        // Update the existing permission
        existingPermissions[index] = {
          ...existingPermissions[index],
          ...updatedPermission, // Merge the updated fields
        };
      } else {
        // Add new permission if programId does not exist
        existingPermissions.push(updatedPermission);
      }
    }

    // Save the updated permissions
    existingPrivilege.permissions = existingPermissions;
    await existingPrivilege.save();

    res.status(200).json({
      message: "Privileges updated successfully.",
      privilege: existingPrivilege,
    });
  } catch (error) {
    console.error("Error updating privileges:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUsersWithPrivileges = async (req, res) => {
  const {
    userType,
    masterUserID,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "DESC",
  } = req.body || {};

  try {
    // Validate the input
    if (userType && !["admin", "general"].includes(userType)) {
      return res.status(400).json({
        message: "Invalid userType. Please provide 'admin' or 'general'.",
      });
    }

    // Build the where clause for filtering
    const whereClause = {};
    if (userType) {
      whereClause.userType = userType;
    }
    if (masterUserID) {
      whereClause.masterUserID = masterUserID;
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch data with pagination, sorting, and filtering
    const users = await MasterUser.findAndCountAll({
      where: whereClause,
      attributes: {
        exclude: [
          "resetToken",
          "resetTokenExpiry",
          "loginType",
          "otp",
          "otpExpiration",
          "createdAt",
          "updatedAt",
        ], // Exclude specific fields
      },

    include: [
      {
        model: MasterUserPrivileges,
        as: "privileges", // Use the alias defined in the association
        required: false, // Include users even if they don't have privileges
        // include: [
        //   {
        //     model: Program, // Join with the Program model
        //     as: "program", // Use the alias defined in the association
        //     attributes: ["programId", "program_desc"], // Fetch programId and program_desc
        //   },
        // ],
          
      },
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

    // Return paginated response
    res.status(200).json({
      message: "Users fetched successfully.",
      totalRecords: users.count,
      totalPages: Math.ceil(users.count / limit),
      currentPage: parseInt(page),
      users: users.rows,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deletePrivileges = async (req, res) => {
  const { masterUserID } = req.params;

  try {
    // Validate the input
    if (!masterUserID) {
      return res.status(400).json({
        message: "Invalid input. Please provide a valid masterUserID.",
      });
    }

    // Check if privileges exist for the user
    const existingPrivilege = await MasterUserPrivileges.findOne({
      where: { masterUserID },
    });
    if (!existingPrivilege) {
      return res.status(404).json({
        message: "Privileges do not exist for this Master User.",
      });
    }

    // Delete the privileges
    await MasterUserPrivileges.destroy({
      where: { masterUserID },
    });

    res.status(200).json({
      message: "Privileges deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting privileges:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
