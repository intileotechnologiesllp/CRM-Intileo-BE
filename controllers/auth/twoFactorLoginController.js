const MasterUser = require("../../models/master/masterUserModel");
const twoFactorService = require("../../services/twoFactorService");
const jwt = require("jsonwebtoken");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const LoginHistory = require("../../models/reports/loginHistoryModel");
const RecentLoginHistory = require("../../models/reports/recentLoginHistoryModel");
const moment = require("moment-timezone");
const GroupVisibility = require("../../models/admin/groupVisibilityModel");

/**
 * Verify 2FA token during login
 * POST /api/auth/2fa/verify-login
 * Body: { userId, token, isBackupCode: false, sessionData: {...} }
 */
exports.verify2FALogin = async (req, res) => {
  try {
    const { userId, token, isBackupCode = false, sessionData } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ message: "User ID and token are required" });
    }

    const user = await MasterUser.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this user" });
    }

    let isValid = false;
    let backupCodeUsed = false;

    // Verify backup code or TOTP token
    if (isBackupCode) {
      const result = twoFactorService.verifyBackupCode(token, user.twoFactorBackupCodes);
      isValid = result.valid;

      if (isValid) {
        backupCodeUsed = true;
        // Update remaining backup codes
        if (result.remainingCodes.length === 0) {
          user.twoFactorBackupCodes = null;
        } else {
          user.twoFactorBackupCodes = twoFactorService.encrypt(
            JSON.stringify(result.remainingCodes)
          );
        }
        await user.save();

        await logAuditTrail(
          PROGRAMS.AUTHENTICATION,
          "2FA_BACKUP_CODE_USED",
          `Backup code used. ${result.remainingCodes.length} codes remaining`,
          userId
        );
      }
    } else {
      // Verify TOTP token
      isValid = twoFactorService.verifyToken(token, user.twoFactorSecret, 1);
    }

    if (!isValid) {
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION,
        "2FA_LOGIN_FAILED",
        isBackupCode ? "Invalid backup code" : "Invalid TOTP token",
        userId
      );
      return res.status(401).json({ 
        message: "Invalid verification code. Please try again." 
      });
    }

    // 2FA verification successful - complete login
    const { 
      longitude, 
      latitude, 
      ipAddress, 
      systemInfo, 
      device 
    } = sessionData;

    const locationInfo = systemInfo?.approximateLocation;
    const loginTimeUTC = new Date();
    const loginTimeIST = moment(loginTimeUTC)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    // Fetch the latest login history for the user
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

      previousTotalDurationInSeconds =
        (hours || 0) * 3600 + (minutes || 0) * 60;
    }

    const currentSessionDurationInSeconds = 0;
    const totalSessionDurationInSeconds =
      previousTotalDurationInSeconds + currentSessionDurationInSeconds;

    const totalHours = Math.floor(totalSessionDurationInSeconds / 3600);
    const totalMinutes = Math.floor(
      (totalSessionDurationInSeconds % 3600) / 60
    );
    const totalSessionDuration = `${totalHours} hours ${totalMinutes} minutes`;

    // Save login history
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
      location: `${locationInfo?.city}, ${locationInfo?.country}` || null
    });

    // Generate JWT token
    const jwtToken = jwt.sign(
      {
        id: user.masterUserID,
        email: user.email,
        loginType: user.loginType,
        sessionId: newSession.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Update recent login history
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

    // Fetch user's groups
    const allGroups = await GroupVisibility.findAll({
      where: { isActive: true },
      include: [{
        model: MasterUser,
        as: 'creator',
        attributes: ['masterUserID', 'name', 'email']
      }]
    });

    const userGroups = allGroups.filter(group => {
      const memberIdsRaw = group.memberIds;
      let groupUserIds = [];

      if (Array.isArray(memberIdsRaw)) {
        groupUserIds = memberIdsRaw.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      } else if (typeof memberIdsRaw === 'string' && memberIdsRaw.trim() !== '') {
        groupUserIds = memberIdsRaw.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      }

      return groupUserIds.includes(parseInt(user.masterUserID, 10));
    });

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
      group: group.group,
      createdBy: group.createdBy,
      creator: group.creator ? {
        masterUserID: group.creator.masterUserID,
        firstName: group.creator.name,
        email: group.creator.email
      } : null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    const groupIds = formattedGroups.map(group => group.groupId);

    await logAuditTrail(
      PROGRAMS.AUTHENTICATION,
      "2FA_LOGIN_SUCCESS",
      backupCodeUsed ? "Login with backup code" : "Login with TOTP",
      userId
    );

    res.status(200).json({
      message: `${user.loginType === "admin" ? "Admin" : "General User"} sign-in successful`,
      token: jwtToken,
      totalSessionDuration,
      userGroups: formattedGroups,
      groupIds: groupIds,
      user: {
        id: user.masterUserID,
        email: user.email,
        name: user.name,
        loginType: user.loginType
      },
      twoFactorVerified: true,
      backupCodeUsed: backupCodeUsed,
      remainingBackupCodes: backupCodeUsed 
        ? twoFactorService.getRemainingBackupCodesCount(user.twoFactorBackupCodes)
        : undefined
    });
  } catch (error) {
    console.error("2FA Login Verification Error:", error);
    res.status(500).json({ 
      message: "Failed to verify 2FA", 
      error: error.message 
    });
  }
};

module.exports = exports;
