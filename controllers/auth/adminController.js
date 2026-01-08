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
const GroupVisibility = require("../../models/admin/groupVisibilityModel.js");
const { google } = require("googleapis");
const DatabaseConnectionManager = require("../../config/dbConnectionManager.js");
const { getClientDbConnection } = require("../../config/db");


exports.registerLoginUser = async (req, res) => {
  const {
    name,
    email,
    password,
    organizationName
  } = req.body;

  try {
    // Calculate dates based on current date
    const currentDate = new Date();
    
    // Start date = current date
    const startDate = currentDate;
    
    // End date = start date + 30 days
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);
    
    // Actual end date = start date + 30 days (same as end date)
    const actualEndDate = new Date(startDate);
    actualEndDate.setDate(actualEndDate.getDate() + 30);

    // Prepare data for third-party API
    const thirdPartyData = {
      name: name,
      email: email,
      password: password,
      organizationName: organizationName,
      planId: 4,
      startDate: startDate.toISOString(), // Convert to ISO string for API
      endDate: endDate.toISOString(), // Add end date
      actualEndDate: actualEndDate.toISOString(), // Add actual end date
    };

    // Call third-party API
    let thirdPartyResponse;
    try {
      thirdPartyResponse = await axios.post(
        `${process.env.FRONTEND_ADMIN_URL}/api/v1/public/clients/registerLoginClient`,
        thirdPartyData,
      );
    } catch (thirdPartyError) {
      console.error(
        "Third-party API error:",
        thirdPartyError.response?.data || thirdPartyError.message
      );

      // Return appropriate error message
      let errorMessage = "Failed to create client in third-party system";
      if (thirdPartyError.response?.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (thirdPartyError.response?.data?.message) {
        errorMessage = thirdPartyError.response.data.message;
      }

      return res.status(thirdPartyError.response?.status || 500).json({
        message: errorMessage,
      });
    }

    // Check if third-party API was successful
    if (!thirdPartyResponse.data.success) {
      return res.status(thirdPartyResponse.status || 400).json({
        message:
          thirdPartyResponse.data.message ||
          "Failed to create client in third-party system",
      });
    }

    // Extract data from third-party response
    const thirdPartyClient = thirdPartyResponse.data.data;

    // Send response
    res.status(201).json({
      message: `Client created successfully`,
      data: thirdPartyClient
    });
  } catch (error) {
    console.error("Error creating master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.signIn = async (req, res) => {
  const {
    email,
    password,
    systemInfo,
    device,
    longitude,
    latitude,
    ipAddress,
  } = req.body;

  try {
    // Step 1: Verify user in client database
    const verificationResult = await DatabaseConnectionManager.verifyUserInDatabase(email, password);
    const { user, creator, clientConfig, planDetails } = verificationResult;

    // Step 2: Get client database connection and models
    const clientConnection = await getClientDbConnection(clientConfig);
    const models = DatabaseConnectionManager.getAllModels(clientConnection);
    
    // Destructure models
    const {
      MasterUser,
      AuditTrail,
      GroupVisibility,
      LoginHistory,
      RecentLoginHistory,
    } = models;

    // Check if user is active
    if (!user.isActive) {
      await logAuditTrail(
        AuditTrail,
        "AUTHENTICATION",
        "SIGN_IN",
        user.loginType,
        "User account is deactivated",
        user.masterUserID
      );
      return res.status(403).json({
        success: false,
        message: "User account is deactivated",
      });
    }

    // Check if client is active
    if (!clientConfig.isActive) {
      return res.status(403).json({
        success: false,
        message: "Client account is deactivated",
      });
    }

    // Step 3: Check if 2FA is enabled
    const locationInfo = systemInfo?.approximateLocation;

    if (user.twoFactorEnabled) {
      await logAuditTrail(
        AuditTrail,
        "AUTHENTICATION",
        "SIGN_IN_2FA_REQUIRED",
        "Password verified, awaiting 2FA",
        user.masterUserID
      );

      return res.status(200).json({
        success: true,
        message: "2FA verification required",
        requiresTwoFactor: true,
        userId: user.masterUserID,
        email: user.email,
        sessionData: {
          systemInfo,
          device,
          longitude,
          latitude,
          ipAddress,
        },
      });
    }

    // Step 4: Login history and session tracking
    const loginTimeUTC = new Date();
    const loginTimeIST = moment(loginTimeUTC)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    // Fetch latest login history for the user
    const latestLoginHistory = await LoginHistory.findOne({
      where: { userId: user.masterUserID },
      order: [["loginTime", "DESC"]],
    });

    // Calculate total session duration
    let previousTotalDurationInSeconds = 0;
    if (latestLoginHistory && latestLoginHistory.totalSessionDuration) {
      const [hours, minutes] = latestLoginHistory.totalSessionDuration
        .replace(" hours", "")
        .replace(" minutes", "")
        .split(" ")
        .map(Number);

      previousTotalDurationInSeconds = (hours || 0) * 3600 + (minutes || 0) * 60;
    }

    const currentSessionDurationInSeconds = 0;
    const totalSessionDurationInSeconds = previousTotalDurationInSeconds + currentSessionDurationInSeconds;
    const totalHours = Math.floor(totalSessionDurationInSeconds / 3600);
    const totalMinutes = Math.floor((totalSessionDurationInSeconds % 3600) / 60);
    const totalSessionDuration = `${totalHours} hours ${totalMinutes} minutes`;

    // Save new login history
    const newSession = await LoginHistory.create({
      userId: user.masterUserID,
      loginType: user.loginType,
      ipAddress: ipAddress || null,
      longitude: locationInfo?.longitude || null,
      latitude: locationInfo?.latitude || null,
      loginTime: loginTimeIST,
      username: user.name,
      totalSessionDuration,
      isActive: true,
      device: device,
      location: `${locationInfo?.city}, ${locationInfo?.country}` || null,
    });

    // Update RecentLoginHistory
    await RecentLoginHistory.destroy({
      where: { userId: user.masterUserID },
    });

    await RecentLoginHistory.create({
      userId: user.masterUserID,
      loginType: user.loginType,
      ipAddress: ipAddress || null,
      longitude: longitude || null,
      latitude: latitude || null,
      loginTime: loginTimeIST,
      username: user.name,
      totalSessionDuration,
    });

    // Step 5: Fetch user's groups
    const allGroups = await GroupVisibility.findAll({
      where: { isActive: true },
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name", "email"],
        },
      ],
    });

    const userGroups = allGroups.filter((group) => {
      const memberIdsRaw = group.memberIds;
      let groupUserIds = [];

      if (Array.isArray(memberIdsRaw)) {
        groupUserIds = memberIdsRaw
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id));
      } else if (typeof memberIdsRaw === "string" && memberIdsRaw.trim() !== "") {
        groupUserIds = memberIdsRaw
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id));
      }

      return groupUserIds.includes(parseInt(user.masterUserID, 10));
    });

    const formattedGroups = userGroups.map((group) => ({
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
      group: group.group,
      createdBy: group.createdBy,
      creator: group.creator
        ? {
            masterUserID: group.creator.masterUserID,
            firstName: group.creator.name,
            email: group.creator.email,
          }
        : null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));

    const groupIds = formattedGroups.map((group) => group.groupId);

    // Step 6: Generate JWT token
    const token = jwt.sign(
      {
        id: user.masterUserID,
        email: user.email,
        loginType: user.loginType,
        sessionId: newSession.id,
        clientId: clientConfig.id,
        dbName: clientConfig.db_name,
        clientName: clientConfig.name,
        organizationName: clientConfig.organizationName,
        api_key: clientConfig.api_key,
        planId: clientConfig.planId,
        userType: user.userType,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Store connection in session or cache (optional)
    // if (req.session) {
    //   req.session.clientConnection = result.clientConnection;
    //   req.session.models = result.models;
    //   req.session.clientConfig = result.clientConfig;
    // }

    // Step 7: Prepare response
    const response = {
      success: true,
      statusCode: 200,
      message: `${user.loginType === "admin" ? "Admin" : "General User"} sign-in successful`,
      token,
      totalSessionDuration,
      userGroups: formattedGroups,
      groupIds: groupIds,
      user: {
        id: user.masterUserID,
        email: user.email,
        name: user.name,
        loginType: user.loginType,
        userType: user.userType,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      clientInfo: {
        clientId: clientConfig.id,
        clientName: clientConfig.name,
        organizationName: clientConfig.organizationName,
        dbName: clientConfig.db_name,
        isActive: clientConfig.isActive,
        paymentDone: clientConfig.paymentDone,
        isTrialExpired: clientConfig.isTrialExpired,
        trialPeriodDays: clientConfig.trialPeriodDays,
        startDate: clientConfig.startDate,
        ActualStartDate: clientConfig.ActualStartDate,
        ActualEndDate: clientConfig.ActualEndDate,
      },
      creator: {
        id: creator.masterUserID,
        email: creator.email,
        name: creator.name,
        userType: creator.userType,
      },
    };

    // Add plan details if available
    if (planDetails) {
      response.planDetails = {
        id: planDetails.id,
        name: planDetails.name,
        code: planDetails.code,
        description: planDetails.description,
        currency: planDetails.currency,
        unitAmount: planDetails.unitAmount,
        billingInterval: planDetails.billingInterval,
        trialPeriodDays: planDetails.trialPeriodDays,
        isActive: planDetails.isActive,
        features: planDetails.features,
      };
    }

    // Log successful sign-in
    await logAuditTrail(
      AuditTrail,
      "AUTHENTICATION",
      "SIGN_IN",
      user.loginType,
      "Sign-in successful",
      user.masterUserID
    );

    res.status(200).json(response);
  } catch (error) {
    console.error("Error during sign-in:", error);

    // Enhanced error handling
    let statusCode = 500;
    let message = "Internal server error";
    let errorType = "unknown";

    if (error.message.includes("Client not found")) {
      statusCode = 404;
      message = "Client not found";
      errorType = "CLIENT_NOT_FOUND";
    } else if (error.message.includes("User not found in client database")) {
      statusCode = 404;
      message = "User not found. Please use /connect-db API first.";
      errorType = "USER_NOT_FOUND";
    } else if (error.message.includes("Invalid password")) {
      statusCode = 401;
      message = "Invalid password";
      errorType = "INVALID_PASSWORD";
    } else if (error.message.includes("Database connection")) {
      statusCode = 503;
      message = "Database connection error";
      errorType = "DB_CONNECTION_ERROR";
    }

    // Note: Can't log to AuditTrail here since we don't have the model
    // You could log to central database or console

    res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// exports.signIn = async (req, res) => {
//   const {
//     Admin,
//     MasterUser,
//     AuditTrail,
//     History,
//     MiscSetting,
//     GroupVisibility,
//     LoginHistory,
//     RecentLoginHistory,
//   } = req.models;
//   const {
//     email,
//     password,
//     systemInfo,
//     device,
//     longitude,
//     latitude,
//     ipAddress,
//   } = req.body;

//   try {
//     // Step 1: Verify user in client database
//     const verificationResult =
//       await DatabaseConnectionManager.verifyUserInDatabase(email, password);
//     const { user, creator, clientConfig, planDetails } = verificationResult;

//     // Check if user is active
//     if (!user.isActive) {
//       await logAuditTrail(
//         AuditTrail,
//         PROGRAMS.AUTHENTICATION,
//         "SIGN_IN",
//         user.loginType,
//         "User account is deactivated",
//         user.masterUserID
//       );
//       return res.status(403).json({
//         success: false,
//         message: "User account is deactivated",
//       });
//     }

//     // Check if client is active
//     if (!clientConfig.isActive) {
//       return res.status(403).json({
//         success: false,
//         message: "Client account is deactivated",
//       });
//     }

//     // Step 2: Check if 2FA is enabled (from first function)
//     const locationInfo = systemInfo?.approximateLocation;

//     if (user.twoFactorEnabled) {
//       await logAuditTrail(
//         AuditTrail,
//         PROGRAMS.AUTHENTICATION,
//         "SIGN_IN_2FA_REQUIRED",
//         "Password verified, awaiting 2FA",
//         user.masterUserID
//       );

//       return res.status(200).json({
//         success: true,
//         message: "2FA verification required",
//         requiresTwoFactor: true,
//         userId: user.masterUserID,
//         email: user.email,
//         sessionData: {
//           systemInfo,
//           device,
//           longitude,
//           latitude,
//           ipAddress,
//         },
//       });
//     }

//     // Step 3: Login history and session tracking (from first function)
//     const loginTimeUTC = new Date();
//     const loginTimeIST = moment(loginTimeUTC)
//       .tz("Asia/Kolkata")
//       .format("YYYY-MM-DD HH:mm:ss");

//     // Fetch latest login history for the user
//     const latestLoginHistory = await LoginHistory.findOne({
//       where: { userId: user.masterUserID },
//       order: [["loginTime", "DESC"]],
//     });

//     // Calculate total session duration
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

//     const currentSessionDurationInSeconds = 0; // No logout yet for new session
//     const totalSessionDurationInSeconds =
//       previousTotalDurationInSeconds + currentSessionDurationInSeconds;
//     const totalHours = Math.floor(totalSessionDurationInSeconds / 3600);
//     const totalMinutes = Math.floor(
//       (totalSessionDurationInSeconds % 3600) / 60
//     );
//     const totalSessionDuration = `${totalHours} hours ${totalMinutes} minutes`;

//     // Save new login history
//     const newSession = await LoginHistory.create({
//       userId: user.masterUserID,
//       loginType: user.loginType,
//       ipAddress: ipAddress || null,
//       longitude: locationInfo?.longitude || null,
//       latitude: locationInfo?.latitude || null,
//       loginTime: loginTimeIST,
//       username: user.name,
//       totalSessionDuration,
//       isActive: true,
//       device: device,
//       location: `${locationInfo?.city}, ${locationInfo?.country}` || null,
//     });

//     // Update RecentLoginHistory
//     await RecentLoginHistory.destroy({
//       where: { userId: user.masterUserID },
//     });

//     await RecentLoginHistory.create({
//       userId: user.masterUserID,
//       loginType: user.loginType,
//       ipAddress: ipAddress || null,
//       longitude: longitude || null,
//       latitude: latitude || null,
//       loginTime: loginTimeIST,
//       username: user.name,
//       totalSessionDuration,
//     });

//     // Step 4: Fetch user's groups (from first function)
//     const allGroups = await GroupVisibility.findAll({
//       where: { isActive: true },
//       include: [
//         {
//           model: MasterUser,
//           as: "creator",
//           attributes: ["masterUserID", "name", "email"],
//         },
//       ],
//     });

//     const userGroups = allGroups.filter((group) => {
//       const memberIdsRaw = group.memberIds;
//       let groupUserIds = [];

//       if (Array.isArray(memberIdsRaw)) {
//         groupUserIds = memberIdsRaw
//           .map((id) => parseInt(id, 10))
//           .filter((id) => !isNaN(id));
//       } else if (
//         typeof memberIdsRaw === "string" &&
//         memberIdsRaw.trim() !== ""
//       ) {
//         groupUserIds = memberIdsRaw
//           .split(",")
//           .map((id) => parseInt(id.trim(), 10))
//           .filter((id) => !isNaN(id));
//       }

//       return groupUserIds.includes(parseInt(user.masterUserID, 10));
//     });

//     const formattedGroups = userGroups.map((group) => ({
//       groupId: group.groupId,
//       groupName: group.groupName,
//       description: group.description,
//       isDefault: group.isDefault,
//       isActive: group.isActive,
//       pipeline: group.pipeline,
//       lead: group.lead,
//       deal: group.deal,
//       person: group.person,
//       Organization: group.Organization,
//       group: group.group,
//       createdBy: group.createdBy,
//       creator: group.creator
//         ? {
//             masterUserID: group.creator.masterUserID,
//             firstName: group.creator.name,
//             email: group.creator.email,
//           }
//         : null,
//       createdAt: group.createdAt,
//       updatedAt: group.updatedAt,
//     }));

//     const groupIds = formattedGroups.map((group) => group.groupId);

//     // Step 5: Generate JWT token (combined from both)
//     const token = jwt.sign(
//       {
//         id: user.masterUserID,
//         email: user.email,
//         loginType: user.loginType,
//         sessionId: newSession.id, // Include session ID for tracking
//         clientId: clientConfig.id,
//         dbName: clientConfig.db_name,
//         clientName: clientConfig.name,
//         organizationName: clientConfig.organizationName,
//         api_key: clientConfig.api_key,
//         planId: clientConfig.planId,
//         userType: user.userType,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "30d" }
//     );

//     // Step 6: Prepare response
//     const response = {
//       success: true,
//       statusCode: 200,
//       message: `${
//         user.loginType === "admin" ? "Admin" : "General User"
//       } sign-in successful`,
//       token,
//       totalSessionDuration,
//       userGroups: formattedGroups,
//       groupIds: groupIds,
//       user: {
//         id: user.masterUserID,
//         email: user.email,
//         name: user.name,
//         loginType: user.loginType,
//         userType: user.userType,
//         twoFactorEnabled: user.twoFactorEnabled,
//       },
//       clientInfo: {
//         clientId: clientConfig.id,
//         clientName: clientConfig.name,
//         organizationName: clientConfig.organizationName,
//         dbName: clientConfig.db_name,
//         isActive: clientConfig.isActive,
//         paymentDone: clientConfig.paymentDone,
//         isTrialExpired: clientConfig.isTrialExpired,
//         trialPeriodDays: clientConfig.trialPeriodDays,
//         startDate: clientConfig.startDate,
//         ActualStartDate: clientConfig.ActualStartDate,
//         ActualEndDate: clientConfig.ActualEndDate,
//       },
//       creator: {
//         id: creator.masterUserID,
//         email: creator.email,
//         name: creator.name,
//         userType: creator.userType,
//       },
//     };

//     // Add plan details if available
//     if (planDetails) {
//       response.planDetails = {
//         id: planDetails.id,
//         name: planDetails.name,
//         code: planDetails.code,
//         description: planDetails.description,
//         currency: planDetails.currency,
//         unitAmount: planDetails.unitAmount,
//         billingInterval: planDetails.billingInterval,
//         trialPeriodDays: planDetails.trialPeriodDays,
//         isActive: planDetails.isActive,
//         features: planDetails.features,
//       };
//     }

//     // Log successful sign-in
//     await logAuditTrail(
//       AuditTrail,
//       PROGRAMS.AUTHENTICATION,
//       "SIGN_IN",
//       user.loginType,
//       "Sign-in successful",
//       user.masterUserID
//     );

//     res.status(200).json(response);
//   } catch (error) {
//     console.error("Error during sign-in:", error);

//     // Enhanced error handling
//     let statusCode = 500;
//     let message = "Internal server error";
//     let errorType = "unknown";

//     if (error.message.includes("Client not found")) {
//       statusCode = 404;
//       message = "Client not found";
//       errorType = "CLIENT_NOT_FOUND";
//     } else if (error.message.includes("User not found in client database")) {
//       statusCode = 404;
//       message = "User not found. Please use /connect-db API first.";
//       errorType = "USER_NOT_FOUND";
//     } else if (error.message.includes("Invalid password")) {
//       statusCode = 401;
//       message = "Invalid password";
//       errorType = "INVALID_PASSWORD";
//     } else if (error.message.includes("Database connection")) {
//       statusCode = 503;
//       message = "Database connection error";
//       errorType = "DB_CONNECTION_ERROR";
//     }

//     await logAuditTrail(
//       AuditTrail,
//       PROGRAMS.AUTHENTICATION,
//       "SIGN_IN",
//       errorType,
//       error.message || message
//     );

//     res.status(statusCode).json({
//       success: false,
//       statusCode,
//       message,
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

exports.createAdmin = async (req, res) => {
  const { Admin } = req.models;
  const { email, password } = req.body;

  try {
    const admin = await adminService.createAdmin(email, password, Admin);
    res.status(201).json({ message: "Admin created successfully", admin });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  const { Admin, MasterUser, AuditTrail } = req.models;
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
        AuditTrail,
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
      AuditTrail,
      PROGRAMS.FORGOT_PASSWORD,
      "forgot_password",
      null,
      error.message || "Internal server error"
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  const { Admin, MasterUser, AuditTrail } = req.models;
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
        AuditTrail,
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
        AuditTrail,
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
      AuditTrail,
      PROGRAMS.VERIFY_OTP,
      "VERIFY_OTP",
      "unknown",
      error.message || "Internal server error"
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { Admin, MasterUser, AuditTrail } = req.models;
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
        AuditTrail,
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
      AuditTrail,
      PROGRAMS.RESET_PASSWORD,
      "RESET_PASSWORD",
      loginType || "unknown",
      error.message || "Internal server error"
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.logout = async (req, res) => {
  const { Admin, MasterUser, AuditTrail, LoginHistory, RecentLoginHistory } =
    req.models;
  try {
    // Extract userId (adminId) and sessionId from the middleware
    const userId = req.adminId;
    const sessionId = req.sessionId;

    // Find the specific session from JWT token (preferred) or fall back to latest
    let loginHistory;
    if (sessionId) {
      loginHistory = await LoginHistory.findOne({
        where: {
          id: sessionId,
          userId: userId,
        },
      });
    }

    // Fallback to latest session if sessionId not found (backward compatibility)
    if (!loginHistory) {
      loginHistory = await LoginHistory.findOne({
        where: { userId },
        order: [["loginTime", "DESC"]],
      });
    }

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
      isActive: false,
    });

    // Update the RecentLoginHistory record
    const recentLoginHistory = await RecentLoginHistory.findOne({
      where: { userId },
    });

    if (recentLoginHistory) {
      await recentLoginHistory.update({
        logoutTime: logoutTimeIST, // Update logout time
        duration: currentSessionDuration, // Update session duration
        totalSessionDuration: totalSessionDuration,
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
  const { LoginHistory } = req.models;
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

exports.getAllLoginHistory = async (req, res) => {
  const { LoginHistory } = req.models;
  const { userId } = req.params; // Get userId from query parameters

  try {
    // Fetch login history for the specified user or all users
    const loginHistory = await LoginHistory.findAll({
      order: [["loginTime", "DESC"]], // Sort by login time in descending order
    });

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
  const { RecentLoginHistory } = req.models;
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
  const { MiscSetting } = req.models;
  try {
    const settings = await MiscSetting.findOne({
      where: {},
      order: [["id", "DESC"]],
    });
    res.status(200).json({ settings });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch settings", error: error.message });
  }
};

// Update settings (admin only)
exports.updateMiscSettings = async (req, res) => {
  const { MiscSetting } = req.models;
  const { maxImageSizeMB, allowedImageTypes } = req.body;

  // Validation for maxImageSizeMB (required)
  if (
    !maxImageSizeMB ||
    isNaN(maxImageSizeMB) ||
    maxImageSizeMB < 1 ||
    maxImageSizeMB > 50
  ) {
    return res
      .status(400)
      .json({ message: "maxImageSizeMB must be a number between 1 and 50." });
  }

  // Validation for allowedImageTypes (optional)
  if (
    allowedImageTypes !== undefined &&
    (typeof allowedImageTypes !== "string" ||
      !allowedImageTypes.match(/^[a-z,]+$/i))
  ) {
    return res
      .status(400)
      .json({
        message:
          "allowedImageTypes must be a comma-separated string of extensions.",
      });
  }

  try {
    let settings = await MiscSetting.findOne({ order: [["id", "DESC"]] });
    if (settings) {
      const updateData = { maxImageSizeMB };
      if (allowedImageTypes !== undefined) {
        updateData.allowedImageTypes = allowedImageTypes;
      }
      await settings.update(updateData);
    } else {
      // If creating new, use default if not provided
      await MiscSetting.create({
        maxImageSizeMB,
        allowedImageTypes:
          allowedImageTypes !== undefined
            ? allowedImageTypes
            : "jpg,jpeg,png,gif",
      });
    }
    res.status(200).json({ message: "Settings updated", settings });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update settings", error: error.message });
  }
};

/**
 * Change user password
 * @route POST /api/auth/change-password
 * @desc Change user password with current password verification
 * @access Private (requires authentication)
 */
exports.changePassword = async (req, res) => {
  const { Admin, MasterUser, AuditTrail, LoginHistory } = req.models;
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
      logOutAllDevices = false,
    } = req.body;
    const userId = req.adminId || req.user?.id; // Get user ID from authentication middleware

    // Input validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message:
          "Current password, new password, and confirm password are required",
        errors: {
          currentPassword: !currentPassword
            ? "Current password is required"
            : null,
          newPassword: !newPassword ? "New password is required" : null,
          confirmPassword: !confirmPassword
            ? "Confirm password is required"
            : null,
        },
      });
    }

    // Password confirmation validation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
        errors: {
          confirmPassword: "Passwords do not match",
        },
      });
    }

    // Password strength validation (minimum 8 characters)
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters long",
        errors: {
          newPassword: "Password must be at least 8 characters long",
        },
      });
    }

    // Additional password strength validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        errors: {
          newPassword: "Password does not meet complexity requirements",
        },
      });
    }

    // Check if new password is same as current password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
        errors: {
          newPassword: "New password cannot be the same as current password",
        },
      });
    }

    // Find the user
    const user = await MasterUser.findByPk(userId);
    if (!user) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.AUTHENTICATION,
        "PASSWORD_CHANGE",
        "FAILED",
        `User not found: ${userId}`,
        userId
      );
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.AUTHENTICATION,
        "PASSWORD_CHANGE",
        "FAILED",
        `Invalid current password for user: ${user.email} | IP: ${
          req.ip || req.connection.remoteAddress
        }`,
        userId
      );
      return res.status(401).json({
        message: "Current password is incorrect",
        errors: {
          currentPassword: "Current password is incorrect",
        },
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
      AuditTrail,
      PROGRAMS.AUTHENTICATION,
      "PASSWORD_CHANGE",
      "SUCCESS",
      `Password changed successfully for user: ${user.email} | IP: ${
        req.ip || req.connection.remoteAddress
      } | UserAgent: ${req.get("User-Agent") || "Unknown"}`,
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
          name: user.name,
        },
      },
    });
  } catch (error) {
    console.error("Error changing password:", error);

    // Log error in audit trail
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.AUTHENTICATION,
      "PASSWORD_CHANGE",
      "ERROR",
      `Password change error: ${error.message}`,
      req.adminId || req.user?.id
    );

    res.status(500).json({
      message: "Internal server error while changing password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
  const { Admin, MasterUser, AuditTrail } = req.models;
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
        isValid: false,
      });
    }

    const validations = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[@$!%*?&]/.test(password),
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
        hasSpecialChar: "At least one special character (@$!%*?&)",
      },
    });
  } catch (error) {
    console.error("Error validating password:", error);
    res.status(500).json({
      message: "Internal server error while validating password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
  const { LoginHistory } = req.models;
  try {
    const userId = req.adminId || req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get recent login history that might include password changes
    // Since we simplified LoginHistory, we'll get all login records and note that
    // detailed password change info is in the audit trail
    const loginHistory = await LoginHistory.findAndCountAll({
      where: {
        userId: userId,
      },
      order: [["loginTime", "DESC"]],
      limit: parseInt(limit),
      offset: offset,
      attributes: ["id", "loginTime", "ipAddress", "loginType", "username"],
    });

    res.status(200).json({
      message: "Login history fetched successfully",
      data: {
        loginHistory: loginHistory.rows,
        pagination: {
          total: loginHistory.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(loginHistory.count / parseInt(limit)),
        },
        note: "Detailed password change information is available in the audit trail for security purposes",
      },
    });
  } catch (error) {
    console.error("Error fetching password history:", error);
    res.status(500).json({
      message: "Internal server error while fetching password history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Google OAuth Login - Initiate
exports.googleAuthLogin = async (req, res) => {
  const { LoginHistory } = req.models;
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI // e.g., http://localhost:3000/api/auth/google/callback
    );

    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });

    res.json({
      success: true,
      authUrl: authUrl,
    });
  } catch (error) {
    console.error("Error generating Google auth URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate Google authentication URL",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Google OAuth Login - Callback
exports.googleAuthCallback = async (req, res) => {
  const { LoginHistory, MasterUser, AuditTrail, RecentLoginHistory } =
    req.models;
  // Google sends code as query parameter, but frontend can send as body
  const code = req.query.code || (req.body && req.body.code);
  const systemInfo = req.body && req.body.systemInfo;
  const device = req.body && req.body.device;
  const longitude = req.body && req.body.longitude;
  const latitude = req.body && req.body.latitude;
  const ipAddress = req.body && req.body.ipAddress;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Authorization code is required",
    });
  }

  const locationInfo = systemInfo?.approximateLocation;

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    const { data } = await oauth2.userinfo.get();
    const googleEmail = data.email;
    const googleName = data.name;

    if (!googleEmail) {
      return res.status(400).json({
        success: false,
        message: "Failed to retrieve email from Google",
      });
    }

    // Check if user exists in database
    let user = await MasterUser.findOne({ where: { email: googleEmail } });

    if (!user) {
      // User doesn't exist, create new user
      user = await MasterUser.create({
        email: googleEmail,
        name: googleName || googleEmail.split("@")[0],
        loginType: "google",
        isActive: true,
        // No password needed for Google OAuth users
        password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10), // Random password
      });

      const thirdPartyData = {
        name: googleName || googleEmail.split("@")[0],
        email: googleEmail,
        password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
        phone: null,
        userType: "USER", // Map to third-party's format
        isActive: true, // Map status to isActive
      };

      // Call third-party API
      let thirdPartyResponse;
      thirdPartyResponse = await axios.post(
        `${process.env.FRONTEND_ADMIN_URL}/api/v1/public/clients/create-client`,
        thirdPartyData,
        {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      await logAuditTrail(
        AuditTrail,
        PROGRAMS.AUTHENTICATION,
        "SIGN_IN",
        "google",
        "New user registered via Google OAuth",
        user.masterUserID
      );
    }

    // Check if user is active
    if (!user.isActive) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.AUTHENTICATION,
        "SIGN_IN",
        "google",
        "Inactive user attempted login",
        user.masterUserID
      );
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact administrator.",
      });
    }

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

    // Create new login history entry
    await LoginHistory.create({
      userId: user.masterUserID,
      name: user.name,
      email: user.email,
      loginTime: loginTimeIST,
      logoutTime: null,
      sessionDuration: null,
      totalSessionDuration: latestLoginHistory
        ? latestLoginHistory.totalSessionDuration
        : "0 hours 0 minutes",
      sessionDurationInSeconds: 0,
      totalSessionDurationInSeconds: previousTotalDurationInSeconds,
      device: device || null,
      location: locationInfo || null,
      latitude: latitude || null,
      longitude: longitude || null,
      ipAddress: ipAddress || null,
    });

    // Update recent login history
    const existingRecentLogin = await RecentLoginHistory.findOne({
      where: { userId: user.masterUserID },
    });

    if (existingRecentLogin) {
      await existingRecentLogin.update({
        name: user.name,
        email: user.email,
        loginTime: loginTimeIST,
        logoutTime: null,
        device: device || null,
        location: locationInfo || null,
        latitude: latitude || null,
        longitude: longitude || null,
        ipAddress: ipAddress || null,
      });
    } else {
      await RecentLoginHistory.create({
        userId: user.masterUserID,
        name: user.name,
        email: user.email,
        loginTime: loginTimeIST,
        logoutTime: null,
        device: device || null,
        location: locationInfo || null,
        latitude: latitude || null,
        longitude: longitude || null,
        ipAddress: ipAddress || null,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.masterUserID,
        email: user.email,
        loginType: "google",
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.AUTHENTICATION,
      "SIGN_IN",
      "google",
      "User signed in successfully via Google OAuth",
      user.masterUserID
    );

    // If this is a GET request (direct from Google), redirect to frontend with token
    if (req.method === "GET") {
      // Redirect to a success page with token and user data
      // Use localhost for development, or FRONTEND_URL for production
      const frontendUrl =
        process.env.NODE_ENV === "production"
          ? process.env.FRONTEND_URL || "http://localhost:3056"
          : "http://localhost:3056";
      const redirectUrl = `${frontendUrl}/google-login-success.html?token=${encodeURIComponent(
        token
      )}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(
        user.email
      )}`;
      return res.redirect(redirectUrl);
    }

    // If POST request (from frontend), return JSON
    res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        masterUserID: user.masterUserID,
        name: user.name,
        email: user.email,
        loginType: "google",
      },
    });
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.AUTHENTICATION,
      "SIGN_IN",
      "google",
      `Google OAuth error: ${error.message}`,
      null
    );

    // If GET request, redirect to error page
    if (req.method === "GET") {
      // Use localhost for development, or FRONTEND_URL for production
      const frontendUrl =
        process.env.NODE_ENV === "production"
          ? process.env.FRONTEND_URL || "http://localhost:3056"
          : "http://localhost:3056";
      const redirectUrl = `${frontendUrl}/google-login-error.html?error=${encodeURIComponent(
        error.message
      )}`;
      return res.redirect(redirectUrl);
    }

    res.status(500).json({
      success: false,
      message: "Google authentication failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
