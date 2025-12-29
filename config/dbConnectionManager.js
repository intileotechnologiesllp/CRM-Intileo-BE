// config/dbConnectionManager.js
const bcrypt = require("bcrypt");
const { 
  getClientDbConnection, 
  getClientByEmail, 
  centralSequelize,
  addClientConnection 
} = require("./db");
const modelRegistry = require("../utils/modelRegistry");
// Get models (they'll use the patched require)
const MasterUser = require('../models/master/masterUserModel');


class DatabaseConnectionManager {
  
  /**
   * Connect to database and ensure user exists
   */
  static async connectAndEnsureUser(email, password) {
    try {
      // Get client from central database
      const client = await getClientByEmail(email);
      
      if (!client) {
        throw new Error("Client not found");
      }
      
      // Verify client password
      const isPasswordValid = await bcrypt.compare(password, client.password);
      if (!isPasswordValid) {
        throw new Error("Invalid password");
      }
      
      // Connect to client's database
      const clientSequelize = await getClientDbConnection(client);
      
      // Initialize models for this client
      await modelRegistry.initModelsForClient(client.id, clientSequelize);
      
      // Get models (they'll use the patched require)
      const MasterUser = require('../models/master/masterUserModel');
      
      // Check if user exists, create if not
      const userInfo = await this.ensureUserExists(email, password, client, MasterUser);
      
      return {
        clientConfig: client,
        user: userInfo.user,
        isNewUser: userInfo.isNew,
        clientSequelize
      };
      
    } catch (error) {
      console.error("Error in connectAndEnsureUser:", error);
      throw error;
    }
  }
  
  /**
   * Ensure user exists in MasterUsers table
   */
  static async ensureUserExists(email, password, clientConfig, MasterUser) {
    try {
      const user = await MasterUser.findOne({ 
        where: { email } 
      });
      
      if (user) {
        return {
          user: user.toJSON(),
          isNew: false
        };
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await MasterUser.create({
        name: clientConfig.name || 'Admin',
        email: email,
        password: hashedPassword,
        creatorId: 1,
        createdBy: 'System',
        loginType: 'admin',
        userType: 'admin',
        mobileNumber: '0000000000',
        isActive: true
      });
      
      return {
        user: newUser.toJSON(),
        isNew: true
      };
      
    } catch (error) {
      console.error("Error ensuring user exists:", error);
      throw error;
    }
  }
  
  /**
   * Verify user and connect to their database
   */
  static async verifyUserInDatabase(email, password) {
    try {
      // Get client from central database
      const client = await getClientByEmail(email);
      
      if (!client) {
        throw new Error("Client not found");
      }
      
      // Verify client password
      const isPasswordValid = await bcrypt.compare(password, client.password);
      if (!isPasswordValid) {
        throw new Error("Invalid password");
      }
      
      // Connect to client's database
      const clientSequelize = await getClientDbConnection(client);
      
      // Initialize models for this client
      await modelRegistry.initModelsForClient(client.id, clientSequelize);
    
      
      // Find user in client's database
      const user = await MasterUser.findOne({ 
        where: { email } 
      });
      
      if (!user) {
        throw new Error("User not found in client database");
      }
      
      // Verify user password
      const isUserPasswordValid = await bcrypt.compare(password, user.password);
      if (!isUserPasswordValid) {
        throw new Error("Invalid password");
      }
      
      // Get creator info
      const creator = await MasterUser.findOne({ 
        where: { masterUserID: user.creatorId } 
      });
      
      // Get plan details
      const planDetails = client.planId ? 
        await this.getPlanWithFeatures(client.planId) : null;
      
      return {
        user,
        creator,
        clientConfig: client,
        planDetails,
        clientSequelize
      };
      
    } catch (error) {
      console.error("Error verifying user:", error);
      throw error;
    }
  }
  
  /**
   * Get plan with features
   */
  static async getPlanWithFeatures(planId) {
    try {
      // Get plan basic details
      const [plan] = await centralSequelize.query(
        `SELECT * FROM Plan WHERE id = ? LIMIT 1`,
        {
          replacements: [planId],
          type: centralSequelize.QueryTypes.SELECT
        }
      );
      
      if (!plan) return null;
      
      // Get plan features
      const features = await centralSequelize.query(
        `SELECT pf.*, f.key, f.label 
         FROM PlanFeature pf 
         JOIN Feature f ON pf.featureId = f.id 
         WHERE pf.planId = ?`,
        {
          replacements: [planId],
          type: centralSequelize.QueryTypes.SELECT
        }
      );
      
      return {
        id: plan.id,
        name: plan.name,
        code: plan.code,
        description: plan.description,
        currency: plan.currency,
        unitAmount: plan.unitAmount,
        billingInterval: plan.billingInterval,
        trialPeriodDays: plan.trialPeriodDays,
        isActive: plan.isActive,
        features: features.map(f => ({
          id: f.id,
          featureId: f.featureId,
          key: f.key,
          label: f.label,
          value: f.value,
          type: f.type
        }))
      };
    } catch (error) {
      console.error("Error fetching plan with features:", error);
      return null;
    }
  }
  
  /**
   * Get client connection for middleware
   */
  static async getClientConnectionForRequest(clientId, dbName) {
    const connectionKey = `${clientId}_${dbName}`;
    
    // Check if we have the connection
    const { getClientConnectionByKey } = require('./db');
    let clientSequelize = getClientConnectionByKey(connectionKey);
    
    if (!clientSequelize) {
      // We need to reconnect
      const [client] = await centralSequelize.query(
        `SELECT * FROM client WHERE id = ? LIMIT 1`,
        {
          replacements: [clientId],
          type: centralSequelize.QueryTypes.SELECT
        }
      );
      
      if (!client) {
        throw new Error("Client not found");
      }
      
      clientSequelize = await getClientDbConnection(client);
      
      // Re-initialize models
      await modelRegistry.initModelsForClient(clientId, clientSequelize);
    }
    
    return clientSequelize;
  }
}

module.exports = DatabaseConnectionManager;