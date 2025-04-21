const MasterUser = require("../../models/master/masterUserModel");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const masterUserSchema = require("../../validation/masterUserValidation"); // Import the validation schema

// Create a Master User
exports.createMasterUser = async (req, res) => {
  const { name, email, designation, department } = req.body;
  const { error } = masterUserSchema.validate(req.body);
  if (error) {
    await logAuditTrail(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "CREATE_MASTER_USER",
      req.role,
      error.details[0].message,
      req.adminId
      
    );
    return res.status(400).json({ message: error.details[0].message });
  }
  try {
    const adminId = req.adminId; // Admin ID from the authenticated request
    const adminName = req.role; // Admin name from the authenticated request

    // Create a new master user
    const masterUser = await MasterUser.create({
      name,
      email,
      designation,
      department,
      creatorId: adminId,
      createdBy: adminName,
    });

    // Log the creation in the audit trail
    // await logAuditTrail(
    //   PROGRAMS.MASTER_USER_MANAGEMENT, // Program ID for master user management
    //   "CREATE_MASTER_USER", // Mode
    //   adminId, // Admin ID
    //   null, // No error description
    //   masterUser.masterUserID // Master user ID
    // );

    res
      .status(201)
      .json({ message: "Master user created successfully", masterUser });
  } catch (error) {
    console.error("Error creating master user:", error);

    // Log the error in the audit trail
    await logAuditTrail(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "CREATE_MASTER_USER",
      req.role || null,
      error.message || "Internal server error",
      req.adminId || null
    );

    res.status(500).json({ message: "Internal server error" });
  }
};

// Get All Master Users
exports.getMasterUsers = async (req, res) => {
  try {
    const masterUsers = await MasterUser.findAll();
    res.status(200).json({ masterUsers });
  } catch (error) {
    console.error("Error fetching master users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a Master User
exports.updateMasterUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, designation, department, isActive } = req.body;

  try {
    const adminId = req.user?.id; // Admin ID from the authenticated request

    // Find the master user by ID
    const masterUser = await MasterUser.findByPk(id);
    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    // Update the master user
    await masterUser.update({
      name,
      email,
      designation,
      department,
      isActive,
    });

    // Log the update in the audit trail
    await logAuditTrail(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "UPDATE_MASTER_USER",
      adminId,
      null,
      masterUser.masterUserID
    );

    res
      .status(200)
      .json({ message: "Master user updated successfully", masterUser });
  } catch (error) {
    console.error("Error updating master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a Master User
exports.deleteMasterUser = async (req, res) => {
  const { id } = req.params;

  try {
    const adminId = req.user?.id; // Admin ID from the authenticated request

    // Find the master user by ID
    const masterUser = await MasterUser.findByPk(id);
    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    // Delete the master user
    await masterUser.destroy();

    // Log the deletion in the audit trail
    await logAuditTrail(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "DELETE_MASTER_USER",
      adminId,
      null,
      id
    );

    res.status(200).json({ message: "Master user deleted successfully" });
  } catch (error) {
    console.error("Error deleting master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
