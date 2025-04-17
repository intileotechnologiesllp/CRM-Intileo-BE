const jwt = require("jsonwebtoken");
const PROGRAMS=require("../utils/programConstants");
const logAuditTrail = require("../utils/auditTrailLogger")
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
    req.role = decoded.loginType;; // Attach admin ID to the request object
    console.log("Decoded Token:", decoded); // Debug log
    next();
  });
};
