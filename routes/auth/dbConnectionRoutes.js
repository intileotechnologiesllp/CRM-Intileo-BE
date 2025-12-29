const express = require("express");
const router = express.Router();
const DatabaseConnectionManager = require("../../config/dbConnectionManager");
const { body, validationResult } = require("express-validator");

// Validation middleware
const validateDbConnection = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * API 1: Connect to database and ensure user exists
 * POST /api/auth/connect-db
 */
router.post("/connect-db", validateDbConnection, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { email, password } = req.body;
    
    // Connect to database and ensure user exists using Sequelize models
    const result = await DatabaseConnectionManager.connectAndEnsureUser(email, password);
    
    res.status(200).json({
      success: true,
      message: result.isNewUser ? 
        "New user created and database connected successfully" : 
        "User verified and database connected successfully",
      clientInfo: {
        clientId: result.clientConfig.id,
        clientName: result.clientConfig.name,
        organizationName: result.clientConfig.organizationName,
        dbName: result.clientConfig.db_name,
        host: result.clientConfig.db_host,
        port: result.clientConfig.db_port
      },
      user: {
        id: result.user.masterUserID,
        email: result.user.email,
        name: result.user.name,
        loginType: result.user.loginType,
        isActive: result.user.isActive
      },
      isNewUser: result.isNewUser
    });
    
  } catch (error) {
    console.error("Database connection error:", error);
    
    // Specific error responses
    if (error.message.includes("Client not found")) {
      return res.status(404).json({
        success: false,
        message: "Client not found in central database"
      });
    }
    
    if (error.message.includes("Invalid password")) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }
    
    if (error.message.includes("Cannot connect to client database")) {
      return res.status(503).json({
        success: false,
        message: "Unable to connect to client database",
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

/**
 * API to get user details (for testing)
 * POST /api/auth/get-user
 */
router.post("/get-user", async (req, res) => {
  try {
    const { clientId, userId } = req.body;
    
    if (!clientId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Client ID and User ID are required"
      });
    }
    
    // Get client config from central database
    const { centralSequelize } = require("../../config/db");
    const [client] = await centralSequelize.query(
      `SELECT * FROM client WHERE id = ? LIMIT 1`,
      {
        replacements: [clientId],
        type: centralSequelize.QueryTypes.SELECT
      }
    );
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }
    
    // Get user using Sequelize model
    const user = await DatabaseConnectionManager.getUserById(client, userId);
    
    res.status(200).json({
      success: true,
      user: user
    });
    
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message
    });
  }
});

module.exports = router;