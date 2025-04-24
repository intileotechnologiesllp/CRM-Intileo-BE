const MasterUserPrivileges = require("../../models/privileges/masterUserPrivilegesModel");

exports.createPrivileges = async (req, res) => {
  const { masterUserID, permissions, mode } = req.body;

  try {
    // Validate the input
    if (!masterUserID || typeof permissions !== "object") {
      return res
        .status(400)
        .json({
          message:
            "Invalid input. Please provide masterUserID and permissions as JSON.",
        });
    }

    // Check if privileges already exist for the user
    const existingPrivilege = await MasterUserPrivileges.findOne({
      where: { masterUserID },
    });
    if (existingPrivilege) {
      return res
        .status(400)
        .json({
          message:
            "Privileges already exist for this Master User. Please update instead.",
        });
    }

    // Create new privileges
    const privilege = await MasterUserPrivileges.create({
      masterUserID,
      permissions, // Store the JSON object
      createdById: req.adminId, // Admin ID from the authenticated request
      createdBy: req.role, // Role of the creator (e.g., "admin")
      mode: "create", // Optional mode field
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
