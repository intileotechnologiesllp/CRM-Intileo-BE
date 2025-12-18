const jwt = require("jsonwebtoken");
const { getClientDbConnection } = require("../config/db");
const DatabaseConnectionManager = require("../config/dbConnectionManager");

/**
 * Middleware to attach client database connection and models to requests
 */
const dbContextMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get client configuration from central database
    const { centralSequelize } = require("../config/db");
    const [client] = await centralSequelize.query(
      `SELECT * FROM client WHERE id = ? LIMIT 1`,
      {
        replacements: [decoded.clientId],
        type: centralSequelize.QueryTypes.SELECT
      }
    );
    
    if (!client) {
      return res.status(401).json({
        success: false,
        message: "Client configuration not found"
      });
    }
    
    // Connect to client database
    const clientConnection = await getClientDbConnection(client);
    
    // Get all models for this connection
    const models = DatabaseConnectionManager.getAllModels(clientConnection);
    
    // Attach to request
    req.clientConnection = clientConnection;
    req.clientConfig = client;
    req.user = decoded;
    req.models = models;
    
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }
    
    console.error("Database context middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection error"
    });
  }
};

module.exports = dbContextMiddleware;