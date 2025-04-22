const MasterUser = require("../../models/master/masterUserModel");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const masterUserSchema = require("../../validation/masterUserValidation"); // Import the validation schema
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const path = require("path");

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

    // Check if the email already exists
    const existingUser = await MasterUser.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate a secure token for password reset
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Create a new master user with the reset token
    const masterUser = await MasterUser.create({
      name,
      email,
      designation,
      department,
      resetToken,
      resetTokenExpiry: Date.now() + 3600000, // Token valid for 1 hour
      creatorId: adminId,
      createdBy: adminName,
    });

    // Send a password reset email
    const resetLink = `${process.env.FRONTEND_URL}/api/master-user/reset-password?token=${resetToken}`;
    const transporter = nodemailer.createTransport({
      service: "Gmail", // Use your email service
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Set Your Password",
      html: `<p>Hello ${name},</p>
             <p>You have been added as a master user. Please click the link below to set your password:</p>
             <a href="${resetLink}">Set Password</a>
             <p>This link will expire in 1 hour.</p>`,
    });

    // Log the creation in the audit trail

    await historyLogger(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "CREATE_MASTER_USER",
      req.adminId,
      masterUser.masterUserID,
      null,
      `Master user "${name}" created by "${adminName}"`,
      { name, email, designation, department }
    );
    res.status(201).json({
      message:
        "Master user created successfully. Password reset link sent to email.",
      masterUser,
    });
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
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "DESC",
    search = "",
  } = req.query;

  try {
    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the where clause for searching
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { designation: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
      ];
    }

    // Fetch master users with pagination, sorting, and searching
    const { count, rows } = await MasterUser.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
    });

    // Return paginated response
    res.status(200).json({
      message: "Master users fetched successfully",
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      masterUsers: rows,
    });
  } catch (error) {
    console.error("Error fetching master users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a Master User
// exports.updateMasterUser = async (req, res) => {
//   const { id } = req.params;
//   const { name, email, designation, department, isActive } = req.body;

//   try {
//     const adminId = req.user?.id; // Admin ID from the authenticated request

//     // Find the master user by ID
//     const masterUser = await MasterUser.findByPk(id);
//     if (!masterUser) {
//       return res.status(404).json({ message: "Master user not found" });
//     }

//     // Update the master user
//     await masterUser.update({
//       name,
//       email,
//       designation,
//       department,
//       isActive,
//     });

//     // Log the update in the audit trail
//     await logAuditTrail(
//       PROGRAMS.MASTER_USER_MANAGEMENT,
//       "UPDATE_MASTER_USER",
//       adminId,
//       null,
//       masterUser.masterUserID
//     );

//     res
//       .status(200)
//       .json({ message: "Master user updated successfully", masterUser });
//   } catch (error) {
//     console.error("Error updating master user:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// Delete a Master User
exports.deleteMasterUser = async (req, res) => {
  const { id } = req.params;

  try {
    const adminId = req.user?.id; // Admin ID from the authenticated request

    // Find the master user by ID
    const masterUser = await MasterUser.findByPk(id);
    if (!masterUser) {
      await logAuditTrail(
        PROGRAMS.MASTER_USER_MANAGEMENT,
        "DELETE_MASTER_USER",
        req.role,
        "Master user not found",
        req.adminId
      );

      return res.status(404).json({ message: "Master user not found" });
    }

    // Delete the master user
    await masterUser.destroy();

    await historyLogger(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "DELETE_MASTER_USER",
      masterUser.creatorId,
      masterUser.masterUserID,
      req.adminId,
      `Master user "${masterUser.name}" deleted by "${req.role}"`,
      null
    );

    res.status(200).json({ message: "Master user deleted successfully" });
  } catch (error) {
    console.error("Error deleting master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body; // Extract token and new password from the request body

  try {
    // Verify if the token is valid and not expired
    const user = await MasterUser.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: Date.now() }, // Ensure token is not expired
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password and clear the reset token
    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Handle Reset Password Link
exports.handleResetLink = async (req, res) => {
  const { token } = req.query; // Extract the token from the query parameters

  try {
    // Verify if the token is valid and not expired
    const user = await MasterUser.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: Date.now() }, // Ensure token is not expired
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // If the token is valid, redirect to the frontend reset password page
    // res.redirect(`${process.env.FRONTEND_URL}/reset-password?token=${token}`);
    res.sendFile(path.join(__dirname, "../../index.html"));
  } catch (error) {
    console.error("Error verifying reset token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
