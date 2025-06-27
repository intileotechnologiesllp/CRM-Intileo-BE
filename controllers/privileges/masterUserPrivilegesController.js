const jwt = require("jsonwebtoken");
const MasterUserPrivileges = require("../../models/privileges/masterUserPrivilegesModel");
const MasterUser = require("../../models/master/masterUserModel");
const Program = require("../../models/admin/masters/programModel");

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

    // Validate and convert each permission in the array
    for (const permission of permissions) {
      // Ensure programId is an integer
      permission.programId = parseInt(permission.programId, 10);

      if (
        !permission.programId ||
        typeof permission.programId !== "number" ||
        isNaN(permission.programId)
      ) {
        return res.status(400).json({
          message:
            "Each permission must include a valid programId as an integer.",
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
      permissions, // Store the array of permissions
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
    let existingPermissions = existingPrivilege.permissions || [];

    // Ensure existingPermissions is an array
    if (typeof existingPermissions === "string") {
      existingPermissions = JSON.parse(existingPermissions); // Parse JSON string
    } else if (!Array.isArray(existingPermissions)) {
      existingPermissions = []; // Default to an empty array if not an array
    }

    console.log("Existing Permissions Before Update:", existingPermissions);

    // Update specific privileges based on programId
    for (const updatedPermission of permissions) {
      // Parse and validate programId
      updatedPermission.programId = parseInt(updatedPermission.programId, 10);
      console.log("Program ID Before Validation:", updatedPermission.programId);

      if (
        !Number.isInteger(updatedPermission.programId) ||
        updatedPermission.programId <= 0
      ) {
        return res.status(400).json({
          message:
            "Each permission must include a valid programId as a positive integer.",
        });
      }

      const index = existingPermissions.findIndex(
        (perm) => perm.programId === updatedPermission.programId
      );

      if (index !== -1) {
        existingPermissions[index] = {
          ...existingPermissions[index],
          ...updatedPermission,
        };
      } else {
        existingPermissions.push(updatedPermission);
      }
    }

    console.log("Updated Permissions After Loop:", existingPermissions);

    // Assign the updated permissions array directly
    existingPrivilege.permissions = existingPermissions;

    // Explicitly mark the `permissions` field as changed
    existingPrivilege.changed("permissions", true);

    // Save the updated privileges
    try {
      await existingPrivilege.save();
      console.log("Updated Privilege in Database:", existingPrivilege);
    } catch (error) {
      console.error("Error saving updated privileges:", error);
      return res
        .status(500)
        .json({ message: "Failed to save updated privileges." });
    }

    res.status(200).json({
      message: "Privileges updated successfully.",
      privilege: {
        ...existingPrivilege.toJSON(),
        permissions: existingPrivilege.permissions,
      },
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
    // Parse the permissions field if it is a JSON string
    const mappedUsers = users.rows.map((user) => {
      const privileges = user.privileges
        ? {
            ...user.privileges.toJSON(),
            permissions:
              typeof user.privileges.permissions === "string"
                ? JSON.parse(user.privileges.permissions) // Parse JSON string
                : user.privileges.permissions, // Use as-is if already an object
          }
        : null; // If privileges is null, return null

      return {
        ...user.toJSON(),
        privileges,
      };
    });

    // Return paginated response
    res.status(200).json({
      message: "Users fetched successfully.",
      totalRecords: users.count,
      totalPages: Math.ceil(users.count / limit),
      currentPage: parseInt(page),
      users: mappedUsers,
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

exports.getAllPrivileges = async (req, res) => {
  try {
    // Extract masterUserID from req.user (set by authMiddleware)
    const masterUserID = req.adminId;
    console.log(req.adminId, "............................masterverID");
    console.log(masterUserID);

    // // Validate the input
    // if (!masterUserID) {
    //   return res.status(400).json({
    //     message: "Invalid input. masterUserID is required in the token.",
    //   });
    // }

    // Check if the master user exists
    const masterUser = await MasterUser.findOne({ where: { masterUserID } });
    if (!masterUser) {
      return res.status(404).json({
        message: "Master User not found.",
      });
    }

    // Fetch privileges data for the master user
    const privileges = await MasterUserPrivileges.findOne({
      where: { masterUserID },
    });

    if (!privileges) {
      return res.status(404).json({
        message: "Privileges not found for this Master User.",
      });
    }

    // Parse permissions if stored as a JSON string
    const parsedPrivileges = {
      ...privileges.toJSON(),
      permissions:
        typeof privileges.permissions === "string"
          ? JSON.parse(privileges.permissions)
          : privileges.permissions,
    };

    res.status(200).json({
      message: "Privileges fetched successfully.",
      privileges: parsedPrivileges,
    });
  } catch (error) {
    console.error("Error fetching privileges:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Deactivate/Activate User
exports.toggleUserStatus = async (req, res) => {
  const { masterUserID } = req.params;
  const { status, reason } = req.body; // status: "active"/"inactive", reason: optional reason for deactivation

  try {
    // Validate the input
    if (!masterUserID) {
      return res.status(400).json({
        message: "Invalid input. Please provide a valid masterUserID.",
      });
    }

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Invalid input. status must be either 'active' or 'inactive'.",
      });
    }

    // Check if the master user exists
    const masterUser = await MasterUser.findOne({ where: { masterUserID } });
    if (!masterUser) {
      return res.status(404).json({
        message: "Master User not found.",
      });
    }

    // Prevent admin from deactivating themselves
    if (masterUserID == req.adminId && status === "inactive") {
      return res.status(400).json({
        message: "You cannot deactivate your own account.",
      });
    }

    // Update user status
    await masterUser.update({
      status: status,
      deactivatedAt: status === "inactive" ? new Date() : null,
      deactivatedBy: status === "inactive" ? req.adminId : null,
      deactivationReason: status === "inactive" ? reason || "No reason provided" : null,
    });

    // If deactivating user, optionally disable their privileges but don't delete them
    if (status === "inactive") {
      const userPrivileges = await MasterUserPrivileges.findOne({
        where: { masterUserID },
      });

      if (userPrivileges) {
        // Parse existing permissions
        let permissions = userPrivileges.permissions || [];
        if (typeof permissions === "string") {
          permissions = JSON.parse(permissions);
        }

        // Disable all permissions (set all to false)
        const disabledPermissions = permissions.map((permission) => ({
          ...permission,
          view: false,
          edit: false,
          delete: false,
          create: false,
        }));

        // Update privileges with disabled permissions
        userPrivileges.permissions = disabledPermissions;
        userPrivileges.changed("permissions", true);
        await userPrivileges.save();
      }
    } else {
      // If reactivating user, you might want to restore their original privileges
      // This would require storing original privileges somewhere or asking admin to reassign them
      // For now, we'll just keep the existing (disabled) privileges as is
      // Admin will need to manually re-enable permissions if needed
    }

    const action = status === "active" ? "activated" : "deactivated";
    const message = `User ${action} successfully${
      status === "inactive" && reason ? `. Reason: ${reason}` : ""
    }`;

    res.status(200).json({
      message: message,
      user: {
        masterUserID: masterUser.masterUserID,
        name: masterUser.name,
        email: masterUser.email,
        status: masterUser.status,
        ...(status === "inactive" && {
          deactivatedAt: masterUser.deactivatedAt,
          deactivatedBy: masterUser.deactivatedBy,
          deactivationReason: masterUser.deactivationReason,
        }),
      },
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get deactivated users
exports.getDeactivatedUsers = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "deactivatedAt",
    sortOrder = "DESC",
  } = req.query;

  try {
    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch deactivated users
    const deactivatedUsers = await MasterUser.findAndCountAll({
      where: {
        status: "inactive",
      },
      attributes: [
        "masterUserID",
        "name",
        "email",
        "mobileNumber",
        "userType",
        "designation",
        "department",
        "status",
        "deactivatedAt",
        "deactivatedBy",
        "deactivationReason",
        "createdAt",
      ],
      include: [
        {
          model: MasterUser,
          as: "DeactivatedByUser", // You'll need to add this association to the model
          attributes: ["name", "email"],
          required: false,
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
    });

    res.status(200).json({
      message: "Deactivated users fetched successfully.",
      totalRecords: deactivatedUsers.count,
      totalPages: Math.ceil(deactivatedUsers.count / limit),
      currentPage: parseInt(page),
      users: deactivatedUsers.rows,
    });
  } catch (error) {
    console.error("Error fetching deactivated users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Bulk deactivate users
exports.bulkToggleUserStatus = async (req, res) => {
  const { userIds, status, reason } = req.body;

  try {
    // Validate input
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        message: "Invalid input. Please provide an array of user IDs.",
      });
    }

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Invalid input. status must be either 'active' or 'inactive'.",
      });
    }

    // Prevent admin from deactivating themselves
    if (status === "inactive" && userIds.includes(req.adminId.toString())) {
      return res.status(400).json({
        message: "You cannot deactivate your own account.",
      });
    }

    // Update multiple users
    const updateData = {
      status: status,
      deactivatedAt: status === "inactive" ? new Date() : null,
      deactivatedBy: status === "inactive" ? req.adminId : null,
      deactivationReason: status === "inactive"
        ? reason || "Bulk action - No reason provided"
        : null,
    };

    const [updatedCount] = await MasterUser.update(updateData, {
      where: {
        masterUserID: userIds,
      },
    });

    // If deactivating users, disable their privileges
    if (status === "inactive") {
      const usersPrivileges = await MasterUserPrivileges.findAll({
        where: {
          masterUserID: userIds,
        },
      });

      for (const userPrivilege of usersPrivileges) {
        let permissions = userPrivilege.permissions || [];
        if (typeof permissions === "string") {
          permissions = JSON.parse(permissions);
        }

        const disabledPermissions = permissions.map((permission) => ({
          ...permission,
          view: false,
          edit: false,
          delete: false,
          create: false,
        }));

        userPrivilege.permissions = disabledPermissions;
        userPrivilege.changed("permissions", true);
        await userPrivilege.save();
      }
    }

    const action = status === "active" ? "activated" : "deactivated";

    res.status(200).json({
      message: `${updatedCount} users ${action} successfully.`,
      updatedCount: updatedCount,
      action: action,
    });
  } catch (error) {
    console.error("Error in bulk user status toggle:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
