const jwt = require("jsonwebtoken");
const PROGRAMS=require("../utils/programConstants");
const logAuditTrail = require("../utils/auditTrailLogger");
const LoginHistory = require("../models/reports/loginHistoryModel");

exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  console.log("Authorization Header:", authHeader); // Debug log

  if (!authHeader) {
    // await logAuditTrail(
    //   PROGRAMS.JWT_VERIFICATION, // Program ID for authentication
    //   "TOKEN_AUTHORIZATION", // Mode
    //   // email, // Email of the user attempting to sign in
    //   null,
    //   // Error description
    //   "No token provided"
    // );
    return res.status(403).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log("Extracted Token:", token); // Debug log

  if (!token) {
    // await logAuditTrail(
    //   PROGRAMS.JWT_VERIFICATION, // Program ID for authentication
    //   "TOKEN_AUTHORIZATION", // Mode
    //   // email, // Email of the user attempting to sign in
    //   null,
    //   // Error description
    //   "No token provided"
    // );
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async(err, decoded) => {
    if (err) {
      console.error("JWT Verification Error:", err); // Debug log
      // await logAuditTrail(
      //   PROGRAMS.JWT_VERIFICATION, // Program ID for authentication
      //   "TOKEN_AUTHORIZATION", // Mode
      //   // email, // Email of the user attempting to sign in
      //   null,
      //   // Error description
      //   "Unauthorized"
      // );
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.adminId = decoded.id; // User ID from the token
    req.email = decoded.email; // User email from the token
    req.role = decoded.loginType; // Attach admin ID to the request object
    req.sessionId = decoded.sessionId; // Session ID from token for device management
    console.log("Decoded Token:", decoded); // Debug log

    // Validate session is still active (for device management)
    if (decoded.sessionId) {
      try {
        const session = await LoginHistory.findOne({
          where: {
            id: decoded.sessionId,
            userId: decoded.id,
          },
        });

        // If session doesn't exist or is inactive, reject the request
        if (!session) {
          console.log(`Session ${decoded.sessionId} not found for user ${decoded.id}`);
          return res.status(401).json({ 
            message: "Session not found. Please login again.",
            sessionExpired: true,
          });
        }

        if (!session.isActive || session.logoutTime) {
          console.log(`Session ${decoded.sessionId} is inactive for user ${decoded.id}`);
          return res.status(401).json({ 
            message: "Your session has been logged out from another device. Please login again.",
            sessionExpired: true,
            loggedOutFromAnotherDevice: true,
          });
        }

        // Session is valid, continue
        next();
      } catch (sessionError) {
        console.error("Session validation error:", sessionError);
        // If there's an error checking session, allow the request but log it
        // This prevents breaking existing functionality
        next();
      }
    } else {
      // Old tokens without sessionId - allow them for backward compatibility
      // TODO: After all users re-login, make sessionId mandatory
      next();
    }
  });
};
