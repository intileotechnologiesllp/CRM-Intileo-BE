const adminService = require("../../services/adminServices.js");
const LoginHistory = require("../../models/loginHistoryModel.js");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Admin = require("../../models/adminModel.js");
const MasterUser = require("../../models/masterUserModel.js"); // Import MasterUser model
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Import the audit trail utility
const PROGRAMS = require("../../utils/programConstants");

exports.signIn = async (req, res) => {
  const { email, password, longitude, latitude, ipAddress, loginType } =
    req.body;

  try {
    // Validate loginType
    const loginType = "admin";
    if (!["admin", "general", "master"].includes(loginType)) {
      return res.status(400).json({
        message: "Invalid login type. Must be 'admin', 'general', or 'master'.",
      });
    }

    // Authenticate the user
    const admin = await adminService.signIn(email, password);
    console.log(loginType);
    
    if (!admin) {
      // Log failed sign-in attempt
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION, // Program ID for authentication
        "SIGN_IN",
        "Invalid email" ,// Error description
        null
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      // Log failed sign-in attempt
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION, // Program ID for authentication
        "SIGN_IN",
        loginType, // User ID
        "Invalid password",// Error description
        admin.id,
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }
    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, loginType },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Get the current UTC time
    const loginTimeUTC = new Date();

    // Convert login time to IST
    const loginTimeIST = moment(loginTimeUTC)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    // Log the login history
    await LoginHistory.create({
      userId: admin.id,
      loginType, // Include the login type
      ipAddress: ipAddress || null,
      longitude: longitude || null,
      latitude: latitude || null,
      loginTime: loginTimeIST,
    });

    // Log successful sign-in attempt in the audit trail
    // await logAuditTrail("Admin", "SIGN_IN", admin.id, email, {
    //   status: "SUCCESS",
    //   loginTime: loginTimeIST,
    // });

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION, // Program ID for authentication
      "SIGN_IN",
      loginType,
      null, // No error for successful sign-in
      admin.id
    );

    res.status(200).json({ message: "Sign-in successful", token });
  } catch (error) {
    console.error("Error during admin sign-in:", error);

    // Log failed sign-in attempt in the audit trail
    // await logAuditTrail("Admin", "SIGN_IN", null, email, {
    //   status: "FAILED",
    //   reason: error.message || "Internal server error",
    // });

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION, // Program ID for authentication
      "SIGN_IN",
      null, // No user ID for failed sign-in
      error.message || "Internal server error", // Error description
      null
    );

    res.status(401).json({ message: error.message });
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
    // Check if the admin exists
    const admin = await adminService.findAdminByEmail(email);
    if (!admin) {
      // await logAuditTrail(
      //   PROGRAMS.FORGOT_PASSWORD, // Program ID for authentication
      //   "forgot_password",
      //   null, // No user ID for failed sign-in
      //   "user not found"  // Error description
      // );
      return res.status(404).json({ message: "Admin not found" });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    await adminService.saveOtp(admin.id, otp);

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail", // Use your email service provider
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    // await logAuditTrail(
    //   PROGRAMS.FORGOT_PASSWORD, // Program ID for authentication
    //   "forgot_password",
    //   admin.id, // No user ID for failed sign-in
    //   null      // Error description
    // );
    res.status(200).json({ message: "OTP sent to your email address." });
  } catch (error) {
    console.error("Error during forgot password:", error);
    // await logAuditTrail(
    //   PROGRAMS.FORGOT_PASSWORD, // Program ID for authentication
    //   "forgot_password",
    //      null, // No user ID for failed sign-in
    //      error.message ||  "Internal server error"     // Error description
    // );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const admin = await adminService.findAdminByEmail(email);
    if (!admin) {
      // await logAuditTrail(
      //   PROGRAMS.VERIFY_OTP, // Program ID for authentication
      //   "VERIFY_OTP",
      //   null, // No user ID for failed sign-in
      //   "user not found" // Error description
      // );
      return res.status(404).json({ message: "Admin not found" });
    }

    // Check if OTP is valid
    if (admin.otp !== otp || new Date() > admin.otpExpiration) {
      // await logAuditTrail(
      //   PROGRAMS.VERIFY_OTP, // Program ID for authentication
      //   "VERIFY_OTP",
      //   null, // No user ID for failed sign-in
      //   "Invalid or expired OTP" // Error description
      // );
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // await logAuditTrail(
    //   PROGRAMS.VERIFY_OTP, // Program ID for authentication
    //   "VERIFY_OTP",
    //   admin.id, // No user ID for failed sign-in
    //   null      // Error description
    // );

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const admin = await adminService.findAdminByEmail(email);
    if (!admin) {
      // await logAuditTrail(
      //   PROGRAMS.RESET_PASSWORD, // Program ID for authentication
      //   "RESET_PASSWORD",
      //   null, // No user ID for failed sign-in
      //   "user not found" // Error description
      // );
      return res.status(404).json({ message: "Admin not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await Admin.update(
      { password: hashedPassword, otp: null, otpExpiration: null },
      { where: { email } }
    );
    // await logAuditTrail(
    //   PROGRAMS.RESET_PASSWORD, // Program ID for authentication
    //   "RESET_PASSWORD",
    //   admin.id, // No user ID for failed sign-in
    //   null      // Error description
    // );
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error during password reset:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create a master user
exports.createMasterUser = async (req, res) => {
  const { name, email, designation, password, department } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the master user
    const masterUser = await MasterUser.create({
      name,
      email,
      designation,
      password: hashedPassword,
      department,
    });

    res
      .status(201)
      .json({ message: "Master user created successfully", masterUser });
  } catch (error) {
    console.error("Error creating master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Edit a master user
exports.editMasterUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, designation, password, department } = req.body;

  try {
    const masterUser = await MasterUser.findByPk(id);
    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    // Hash the password if it is being updated
    const updatedData = {
      name,
      email,
      designation,
      department,
    };

    if (password) {
      updatedData.password = await bcrypt.hash(password, 10);
    }

    await masterUser.update(updatedData);

    res
      .status(200)
      .json({ message: "Master user updated successfully", masterUser });
  } catch (error) {
    console.error("Error editing master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a master user
exports.deleteMasterUser = async (req, res) => {
  const { id } = req.params;

  try {
    const masterUser = await MasterUser.findByPk(id);
    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    await masterUser.destroy();
    res.status(200).json({ message: "Master user deleted successfully" });
  } catch (error) {
    console.error("Error deleting master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Show all master users
exports.getAllMasterUsers = async (req, res) => {
  try {
    const masterUsers = await MasterUser.findAll();
    res.status(200).json({ masterUsers });
  } catch (error) {
    console.error("Error fetching master users:", error);
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
