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
      { expiresIn: "1d" }
    );

    // Get the current UTC time
    const loginTimeUTC = new Date();

    // Convert login time to IST
    const loginTimeIST = moment(loginTimeUTC)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    // Fetch all login history for the user
    const loginHistory = await LoginHistory.findAll({
      where: { userId: user.masterUserID },
      attributes: ["loginTime", "logoutTime"],
    });

    // Calculate total session duration
    let totalSessionDurationInSeconds = 0;
    loginHistory.forEach((session) => {
      if (session.logoutTime) {
        const duration = moment(session.logoutTime).diff(
          moment(session.loginTime),
          "seconds"
        );
        totalSessionDurationInSeconds += duration;
      }
    });

    // Convert total session duration to hours and minutes
    const hours = Math.floor(totalSessionDurationInSeconds / 3600);
    const minutes = Math.floor((totalSessionDurationInSeconds % 3600) / 60);
    const formattedDuration = `${hours > 0 ? `${hours} hours ` : ""}${
      minutes > 0 ? `${minutes} minutes` : ""
    }`.trim();

    // Log the login history with totalSessionDuration
    await LoginHistory.create({
      userId: user.masterUserID,
      loginType: user.loginType,
      ipAddress: ipAddress || null,
      longitude: longitude || null,
      latitude: latitude || null,
      loginTime: loginTimeIST,
      username: user.name,
      totalSessionDuration: formattedDuration, // Save totalSessionDuration
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
      totalSessionDuration: formattedDuration, // Save totalSessionDuration
    });

    // Return the response with totalSessionDuration
    res.status(200).json({
      message: `${
        user.loginType === "admin" ? "Admin" : "General User"
      } sign-in successful`,
      token,
      totalSessionDuration: formattedDuration,
    });
  } catch (error) {
    console.error("Error during sign-in:", error);

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "SIGN_IN",
      "unknown",
      error.message || "Internal server error",
      null
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

    // Calculate the duration
    const durationMs = logoutTimeUTC - loginTime; // Duration in milliseconds
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor(
      (durationMs % (1000 * 60 * 60)) / (1000 * 60)
    );

    const duration = `${durationHours} hours ${durationMinutes} minutes`;

    // Update the login history record
    await loginHistory.update({
      logoutTime: logoutTimeIST, // Store logout time in IST
      duration,
    });

    res.status(200).json({
      message: "Logout successful",
      logoutTime: logoutTimeIST, // Return logout time in IST
      duration,
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getLoginHistory = async (req, res) => {
  const { userId } = req.query; // Get userId from query parameters

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
