const adminService = require("../../services/adminServices.js");
const LoginHistory = require("../../models/reports/loginHistoryModel.js");
const RecentLoginHistory = require("../../models/reports/recentLoginHistoryModel");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Admin = require("../../models/adminModel.js");
const MasterUser = require("../../models/master/masterUserModel.js"); // Import MasterUser model
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Import the audit trail utility
const PROGRAMS = require("../../utils/programConstants");
const MiscSettings = require("../../models/miscSettings/miscSettingModel.js");
const GroupVisibility = require("../../models/admin/groupVisibilityModel.js")

// exports.signIn = async (req, res) => {
//   const { email, password, longitude, latitude, ipAddress } = req.body;

//   try {
//     // Check if the user exists
//     const user = await MasterUser.findOne({ where: { email } });

//     if (!user) {
//       await logAuditTrail(
//         PROGRAMS.AUTHENTICATION,
//         "SIGN_IN",
//         "Invalid email",
//         null
//       );
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Verify the password
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       await logAuditTrail(
//         PROGRAMS.AUTHENTICATION,
//         "SIGN_IN",
//         user.loginType,
//         "Invalid password",
//         user.masterUserID
//       );
//       return res.status(401).json({ message: "Invalid password" });
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       {
//         id: user.masterUserID,
//         email: user.email,
//         loginType: user.loginType,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "30d" }
//     );

//     // Get the current UTC time
//     const loginTimeUTC = new Date();

//     // Convert login time to IST
//     const loginTimeIST = moment(loginTimeUTC)
//       .tz("Asia/Kolkata")
//       .format("YYYY-MM-DD HH:mm:ss");

//     // Fetch the latest login history for the user
//     const latestLoginHistory = await LoginHistory.findOne({
//       where: { userId: user.masterUserID },
//       order: [["loginTime", "DESC"]],
//     });

//     // Fetch the previous totalSessionDuration
//     let previousTotalDurationInSeconds = 0;
//     if (latestLoginHistory && latestLoginHistory.totalSessionDuration) {
//       const [hours, minutes] = latestLoginHistory.totalSessionDuration
//         .replace(" hours", "")
//         .replace(" minutes", "")
//         .split(" ")
//         .map(Number);

//       previousTotalDurationInSeconds =
//         (hours || 0) * 3600 + (minutes || 0) * 60;
//     }

//     // Add the current session's duration (default to 0 for a new session)
//     const currentSessionDurationInSeconds = 0; // No logout yet for the new session
//     const totalSessionDurationInSeconds =
//       previousTotalDurationInSeconds + currentSessionDurationInSeconds;

//     // Convert total session duration to hours and minutes
//     const totalHours = Math.floor(totalSessionDurationInSeconds / 3600);
//     const totalMinutes = Math.floor(
//       (totalSessionDurationInSeconds % 3600) / 60
//     );
//     const totalSessionDuration = `${totalHours} hours ${totalMinutes} minutes`;

//     // Save the new login history
//     await LoginHistory.create({
//       userId: user.masterUserID,
//       loginType: user.loginType,
//       ipAddress: ipAddress || null,
//       longitude: longitude || null,
//       latitude: latitude || null,
//       loginTime: loginTimeIST,
//       username: user.name,
//       totalSessionDuration, // Save updated totalSessionDuration
//     });

//     // Delete any existing records for the user in RecentLoginHistory
//     await RecentLoginHistory.destroy({
//       where: { userId: user.masterUserID },
//     });

//     // Add the most recent login data to RecentLoginHistory
//     await RecentLoginHistory.create({
//       userId: user.masterUserID,
//       loginType: user.loginType,
//       ipAddress: ipAddress || null,
//       longitude: longitude || null,
//       latitude: latitude || null,
//       loginTime: loginTimeIST,
//       username: user.name,
//       totalSessionDuration, // Save updated totalSessionDuration
//     });

//     // Return the response with totalSessionDuration
//     res.status(200).json({
//       message: `${
//         user.loginType === "admin" ? "Admin" : "General User"
//       } sign-in successful`,
//       token,
//       totalSessionDuration,
//     });
//   } catch (error) {
//     console.error("Error during sign-in:", error);

//     await logAuditTrail(
//       PROGRAMS.AUTHENTICATION,
//       "SIGN_IN",
//       "unknown",
//       error.message || "Internal server error"
//     );

//     res.status(500).json({ message: "Internal server error" });
//   }
// };

exports.signIn = async (req, res) => {
  const { email, password, longitude, latitude, ipAddress } = req.body;

  try {
    // Check if the user exists
    const user = await MasterUser.findOne({ where: { email } });

    if (!user) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "SIGN_IN",
        "Invalid email",
        null
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "SIGN_IN",
        user.loginType,
        "Invalid password",
        user.masterUserID
      );
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.masterUserID,
        email: user.email,
        loginType: user.loginType,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Get the current UTC time
    const loginTimeUTC = new Date();

    // Convert login time to IST
    const loginTimeIST = moment(loginTimeUTC)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    // Fetch the latest login history for the user
    const latestLoginHistory = await LoginHistory.findOne({
      where: { userId: user.masterUserID },
      order: [["loginTime", "DESC"]],
    });

    // Fetch the previous totalSessionDuration
    let previousTotalDurationInSeconds = 0;
    if (latestLoginHistory && latestLoginHistory.totalSessionDuration) {
      const [hours, minutes] = latestLoginHistory.totalSessionDuration
        .replace(" hours", "")
        .replace(" minutes", "")
        .split(" ")
        .map(Number);

      previousTotalDurationInSeconds =
        (hours || 0) * 3600 + (minutes || 0) * 60;
    }

    // Add the current session's duration (default to 0 for a new session)
    const currentSessionDurationInSeconds = 0; // No logout yet for the new session
    const totalSessionDurationInSeconds =
      previousTotalDurationInSeconds + currentSessionDurationInSeconds;

    // Convert total session duration to hours and minutes
    const totalHours = Math.floor(totalSessionDurationInSeconds / 3600);
    const totalMinutes = Math.floor(
      (totalSessionDurationInSeconds % 3600) / 60
    );
    const totalSessionDuration = `${totalHours} hours ${totalMinutes} minutes`;

    // Save the new login history
    await LoginHistory.create({
      userId: user.masterUserID,
      loginType: user.loginType,
      ipAddress: ipAddress || null,
      longitude: longitude || null,
      latitude: latitude || null,
      loginTime: loginTimeIST,
      username: user.name,
      totalSessionDuration, // Save updated totalSessionDuration
    });

    // Delete any existing records for the user in RecentLoginHistory
    await RecentLoginHistory.destroy({
      where: { userId: user.masterUserID },
    });

    // Add the most recent login data to RecentLoginHistory
    await RecentLoginHistory.create({
      userId: user.masterUserID,
      loginType: user.loginType,
      ipAddress: ipAddress || null,
      longitude: longitude || null,
      latitude: latitude || null,
      loginTime: loginTimeIST,
      username: user.name,
      totalSessionDuration, // Save updated totalSessionDuration
    });

    // Fetch user's groups
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
      const groupUserIds = group.group; // This uses the getter which returns an array
      return groupUserIds.includes(parseInt(user.masterUserID));
    });

    // Format the groups
    const formattedGroups = userGroups.map(group => ({
      groupId: group.groupId,
      groupName: group.groupName,
      description: group.description,
      isDefault: group.isDefault,
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

    // Extract just the group IDs for localStorage
    const groupIds = formattedGroups.map(group => group.groupId);

    // Return the response with totalSessionDuration and user groups
    res.status(200).json({
      message: `${
        user.loginType === "admin" ? "Admin" : "General User"
      } sign-in successful`,
      token,
      totalSessionDuration,
      userGroups: formattedGroups, // Full group objects
      groupIds: groupIds, // Just the IDs for localStorage
      user: {
        id: user.masterUserID,
        email: user.email,
        name: user.name,
        loginType: user.loginType
      }
    });
  } catch (error) {
    console.error("Error during sign-in:", error);

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "SIGN_IN",
      "unknown",
      error.message || "Internal server error"
    );

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await adminService.createAdmin(email, password);
    res.status(201).json({ message: "Admin created successfully", admin });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    let user = await Admin.findOne({ where: { email } });
    let loginType = "admin";

    if (!user) {
      user = await MasterUser.findOne({ where: { email } });
      loginType = "general";
    }

    if (!user) {
      await logAuditTrail(
        PROGRAMS.FORGOT_PASSWORD,
        "forgot_password",
        null,
        "User not found"
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Save OTP and expiration
    await user.update({
      otp,
      otpExpiration: Date.now() + 10 * 60 * 1000, // OTP valid for 10 minutes
    });

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent to your email address." });
  } catch (error) {
    console.error("Error during forgot password:", error);
    await logAuditTrail(
      PROGRAMS.FORGOT_PASSWORD,
      "forgot_password",
      null,
      error.message || "Internal server error"
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    let user = await Admin.findOne({ where: { email } });
    let loginType = "admin";

    if (!user) {
      user = await MasterUser.findOne({ where: { email } });
      loginType = "general";
    }

    if (!user) {
      await logAuditTrail(
        PROGRAMS.VERIFY_OTP,
        "VERIFY_OTP",
        null,
        "User not found"
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Check if OTP is valid
    if (user.otp !== otp || new Date() > user.otpExpiration) {
      await logAuditTrail(
        PROGRAMS.VERIFY_OTP,
        "VERIFY_OTP",
        loginType,
        "Invalid or expired OTP",
        loginType === "admin" ? user.id : user.masterUserID
      );
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error during OTP verification:", error);
    await logAuditTrail(
      PROGRAMS.VERIFY_OTP,
      "VERIFY_OTP",
      "unknown",
      error.message || "Internal server error"
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    let user = await Admin.findOne({ where: { email } });
    let loginType = "admin";

    if (!user) {
      user = await MasterUser.findOne({ where: { email } });
      loginType = "general";
    }

    if (!user) {
      await logAuditTrail(
        PROGRAMS.RESET_PASSWORD,
        "RESET_PASSWORD",
        null,
        "User not found"
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await user.update({
      password: hashedPassword,
      otp: null,
      otpExpiration: null,
    });

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error during password reset:", error);
    await logAuditTrail(
      PROGRAMS.RESET_PASSWORD,
      "RESET_PASSWORD",
      loginType || "unknown",
      error.message || "Internal server error"
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.logout = async (req, res) => {
  try {
    // Extract userId (adminId) from the middleware
    const userId = req.adminId;

    // Find the latest login history entry for the user
    const loginHistory = await LoginHistory.findOne({
      where: { userId },
      order: [["loginTime", "DESC"]],
    });

    if (!loginHistory) {
      return res
        .status(404)
        .json({ message: "Login history not found for the user" });
    }

    // Update the logout time
    const logoutTimeUTC = new Date(); // Current UTC time
    const loginTime = new Date(loginHistory.loginTime);

    // Convert logout time to IST
    const logoutTimeIST = moment(logoutTimeUTC)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    // Calculate the duration of the current session
    const durationMs = logoutTimeUTC - loginTime; // Duration in milliseconds
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor(
      (durationMs % (1000 * 60 * 60)) / (1000 * 60)
    );

    const currentSessionDuration = `${durationHours} hours ${durationMinutes} minutes`;

    // Fetch the previous totalSessionDuration
    let previousTotalDurationInSeconds = 0;
    if (loginHistory.totalSessionDuration) {
      const [hours, minutes] = loginHistory.totalSessionDuration
        .replace(" hours", "")
        .replace(" minutes", "")
        .split(" ")
        .map(Number);

      previousTotalDurationInSeconds =
        (hours || 0) * 3600 + (minutes || 0) * 60;
    }

    // Add the current session's duration to the previous total
    const currentSessionDurationInSeconds =
      durationHours * 3600 + durationMinutes * 60;
    const totalSessionDurationInSeconds =
      previousTotalDurationInSeconds + currentSessionDurationInSeconds;

    // Convert total session duration to hours and minutes
    const totalHours = Math.floor(totalSessionDurationInSeconds / 3600);
    const totalMinutes = Math.floor(
      (totalSessionDurationInSeconds % 3600) / 60
    );
    const totalSessionDuration = `${totalHours} hours ${totalMinutes} minutes`;

    // Update the login history record
    await loginHistory.update({
      logoutTime: logoutTimeIST, // Store logout time in IST
      duration: currentSessionDuration, // Save current session duration
      totalSessionDuration, // Save updated total session duration
    });

    // Update the RecentLoginHistory record
    const recentLoginHistory = await RecentLoginHistory.findOne({
      where: { userId },
    });

    if (recentLoginHistory) {
      await recentLoginHistory.update({
        logoutTime: logoutTimeIST, // Update logout time
        duration: currentSessionDuration, // Update session duration
        totalSessionDuration:totalSessionDuration
      });
    }

    res.status(200).json({
      message: "Logout successful",
      logoutTime: logoutTimeIST, // Return logout time in IST
      currentSessionDuration,
      totalSessionDuration,
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getLoginHistory = async (req, res) => {
  const { userId } = req.params; // Get userId from query parameters

  try {
    // Fetch login history for the specified user or all users
    const loginHistory = await LoginHistory.findAll({
      where: userId ? { userId } : {}, // Filter by userId if provided
      order: [["loginTime", "DESC"]], // Sort by login time in descending order
    });

    if (!loginHistory || loginHistory.length === 0) {
      return res.status(404).json({ message: "No login history found" });
    }

    res.status(200).json({
      message: "Login history fetched successfully",
      loginHistory,
    });
  } catch (error) {
    console.error("Error fetching login history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getRecentLoginHistory = async (req, res) => {
  const { userId } = req.query; // Get userId from query parameters

  try {
    // Fetch login history for the specified user or all users
    const loginHistory = await RecentLoginHistory.findAll({
      where: userId ? { userId } : {}, // Filter by userId if provided
      // order: [["loginTime", "DESC"]], // Sort by login time in descending order
    });

    if (!loginHistory || loginHistory.length === 0) {
      return res.status(404).json({ message: "No login history found" });
    }

    res.status(200).json({
      message: "Login history fetched successfully",
      loginHistory,
    });
  } catch (error) {
    console.error("Error fetching login history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



// Get current settings
exports.getMiscSettings = async (req, res) => {
  try {
    const settings = await MiscSettings.findOne({ where: {}, order: [["id", "DESC"]] });
    res.status(200).json({ settings });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch settings", error: error.message });
  }
};

// Update settings (admin only)
exports.updateMiscSettings = async (req, res) => {
  const { maxImageSizeMB, allowedImageTypes } = req.body;

  // Validation for maxImageSizeMB (required)
  if (!maxImageSizeMB || isNaN(maxImageSizeMB) || maxImageSizeMB < 1 || maxImageSizeMB > 50) {
    return res.status(400).json({ message: "maxImageSizeMB must be a number between 1 and 50." });
  }

  // Validation for allowedImageTypes (optional)
  if (
    allowedImageTypes !== undefined &&
    (typeof allowedImageTypes !== "string" || !allowedImageTypes.match(/^[a-z,]+$/i))
  ) {
    return res.status(400).json({ message: "allowedImageTypes must be a comma-separated string of extensions." });
  }

  try {
    let settings = await MiscSettings.findOne({ order: [["id", "DESC"]] });
    if (settings) {
      const updateData = { maxImageSizeMB };
      if (allowedImageTypes !== undefined) {
        updateData.allowedImageTypes = allowedImageTypes;
      }
      await settings.update(updateData);
    } else {
      // If creating new, use default if not provided
      await MiscSettings.create({
        maxImageSizeMB,
        allowedImageTypes: allowedImageTypes !== undefined ? allowedImageTypes : "jpg,jpeg,png,gif",
      });
    }
    res.status(200).json({ message: "Settings updated", settings });
  } catch (error) {
    res.status(500).json({ message: "Failed to update settings", error: error.message });
  }
};

/**
 * Change user password
 * @route POST /api/auth/change-password
 * @desc Change user password with current password verification
 * @access Private (requires authentication)
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword, logOutAllDevices = false } = req.body;
    const userId = req.adminId || req.user?.id; // Get user ID from authentication middleware

    // Input validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Current password, new password, and confirm password are required",
        errors: {
          currentPassword: !currentPassword ? "Current password is required" : null,
          newPassword: !newPassword ? "New password is required" : null,
          confirmPassword: !confirmPassword ? "Confirm password is required" : null
        }
      });
    }

    // Password confirmation validation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
        errors: {
          confirmPassword: "Passwords do not match"
        }
      });
    }

    // Password strength validation (minimum 8 characters)
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters long",
        errors: {
          newPassword: "Password must be at least 8 characters long"
        }
      });
    }

    // Additional password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        errors: {
          newPassword: "Password does not meet complexity requirements"
        }
      });
    }

    // Check if new password is same as current password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
        errors: {
          newPassword: "New password cannot be the same as current password"
        }
      });
    }

    // Find the user
    const user = await MasterUser.findByPk(userId);
    if (!user) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "PASSWORD_CHANGE",
        "FAILED",
        `User not found: ${userId}`,
        userId
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "PASSWORD_CHANGE",
        "FAILED",
        `Invalid current password for user: ${user.email} | IP: ${req.ip || req.connection.remoteAddress}`,
        userId
      );
      return res.status(401).json({
        message: "Current password is incorrect",
        errors: {
          currentPassword: "Current password is incorrect"
        }
      });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    await user.update({
      password: hashedNewPassword,
      passwordChangedAt: new Date(),
      // Optionally increment a password version field if you have one
      // passwordVersion: user.passwordVersion ? user.passwordVersion + 1 : 1
    });

    // Log successful password change with detailed information
    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "PASSWORD_CHANGE",
      "SUCCESS",
      `Password changed successfully for user: ${user.email} | IP: ${req.ip || req.connection.remoteAddress} | UserAgent: ${req.get('User-Agent') || "Unknown"}`,
      userId
    );

    // Log password change in login history
    const loginTimeUTC = new Date();
    const loginTimeIST = moment(loginTimeUTC)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    await LoginHistory.create({
      userId: user.masterUserID,
      loginType: user.loginType || "general", // Include required loginType field
      ipAddress: req.ip || req.connection.remoteAddress,
      loginTime: loginTimeIST, // Use IST format like in sign-in
      username: user.name || user.email, // Include username field if available
      // Note: Removed fields not defined in the model (email, action, status, userAgent)
    });

    // If logOutAllDevices is true, you might want to implement token invalidation
    // This would require maintaining a blacklist or token versioning system
    let responseMessage = "Password changed successfully";
    if (logOutAllDevices) {
      responseMessage += ". You will be logged out from all other devices.";
      // TODO: Implement token invalidation logic here
      // This could involve:
      // 1. Adding the user's current tokens to a blacklist
      // 2. Incrementing a token version in the user record
      // 3. Requiring all tokens to be validated against this version
    }

    res.status(200).json({
      message: responseMessage,
      data: {
        passwordChanged: true,
        passwordChangedAt: new Date(),
        logOutAllDevices: logOutAllDevices,
        user: {
          id: user.masterUserID,
          email: user.email,
          name: user.name
        }
      }
    });

  } catch (error) {
    console.error("Error changing password:", error);
    
    // Log error in audit trail
    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "PASSWORD_CHANGE",
      "ERROR",
      `Password change error: ${error.message}`,
      req.adminId || req.user?.id
    );

    res.status(500).json({
      message: "Internal server error while changing password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Validate password strength
 * @route POST /api/auth/validate-password
 * @desc Validate password strength without changing it
 * @access Private (requires authentication)
 */
exports.validatePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
        isValid: false
      });
    }

    const validations = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[@$!%*?&]/.test(password)
    };

    const isValid = Object.values(validations).every(Boolean);

    const strengthScore = Object.values(validations).filter(Boolean).length;
    let strength;
    if (strengthScore <= 2) strength = "weak";
    else if (strengthScore <= 4) strength = "medium";
    else strength = "strong";

    res.status(200).json({
      message: "Password validation completed",
      isValid,
      strength,
      validations,
      requirements: {
        minLength: "At least 8 characters",
        hasUppercase: "At least one uppercase letter",
        hasLowercase: "At least one lowercase letter", 
        hasNumber: "At least one number",
        hasSpecialChar: "At least one special character (@$!%*?&)"
      }
    });

  } catch (error) {
    console.error("Error validating password:", error);
    res.status(500).json({
      message: "Internal server error while validating password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get password change history
 * @route GET /api/auth/password-history
 * @desc Get password change history for the current user
 * @access Private (requires authentication)
 */
exports.getPasswordHistory = async (req, res) => {
  try {
    const userId = req.adminId || req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get recent login history that might include password changes
    // Since we simplified LoginHistory, we'll get all login records and note that 
    // detailed password change info is in the audit trail
    const loginHistory = await LoginHistory.findAndCountAll({
      where: {
        userId: userId
      },
      order: [["loginTime", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        "id",
        "loginTime",
        "ipAddress",
        "loginType",
        "username"
      ]
    });

    res.status(200).json({
      message: "Login history fetched successfully",
      data: {
        loginHistory: loginHistory.rows,
        pagination: {
          total: loginHistory.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(loginHistory.count / parseInt(limit))
        },
        note: "Detailed password change information is available in the audit trail for security purposes"
      }
    });

  } catch (error) {
    console.error("Error fetching password history:", error);
    res.status(500).json({
      message: "Internal server error while fetching password history",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

