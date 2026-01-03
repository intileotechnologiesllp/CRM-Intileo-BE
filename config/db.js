require('dotenv').config();
const { Sequelize } = require("sequelize");

// Central database connection
const centralSequelize = new Sequelize(
  process.env.CENTRAL_DB_NAME || "crm_central", 
  process.env.CENTRAL_DB_USER || "root", 
  process.env.CENTRAL_DB_PASSWORD || "Intileo@123", 
  {
    host: process.env.CENTRAL_DB_HOST || "213.136.77.55",
    port: process.env.CENTRAL_DB_PORT || 3308,
    dialect: "mysql", 
    logging: false,
    define: {
      freezeTableName: true, // Prevents Sequelize from pluralizing table names
      underscored: false // Use camelCase, not snake_case
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Store active client database connections
const clientConnections = new Map();

// Default sequelize instance (for backward compatibility)
const defaultSequelize = new Sequelize(
  process.env.DB_NAME || "crm", 
  process.env.DB_USER || "root", 
  process.env.DB_PASSWORD || "Intileo@123", 
  {
    host: process.env.DB_HOST || "164.52.223.86",
    port: process.env.DB_PORT || 3308,
    dialect: "mysql", 
    logging: false,
    define: {
      freezeTableName: true,
      underscored: false
    },
  }
);

/**
 * Get or create a connection to a client's database
 */
async function getClientDbConnection(clientConfig) {
  const connectionKey = `${clientConfig.clientId}_${clientConfig.db_name}`;
  
  if (clientConnections.has(connectionKey)) {
    const existingConnection = clientConnections.get(connectionKey);
    try {
      await existingConnection.authenticate();
      console.log(`✅ Reusing existing connection for ${clientConfig.db_name}`);
      return existingConnection;
    } catch (error) {
      console.log(`🔄 Existing connection invalid, creating new one`);
      clientConnections.delete(connectionKey);
    }
  }
  
  const clientSequelize = new Sequelize(
    clientConfig.db_name,
    clientConfig.db_user || "root",
    clientConfig.db_password,
    {
      host: clientConfig.db_host || "localhost",
      port: clientConfig.db_port || 3306,
      dialect: "mysql",
      logging: false,
      define: {
        freezeTableName: true, // Important: prevents table name changes
        underscored: false
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
  
  try {
    await clientSequelize.authenticate();
    console.log(`✅ Connected to client database: ${clientConfig.db_name}`);
    
    clientConnections.set(connectionKey, clientSequelize);
    
    return clientSequelize;
  } catch (error) {
    console.error(`❌ Failed to connect to client database ${clientConfig.db_name}:`, error.message);
    throw new Error(`Cannot connect to client database: ${error.message}`);
  }
}

/**
 * Get client configuration from central database
 */
async function getClientConfig(email, password) {
  try {
    const [client] = await centralSequelize.query(
      `SELECT * FROM client WHERE email = :email LIMIT 1`,
      {
        replacements: { email },
        type: centralSequelize.QueryTypes.SELECT
      }
    );
    
    if (!client) {
      throw new Error("Client not found");
    }
    
    const bcrypt = require("bcrypt");
    const isPasswordValid = await bcrypt.compare(password, client.password);
    
    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }
    
    return client;
  } catch (error) {
    console.error("Error fetching client config:", error);
    throw error;
  }
}

module.exports = {
  centralSequelize,
  defaultSequelize,
  getClientDbConnection,
  getClientConfig,
  clientConnections,
  Sequelize
};