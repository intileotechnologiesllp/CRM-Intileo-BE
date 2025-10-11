const { google } = require('googleapis');

// Start Google OAuth flow for calendar sync
exports.startGoogleOAuth = async (req, res) => {
  const { email } = req.body;
  const masterUserID = req.body.masterUserID || req.adminId;
  if (!email || !masterUserID) {
    return res.status(400).json({ message: 'Email and masterUserID are required.' });
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // e.g. https://yourdomain.com/api/master-user/google-auth/callback
  );
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: JSON.stringify({ email, masterUserID })
  });
  res.json({ url });
};

// Handle Google OAuth callback and save token
exports.handleGoogleOAuthCallback = async (req, res) => {
  const code = req.query.code;
  let state = req.query.state;
  let email, masterUserID;
  try {
    if (state) {
      const parsed = JSON.parse(state);
      email = parsed.email;
      masterUserID = parsed.masterUserID || req.adminId;
    }
  } catch (err) {
    return res.status(400).json({ message: 'Invalid state parameter.' });
  }
  if (!code || !email || !masterUserID) {
    return res.status(400).json({ message: 'Missing code, email, or masterUserID.' });
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  try {
    const { tokens } = await oauth2Client.getToken(code);
    // Save token to user record
    await MasterUser.update(
      { googleOAuthToken: JSON.stringify(tokens) },
      { where: { masterUserID, email } }
    );
    res.json({ message: 'Google Calendar connected successfully.' });
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).json({ message: 'Failed to connect Google Calendar.' });
  }
};
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
const Program = require("../../models/admin/masters/programModel");
const MasterUserPrivileges = require("../../models/privileges/masterUserPrivilegesModel"); // Import the MasterUserPrivileges model
// const path = require("path");

// Create a Master User
exports.createMasterUser = async (req, res) => {
  const {
    name,
    email,
    mobileNumber,
    designation,
    department,
    userType,
    password,
    loginType = userType === "admin" ? "admin" : "general", // Dynamically set loginType based on userType
    status,
  } = req.body;

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

    // Check if the email, mobile number, or name already exists
    const existingUser = await MasterUser.findOne({
      where: {
        [Op.or]: [{ email }, { mobileNumber }, { name }],
      },
    });
    if (existingUser) {
      let message = "";
      if (existingUser.email === email) {
        message = "Email already exists";
      } else if (existingUser.mobileNumber === mobileNumber) {
        message = "Mobile number already exists";
      } else if (existingUser.name === name) {
        message = "User with this name already exists";
      } else {
        message = "Email, mobile number, or name already exists";
      }
      
      await logAuditTrail(
        PROGRAMS.MASTER_USER_MANAGEMENT,
        "CREATE_MASTER_USER",
        req.role,
        message,
        req.adminId
      );
      
      return res.status(400).json({ message });
    }

    let resetToken = null; // Initialize reset token
    let resetTokenExpiry = null; // Initialize reset token expiry

    // If the userType is "general", generate a secure token for password reset
    if (userType === "general") {
      resetToken = crypto.randomBytes(32).toString("hex");
      resetTokenExpiry = Date.now() + 5 * 60 * 1000; // Token valid for 5 minutes
    }

    // Create a new master user
    const masterUser = await MasterUser.create({
      name,
      email,
      mobileNumber,
      designation: userType === "admin" ? null : designation, // Remove designation if userType is "admin"
      department: userType === "admin" ? null : department, // Remove department if userType is "admin"
      password: userType === "admin" ? await bcrypt.hash(password, 10) : null, // Use provided password for admin
      resetToken,
      resetTokenExpiry,
      loginType, // Dynamically set loginType based on userType
      creatorId: adminId,
      createdBy: adminName,
      userType: userType === "admin" ? "admin" : "general", // Set userType based on the userType
      status, // Use status from req.body or default to "active"
    });
    // Fetch all programs from the Program table
    const programs = await Program.findAll({
      attributes: ["programId", "program_desc"],
    });
    if (!programs || programs.length === 0) {
      return res.status(404).json({
        message: "No programs found in the system.",
      });
    }
    // Generate default permissions for all programs
    const defaultPermissions = programs.map((program) => ({
      programId: program.programId,
      program_desc: program.program_desc,
      view: false,
      edit: false,
      delete: false,
      create: false,
    }));

    // Create default privileges for the new master user
    await MasterUserPrivileges.create({
      masterUserID: masterUser.masterUserID,
      permissions: defaultPermissions,
      createdById: adminId,
      createdBy: adminName,
      mode: "create",
    });
    // If the userType is "general", send a password reset email
    if (userType === "general") {
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
               <p>This link will expire in 5 minutes.</p>`,
      });
    }

    // Log the creation in the audit trail
    await historyLogger(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "CREATE_MASTER_USER",
      req.adminId,
      masterUser.masterUserID,
      null,
      `Master user "${name}" created by "${adminName}"`,
      {
        name,
        email,
        mobileNumber,
        designation,
        department,
        userType,
        loginType,
        status,
      }
    );

    // Send response
    res.status(201).json({
      message: `Master user created successfully.${
        userType === "admin"
          ? " Password saved."
          : " Password reset link sent to email."
      }`,
      masterUser: {
        masterUserID: masterUser.masterUserID,
        name: masterUser.name,
        email: masterUser.email,
        mobileNumber: masterUser.mobileNumber,
        userType: masterUser.userType, // Include userType in the response
        status: masterUser.status, // Include status in the response
        ...(userType !== "admin" && { designation: masterUser.designation }), // Include designation only if userType is not "admin"
        ...(userType !== "admin" && { department: masterUser.department }), // Include department only if userType is not "admin"
      },
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
    limit = 100,
    sortBy = "createdAt",
    sortOrder = "DESC",
    search = "",
    userType, // Filter by userType (admin or general)
  } = req.query;

  try {
    // Import LoginHistory model
    const LoginHistory = require("../../models/reports/loginHistoryModel");

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build the where clause for searching and filtering by userType
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { designation: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add userType filter if userType is provided
    if (userType) {
      whereClause.userType = userType;
    }

    // Fetch master users with pagination, sorting, searching, and privileges
    const { count, rows } = await MasterUser.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: MasterUserPrivileges,
          as: "privileges", // Use the alias defined in the association
          required: false, // Include users even if they don't have privileges
        },
      ],
    });

    // Get all active and deactive users separately (without pagination)
    const allActiveUsers = await MasterUser.findAll({
      where: { 
        ...whereClause,
        isActive: true // Use isActive column instead of status
      },
      include: [
        {
          model: MasterUserPrivileges,
          as: "privileges",
          required: false,
        },
      ],
      order: [['name', 'ASC']]
    });

    const allInactiveUsers = await MasterUser.findAll({
      where: { 
        ...whereClause,
        isActive: false // Use isActive column instead of status
      },
      include: [
        {
          model: MasterUserPrivileges,
          as: "privileges",
          required: false,
        },
      ],
      order: [['name', 'ASC']]
    });

    // Function to get last login data for a user
    const getLastLoginData = async (userId) => {
      try {
        const lastLogin = await LoginHistory.findOne({
          where: { userId: userId },
          order: [['loginTime', 'DESC']],
          limit: 1
        });
        return lastLogin ? {
          lastLoginTime: lastLogin.loginTime,
          lastLoginIpAddress: lastLogin.ipAddress,
          lastLoginDuration: lastLogin.duration,
          lastLogoutTime: lastLogin.logoutTime,
          lastLoginLocation: {
            latitude: lastLogin.latitude,
            longitude: lastLogin.longitude
          }
        } : {
          lastLoginTime: null,
          lastLoginIpAddress: null,
          lastLoginDuration: null,
          lastLogoutTime: null,
          lastLoginLocation: null
        };
      } catch (error) {
        console.error(`Error fetching last login for user ${userId}:`, error);
        return {
          lastLoginTime: null,
          lastLoginIpAddress: null,
          lastLoginDuration: null,
          lastLogoutTime: null,
          lastLoginLocation: null
        };
      }
    };

    // Function to format user data with privileges and last login
    const formatUserData = async (user) => {
      const privileges = user.privileges
        ? {
            ...user.privileges.toJSON(),
            permissions:
              typeof user.privileges.permissions === "string"
                ? JSON.parse(user.privileges.permissions)
                : user.privileges.permissions,
          }
        : null;

      const lastLoginData = await getLastLoginData(user.masterUserID);

      return {
        ...user.toJSON(),
        privileges,
        ...lastLoginData
      };
    };

    // Parse the permissions field if it is a JSON string for paginated results
    const mappedUsers = await Promise.all(rows.map(formatUserData));

    // Format active users with last login data
    const formattedActiveUsers = await Promise.all(allActiveUsers.map(formatUserData));

    // Format inactive users with last login data
    const formattedInactiveUsers = await Promise.all(allInactiveUsers.map(formatUserData));

    // Return paginated response with separate arrays
    res.status(200).json({
      message: "Master users fetched successfully",
      totalRecords: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      counts: {
        active: allActiveUsers.length,
        inactive: allInactiveUsers.length,
        total: allActiveUsers.length + allInactiveUsers.length
      },
      // Original paginated response (unchanged)
      masterUsers: mappedUsers,
      // Separate arrays for active and inactive users based on isActive column
      activeUsers: formattedActiveUsers,
      inactiveUsers: formattedInactiveUsers
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

exports.updateMasterUser = async (req, res) => {
  const { masterUserID } = req.params; // Master User ID from the request parameters
  const { name, email, mobileNumber, designation, department, status } =
    req.body; // Fields to update

  try {
    // Find the master user by ID
    const masterUser = await MasterUser.findByPk(masterUserID);
    if (!masterUser) {
      await logAuditTrail(
        PROGRAMS.MASTER_USER_MANAGEMENT,
        "UPDATE_MASTER_USER",
        req.role,
        "Master user not found",
        req.adminId
      );
      return res.status(404).json({ message: "Master user not found" });
    }

    // Check if the email or mobile number already exists for another user
    if (email || mobileNumber) {
      const whereClause = {
        [Op.or]: [],
        masterUserID: { [Op.ne]: masterUserID }, // Exclude the current user
      };

      if (email) whereClause[Op.or].push({ email });
      if (mobileNumber) whereClause[Op.or].push({ mobileNumber });

      if (whereClause[Op.or].length > 0) {
        const existingUser = await MasterUser.findOne({ where: whereClause });
        if (existingUser) {
          return res
            .status(400)
            .json({ message: "Email or mobile number already exists" });
        }
      }
    }

    // Update the master user details
    const updatedFields = {
      ...(name && { name }),
      ...(email && { email }),
      ...(mobileNumber && { mobileNumber }),
      ...(designation && { designation }),
      ...(department && { department }),
      ...(status && { status }),
    };

    await masterUser.update(updatedFields);

    // Log the update in the audit trail
    await historyLogger(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "UPDATE_MASTER_USER",
      masterUser.creatorId,
      masterUser.masterUserID,
      req.adminId,
      `Master user "${masterUser.name}" updated by "${req.role}"`,
      updatedFields
    );

    res.status(200).json({
      message: "Master user updated successfully",
      masterUser,
    });
  } catch (error) {
    console.error("Error updating master user:", error);
    await logAuditTrail(
      PROGRAMS.MASTER_USER_MANAGEMENT,
      "UPDATE_MASTER_USER",
      req.role,
      error.message || "Internal server error",
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};
// Get Profile of Current Master User
exports.getProfile = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware

  try {
    const masterUser = await MasterUser.findOne({
      where: { masterUserID },
      attributes: [
        "name",
        "lastName",
        "bio",
        "location",
        "mobileNumber",
        "designation",
        "department",
        "profileImage",
        "email",
        "loginType",
        "userType", // Include userType in the response
        "createdAt",   // Add this line
        "updatedAt",
      ],
    });
    if (!masterUser) {
      return res.status(404).json({ message: "Profile not found." });
    }
    res.status(200).json({
      message: "Profile fetched successfully.",
      profile: masterUser,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch profile.", error: error.message });
  }
};
exports.updateProfile = async (req, res) => {
  const masterUserID = req.adminId;
  const {
    name,
    lastName,
    bio,
    location,
    mobileNumber,
    designation,
    department,
  } = req.body;
  let profileImage;

  if (req.file) {
    // Save the relative or absolute path/URL as needed
    const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";
    profileImage = `${baseURL}/uploads/profile-images/${req.file.filename}`;
  }

  try {
    const masterUser = await MasterUser.findOne({ where: { masterUserID } });
    if (!masterUser) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const updatedFields = {
      ...(name && { name }),
      ...(lastName && { lastName }),
      ...(bio && { bio }),
      ...(location && { location }),
      ...(mobileNumber && { mobileNumber }),
      ...(designation && { designation }),
      ...(department && { department }),
      ...(profileImage && { profileImage }), // Now saves the full path/URL
    };

    await masterUser.update(updatedFields);

    res.status(200).json({
      message: "Profile updated successfully.",
      profile: masterUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ message: "Failed to update profile.", error: error.message });
  }
};
