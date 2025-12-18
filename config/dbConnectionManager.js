const { getClientDbConnection, getClientConfig } = require("./db");
const bcrypt = require("bcrypt");
const { createMasterUserModel } = require("../models");
const { setupAssociations } = require("./associations");

class DatabaseConnectionManager {
  static modelInstances = new Map();
  static associatedModels = new Map();
  
  /**
   * Get model instance for a specific connection
   */
  static getModel(connection, modelName) {
    const connectionKey = `${connection.config.host}_${connection.config.database}`;
    const modelKey = `${connectionKey}_${modelName}`;
    
    if (this.modelInstances.has(modelKey)) {
      return this.modelInstances.get(modelKey);
    }
    
    let model;
    switch (modelName) {
      case 'MasterUser':
        model = createMasterUserModel(connection);
        break;
      case 'LostReason':
        model = createLostReasonModel(connection);
        break;
      case 'LeadOrganization':
        model = createLeadOrganizationModel(connection);
        break;
      case 'LeadPerson':
        model = createLeadPersonModel(connection);
        break;
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
    
    this.modelInstances.set(modelKey, model);
    return model;
  }
  
  /**
   * Get all models with associations for a specific connection
   */
  static getAllModels(connection) {
    const connectionKey = `${connection.config.host}_${connection.config.database}`;
    
    // Return cached models with associations if exists
    if (this.associatedModels.has(connectionKey)) {
      return this.associatedModels.get(connectionKey);
    }
    
    // Get individual models
    const models = {
      MasterUser: this.getModel(connection, 'MasterUser'),
      LostReason: this.getModel(connection, 'LostReason'),
      LeadOrganization: this.getModel(connection, 'LeadOrganization'),
      LeadPerson: this.getModel(connection, 'LeadPerson')
    };
    
    // Set up associations
    const modelsWithAssociations = setupAssociations(models);
    
    // Cache the models with associations
    this.associatedModels.set(connectionKey, modelsWithAssociations);
    
    return modelsWithAssociations;
  }
  
  /**
   * Sync all models for a connection in correct order
   */
  static async syncModels(connection, models) {
    try {
      console.log("🔄 Syncing database models...");
      
      // Sync in correct order: parent tables first
      await models.MasterUser.sync({ alter: false, force: false });
      console.log("✅ MasterUsers table synced");
      
      await models.LostReason.sync({ alter: false, force: false });
      console.log("✅ LostReasons table synced");
      
      await models.LeadOrganization.sync({ alter: false, force: false });
      console.log("✅ LeadOrganizations table synced");
      
      await models.LeadPerson.sync({ alter: false, force: false });
      console.log("✅ LeadPersons table synced");

      console.log("✅ All models synced successfully");
      
    } catch (error) {
      console.error("❌ Error syncing models:", error);
      
      // More detailed error information
      if (error.original && error.original.code === 'ER_CANT_CREATE_TABLE') {
        console.error("Foreign key constraint error details:");
        console.error("SQL:", error.sql);
        
        // Try syncing without foreign keys first
        console.log("🔄 Attempting to sync without foreign keys...");
        
        // Drop foreign key constraint and retry
        try {
          await connection.query('SET FOREIGN_KEY_CHECKS = 0');
          
          // Sync tables without foreign key constraints
          await models.MasterUser.sync({ alter: true, force: false });
          await models.LostReason.sync({ alter: true, force: false });
          await models.LeadOrganization.sync({ alter: true, force: false });
          await models.LeadPerson.sync({ alter: true, force: false });
          
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
          
          console.log("✅ Models synced with foreign keys disabled/enabled");
        } catch (retryError) {
          console.error("❌ Even sync without foreign keys failed:", retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Connect to client database and ensure user exists
   */
  static async connectAndEnsureUser(email, password) {
    try {
      // Step 1: Get client configuration
      const client = await getClientConfig(email, password);
      
      // Step 2: Connect to client's database
      const clientConnection = await getClientDbConnection(client);
      
      // Step 3: Get all models with associations
      const models = this.getAllModels(clientConnection);
      
      // Step 4: Sync all models in correct order
      await this.syncModels(clientConnection, models);
      
      // Step 5: Check if user exists, create if not
      const userInfo = await this.ensureUserExists(models.MasterUser, email, password, client);
      
      return {
        clientConnection,
        clientConfig: client,
        user: userInfo.user,
        isNewUser: userInfo.isNew,
        models
      };
      
    } catch (error) {
      console.error("Error in connectAndEnsureUser:", error);
      throw error;
    }
  }
  
  /**
   * Ensure user exists in MasterUsers table
   */
  static async ensureUserExists(MasterUserModel, email, password, clientConfig) {
    try {
      const user = await MasterUserModel.findOne({ 
        where: { email } 
      });
      
      if (user) {
        return {
          user: user.toJSON(),
          isNew: false
        };
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await MasterUserModel.create({
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
   * Verify user in client database (for signin)
   */
  static async verifyUserInDatabase(email, password) {
    try {
      const { centralSequelize } = require("./db");
      const [client] = await centralSequelize.query(
        `SELECT * FROM client WHERE email = ? LIMIT 1`,
        {
          replacements: [email],
          type: centralSequelize.QueryTypes.SELECT
        }
      );
      
      if (!client) {
        throw new Error("Client not found");
      }
      
      const clientConnection = await getClientDbConnection(client);
      const models = this.getAllModels(clientConnection);
      
      await this.syncModels(clientConnection, models);
      
      const user = await models.MasterUser.findOne({ 
        where: { email } 
      });
      
      if (!user) {
        throw new Error("User not found in client database");
      }
      
      const creator = await models.MasterUser.findOne({ 
        where: { masterUserID: user.creatorId } 
      });

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error("Invalid password");
      }
      
      return {
        user: user.toJSON(),
        creator: creator ? creator.toJSON() : null,
        clientConfig: client,
        clientConnection,
        models
      };
      
    } catch (error) {
      console.error("Error verifying user:", error);
      throw error;
    }
  }
  
  /**
   * Get user by ID from client database
   */
  static async getUserById(clientConfig, userId) {
    try {
      const clientConnection = await getClientDbConnection(clientConfig);
      const models = this.getAllModels(clientConnection);
      
      const user = await models.MasterUser.findByPk(userId, {
        include: [{
          model: models.LeadOrganization,
          as: 'organizations'
        }]
      });
      
      if (!user) {
        throw new Error("User not found");
      }
      
      return user.toJSON();
      
    } catch (error) {
      console.error("Error getting user by ID:", error);
      throw error;
    }
  }
}

module.exports = DatabaseConnectionManager;