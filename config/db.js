
// require('dotenv').config();
// const { Sequelize } = require("sequelize");

// const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   dialect: "mysql", 
//   logging: false,
// });

// sequelize
//   .authenticate()
//   .then(() => {
//     console.log("Database connected successfully.");
//   })
//   .catch((error) => {
//     console.error("Unable to connect to the database:", error);
//   });



// module.exports = sequelize;





// config/db.js
require('dotenv').config();
const { Sequelize } = require("sequelize");

// Central database connection
const centralSequelize = new Sequelize(
  process.env.CENTRAL_DB_NAME || "crm_central", 
  process.env.CENTRAL_DB_USER || "root", 
  process.env.CENTRAL_DB_PASSWORD || "admin@123", 
  {
    host: process.env.CENTRAL_DB_HOST || "20.197.7.219",
    port: process.env.CENTRAL_DB_PORT || 3307,
    dialect: "mysql", 
    logging: false,
    define: {
      freezeTableName: true,
      underscored: false
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Store client connections
const clientConnections = new Map();

/**
 * Get or create client database connection
 */
async function getClientDbConnection(clientConfig) {
  const connectionKey = `${clientConfig.id}_${clientConfig.db_name}`;
  
  // Return existing connection if available
  if (clientConnections.has(connectionKey)) {
    const connection = clientConnections.get(connectionKey);
    try {
      await connection.authenticate();
      return connection;
    } catch (error) {
      console.log('Existing connection invalid, creating new one');
      clientConnections.delete(connectionKey);
    }
  }
  
  // Create new connection
  const clientSequelize = new Sequelize(
    clientConfig.db_name,
    clientConfig.db_user || process.env.DB_USER || "root",
    clientConfig.db_password || process.env.DB_PASSWORD || "",
    {
      host: clientConfig.db_host || process.env.DB_HOST || "localhost",
      port: clientConfig.db_port || process.env.DB_PORT || 3306,
      dialect: "mysql",
      logging: false,
      define: {
        freezeTableName: true,
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
    throw error;
  }
}

/**
 * Get client by email from central database
 */
async function getClientByEmail(email) {
  try {
    const [client] = await centralSequelize.query(
      `SELECT * FROM client WHERE email = ? LIMIT 1`,
      {
        replacements: [email],
        type: centralSequelize.QueryTypes.SELECT
      }
    );
    
    return client;
  } catch (error) {
    console.error("Error fetching client:", error);
    throw error;
  }
}

/**
 * Get client connection by key
 */
function getClientConnectionByKey(connectionKey) {
  return clientConnections.get(connectionKey);
}

/**
 * Add client connection
 */
function addClientConnection(connectionKey, sequelize) {
  clientConnections.set(connectionKey, sequelize);
}

module.exports = {
  centralSequelize,
  getClientDbConnection,
  getClientByEmail,
  getClientConnectionByKey,
  addClientConnection,
  clientConnections,
  Sequelize
};
