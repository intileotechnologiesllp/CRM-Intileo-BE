const jwt = require("jsonwebtoken");
const PROGRAMS = require("../utils/programConstants");
const logAuditTrail = require("../utils/auditTrailLogger");
const DatabaseConnectionManager = require("../config/dbConnectionManager");
const requirePatcher = require("../utils/requirePatcher");
const modelRegistry = require("../utils/modelRegistry");

exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  console.log("Authorization Header:", authHeader);

  if (!authHeader) {
    await logAuditTrail(
      PROGRAMS.JWT_VERIFICATION,
      "TOKEN_AUTHORIZATION",
      null,
      "No token provided"
    );
    return res.status(403).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log("Extracted Token:", token);

  if (!token) {
    await logAuditTrail(
      PROGRAMS.JWT_VERIFICATION,
      "TOKEN_AUTHORIZATION",
      null,
      "No token provided"
    );
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error("JWT Verification Error:", err);
      await logAuditTrail(
        PROGRAMS.JWT_VERIFICATION,
        "TOKEN_AUTHORIZATION",
        null,
        "Unauthorized - Invalid token"
      );
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Store user info in request
    req.adminId = decoded.id;
    req.email = decoded.email;
    req.role = decoded.loginType;
    req.sessionId = decoded.sessionId;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      loginType: decoded.loginType,
      clientId: decoded.clientId,
      dbName: decoded.dbName,
      clientName: decoded.clientName,
      organizationName: decoded.organizationName
    };
    req.masterUserID = decoded.id; // For backward compatibility
    
    console.log("Decoded Token:", decoded);

    try {
      // Get client connection for this request
      const clientSequelize = await DatabaseConnectionManager.getClientConnectionForRequest(
        decoded.clientId,
        decoded.dbName
      );

      // Store connection in request
      req.clientSequelize = clientSequelize;

      // Check if models are initialized for this client
      if (!modelRegistry.isInitializedForClient(decoded.clientId)) {
        // Initialize models
        await modelRegistry.initModelsForClient(decoded.clientId, clientSequelize);
      }

      // Activate require patch for this client
      requirePatcher.activateForClient(decoded.clientId);

      // Store cleanup function
      req._restoreRequire = () => {
        requirePatcher.deactivateForClient(decoded.clientId);
      };

      // Ensure cleanup happens after response
      const originalEnd = res.end;
      res.end = function(...args) {
        if (req._restoreRequire) {
          req._restoreRequire();
        }
        return originalEnd.apply(this, args);
      };

      // Validate session is still active (for device management)
      if (decoded.sessionId) {
        try {
          // Now models will use the correct database connection
          const LoginHistory = require("../models/reports/loginHistoryModel");
          
          const session = await LoginHistory.findOne({
            where: {
              id: decoded.sessionId,
              userId: decoded.id,
            },
          });

          // If session doesn't exist or is inactive, reject the request
          if (!session) {
            console.log(`Session ${decoded.sessionId} not found for user ${decoded.id}`);
            
            // Clean up require patch before returning error
            if (req._restoreRequire) {
              req._restoreRequire();
            }
            
            await logAuditTrail(
              PROGRAMS.JWT_VERIFICATION,
              "TOKEN_AUTHORIZATION",
              decoded.email,
              "Session not found"
            );
            
            return res.status(401).json({ 
              message: "Session not found. Please login again.",
              sessionExpired: true,
            });
          }

          if (!session.isActive || session.logoutTime) {
            console.log(`Session ${decoded.sessionId} is inactive for user ${decoded.id}`);
            
            // Clean up require patch before returning error
            if (req._restoreRequire) {
              req._restoreRequire();
            }
            
            await logAuditTrail(
              PROGRAMS.JWT_VERIFICATION,
              "TOKEN_AUTHORIZATION",
              decoded.email,
              "Session logged out from another device"
            );
            
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
          
          // Log the error but allow the request for backward compatibility
          await logAuditTrail(
            PROGRAMS.JWT_VERIFICATION,
            "TOKEN_AUTHORIZATION",
            decoded.email,
            `Session validation error: ${sessionError.message}`
          );
          
          // Continue even if session validation fails (backward compatibility)
          next();
        }
      } else {
        // Old tokens without sessionId - allow them for backward compatibility
        console.warn("Old token without sessionId detected for user:", decoded.email);
        await logAuditTrail(
          PROGRAMS.JWT_VERIFICATION,
          "TOKEN_AUTHORIZATION",
          decoded.email,
          "Old token without sessionId used"
        );
        
        // TODO: After all users re-login, make sessionId mandatory
        next();
      }

    } catch (connectionError) {
      console.error("Database connection error in verifyToken:", connectionError);
      
      // Clean up require patch if it was activated
      if (req._restoreRequire) {
        req._restoreRequire();
      }
      
      await logAuditTrail(
        PROGRAMS.JWT_VERIFICATION,
        "TOKEN_AUTHORIZATION",
        decoded.email || null,
        `Database connection failed: ${connectionError.message}`
      );
      
      return res.status(503).json({
        message: "Unable to connect to database. Please try again.",
        error: process.env.NODE_ENV === 'development' ? connectionError.message : undefined
      });
    }
  });
};

// Optional: Export a simplified version without session validation for certain routes
exports.verifyTokenBasic = async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(403).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Store basic user info
    req.adminId = decoded.id;
    req.email = decoded.email;
    req.role = decoded.loginType;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      loginType: decoded.loginType,
      clientId: decoded.clientId,
      dbName: decoded.dbName
    };
    req.masterUserID = decoded.id;

    try {
      // Get client connection
      const clientSequelize = await DatabaseConnectionManager.getClientConnectionForRequest(
        decoded.clientId,
        decoded.dbName
      );

      // Initialize models if needed
      if (!modelRegistry.isInitializedForClient(decoded.clientId)) {
        await modelRegistry.initModelsForClient(decoded.clientId, clientSequelize);
      }

      // Activate require patch
      requirePatcher.activateForClient(decoded.clientId);

      // Store cleanup function
      req._restoreRequire = () => {
        requirePatcher.deactivateForClient(decoded.clientId);
      };

      // Ensure cleanup
      const originalEnd = res.end;
      res.end = function(...args) {
        if (req._restoreRequire) {
          req._restoreRequire();
        }
        return originalEnd.apply(this, args);
      };

      next();
    } catch (error) {
      console.error("Connection error in verifyTokenBasic:", error);
      
      if (req._restoreRequire) {
        req._restoreRequire();
      }
      
      return res.status(503).json({
        message: "Database connection error"
      });
    }
  });
};