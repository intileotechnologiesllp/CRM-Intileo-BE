const MasterUser = require("../../models/master/masterUserModel");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const masterUserSchema = require("../../validation/masterUserValidation"); // Import the validation schema
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { log } = require("console");
// const path = require("path");

// Create a Master User
exports.createMasterUser = async (req, res) => {
  const { name, email, designation, department, loginType } = req.body;

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
      resetTokenExpiry: Date.now() + 5 * 60 * 1000, // Token valid for 5 minute
      loginType: "master",
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
             <p>This link will expire in 5 minute.</p>`,
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
  const { token, newPassword } = req.body;

  try {
    const user = await MasterUser.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: Date.now() }, // Ensure token is not expired
      },
    });

    if (!user) {
      const expiredUser = await MasterUser.findOne({
        where: { resetToken: token },
      });

      if (expiredUser) {
        return res.status(400).json({
          message: "This reset link has expired. Please request a new one.",
          expired: true, // Add an expired flag
        });
      }

      return res.status(400).json({ message: "Invalid token." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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
      // Check if the token exists but is expired
      const expiredUser = await MasterUser.findOne({
        where: {
          resetToken: token,
        },
      });

      if (expiredUser) {
        // Redirect to the expired link page with the token
        return res.redirect(`/expired.html?token=${token}`);
      }

      return res.status(400).json({ message: "Invalid token." });
    }

    // If the token is valid, redirect to the frontend reset password page
    res.redirect(`/index.html?token=${token}`);
  } catch (error) {
    console.error("Error verifying reset token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Resend Reset Link
exports.resendResetLink = async (req, res) => {
  const { token } = req.query; // Extract the token from the query parameters

  try {
    // Check if the token exists in the database
    const user = await MasterUser.findOne({
      where: {
        resetToken: token, // Check if the token exists
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid token." });
    }

    // Generate a new reset token
    const newResetToken = crypto.randomBytes(32).toString("hex");

    // Update the user's reset token and expiry time
    await user.update({
      resetToken: newResetToken,
      resetTokenExpiry: Date.now() + 5 * 60 * 1000, // Token valid for 5 minutes
    });

    // Send the reset link via email
    const resetLink = `${process.env.FRONTEND_URL}/api/master-user/reset-password?token=${newResetToken}`;
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Request",
      html: `<p>Hello,</p>
             <p>You requested a password reset. Please click the link below to reset your password:</p>
             <a href="${resetLink}">Reset Password</a>
             <p>This link will expire in 5 minutes.</p>`,
    });

    // Send success response
    res.status(200).json({
      message: "Password reset link sent successfully to your email.",
    });
  } catch (error) {
    console.error("Error resending reset link:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Toggle Master User Status
exports.toggleMasterUserStatus = async (req, res) => {
  const { masterUserID } = req.params; // Master User ID from the request parameters
  const { isActive } = req.body; // New status (true for active, false for inactive)

  try {
    // Find the Master User by ID
    const masterUser = await MasterUser.findByPk(masterUserID);
    if (!masterUser) {
      await logAuditTrail(
        PROGRAMS.MASTER_USER_MANAGEMENT,
        "TOGGLE_MASTER_USER_STATUS",
        req.role,
        "Master user not found",
        req.adminId
      );
      return res.status(404).json({ message: "Master user not found" });
    }

    // Update the isActive status
    await masterUser.update({ isActive });

  
  await historyLogger(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "TOGGLE_MASTER_USER_STATUS",
      masterUser.creatorId,
      masterUser.masterUserID,
      req.adminId,
      `Master user "${masterUser.name}" status updated to "${
        isActive ? "Active" : "Inactive"
      }"`,
      { isActive }
    );
    res.status(200).json({
      message: `Master user status updated to ${
        isActive ? "Active" : "Inactive"
      }`,
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "TOGGLE_MASTER_USER_STATUS",
      req.role,
      error.message || "Internal server error",
      req.adminId
    );
    console.error("Error toggling master user status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
