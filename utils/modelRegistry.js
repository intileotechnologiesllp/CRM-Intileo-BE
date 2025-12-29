// utils/modelRegistry.js
const path = require('path');
const fs = require('fs');
const Module = require('module');

class ModelRegistry {
  constructor() {
    this.clientModels = new Map(); // clientId -> { sequelize, modelsCache }
    this.originalRequire = Module.prototype.require;
    this.requireStack = [];
    this.modelDefinitions = new Map(); // modelName -> definition function
    this.scannedModels = false;
  }
  
  /**
   * Scan all model files recursively
   */
  scanModelFiles() {
    if (this.scannedModels) {
      return;
    }
    
    const modelsDir = path.join(__dirname, '../models');
    const modelFiles = [];
    
    function scanDirectory(currentDir, basePath = '') {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const relativePath = path.join(basePath, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath, relativePath);
        } else if (file.endsWith('.js') && !file.endsWith('.test.js')) {
          // Check if it's likely a model file
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('sequelize.define') || content.includes('Sequelize.define')) {
            modelFiles.push({
              fullPath,
              relativePath,
              directory: path.dirname(relativePath)
            });
          }
        }
      }
    }
    
    scanDirectory(modelsDir);
    this.modelFiles = modelFiles;
    this.scannedModels = true;
    
    console.log(`📁 Found ${modelFiles.length} model files in nested structure`);
    
    // Extract model names
    this.modelFiles.forEach(file => {
      const modelName = this.extractModelNameFromFile(file.fullPath);
      if (modelName) {
        console.log(`   - ${file.relativePath} -> ${modelName}`);
      }
    });
  }
  
  /**
   * Extract model name from file content
   */
  extractModelNameFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Look for sequelize.define("ModelName"
      const defineMatch = content.match(/sequelize\.define\s*\(\s*["']([^"']+)["']/i);
      if (defineMatch) {
        return defineMatch[1];
      }
      
      // Look for module.exports = sequelize.define("ModelName"
      const exportMatch = content.match(/module\.exports\s*=\s*sequelize\.define\s*\(\s*["']([^"']+)["']/i);
      if (exportMatch) {
        return exportMatch[1];
      }
      
      // Extract from filename as fallback
      const fileName = path.basename(filePath, '.js');
      return fileName.replace(/Model$/, '');
    } catch (error) {
      console.warn(`Could not extract model name from ${filePath}:`, error.message);
      return null;
    }
  }
  
  /**
   * Initialize models for a client
   */
  async initModelsForClient(clientId, sequelizeInstance) {
    // Scan models if not already scanned
    if (!this.scannedModels) {
      this.scanModelFiles();
    }
    
    // Check if already initialized
    if (this.clientModels.has(clientId)) {
      const clientData = this.clientModels.get(clientId);
      if (clientData.sequelize === sequelizeInstance) {
        return; // Already initialized with same sequelize
      }
    }
    
    // Clear cache for all model files
    this.clearModelCache();
    
    // Store client data
    this.clientModels.set(clientId, {
      sequelize: sequelizeInstance,
      timestamp: Date.now(),
      models: new Map() // Will store loaded models
    });
    
    console.log(`✅ Models registry initialized for client ${clientId}`);
  }
  
  /**
   * Clear model require cache
   */
  clearModelCache() {
    if (!this.modelFiles) {
      this.scanModelFiles();
    }
    
    this.modelFiles.forEach(file => {
      if (require.cache[file.fullPath]) {
        delete require.cache[file.fullPath];
      }
    });
    
    // Also clear db.js cache
    const dbPath = require.resolve('../config/db');
    if (require.cache[dbPath]) {
      delete require.cache[dbPath];
    }
  }
  
  /**
   * Get or load a model for a specific client
   */
  getModel(clientId, modelName) {
    const clientData = this.clientModels.get(clientId);
    if (!clientData) {
      throw new Error(`No models initialized for client ${clientId}`);
    }
    
    // Check if model is already loaded
    if (clientData.models.has(modelName)) {
      return clientData.models.get(modelName);
    }
    
    // Need to load the model
    const model = this.loadModelForClient(clientId, modelName, clientData.sequelize);
    if (model) {
      clientData.models.set(modelName, model);
    }
    
    return model;
  }
  
  /**
   * Load a specific model for a client
   */
  loadModelForClient(clientId, modelName, sequelizeInstance) {
    // First, find the model file
    const modelFile = this.findModelFile(modelName);
    if (!modelFile) {
      throw new Error(`Model file for ${modelName} not found`);
    }
    
    console.log(`🔧 Loading model ${modelName} from ${modelFile.relativePath} for client ${clientId}`);
    
    // Temporarily patch require to inject the correct sequelize
    const originalRequire = Module.prototype.require;
    
    Module.prototype.require = function(modulePath) {
      const resolvedPath = Module._resolveFilename(modulePath, this);
      
      // If it's the db config, return patched version
      if (resolvedPath.includes(path.join('config', 'db.js'))) {
        const originalExports = originalRequire.call(this, modulePath);
        
        return {
          ...originalExports,
          defaultSequelize: sequelizeInstance,
          centralSequelize: originalExports.centralSequelize,
          getClientDbConnection: originalExports.getClientDbConnection,
          getClientByEmail: originalExports.getClientByEmail,
          clientConnections: originalExports.clientConnections,
          Sequelize: originalExports.Sequelize
        };
      }
      
      return originalRequire.call(this, modulePath);
    };
    
    try {
      // Clear cache for this specific model
      if (require.cache[modelFile.fullPath]) {
        delete require.cache[modelFile.fullPath];
      }
      
      // Load the model
      const model = require(modelFile.fullPath);
      
      // Store the model definition for future use
      if (!this.modelDefinitions.has(modelName)) {
        this.modelDefinitions.set(modelName, {
          filePath: modelFile.fullPath,
          dependencies: this.extractDependencies(modelFile.fullPath)
        });
      }
      
      return model;
    } catch (error) {
      console.error(`Error loading model ${modelName}:`, error);
      throw error;
    } finally {
      // Restore original require
      Module.prototype.require = originalRequire;
    }
  }
  
  /**
   * Find model file by model name
   */
  findModelFile(modelName) {
    if (!this.modelFiles) {
      this.scanModelFiles();
    }
    
    // First try exact match
    for (const file of this.modelFiles) {
      const extractedName = this.extractModelNameFromFile(file.fullPath);
      if (extractedName === modelName) {
        return file;
      }
    }
    
    // Try case-insensitive match
    const lowerModelName = modelName.toLowerCase();
    for (const file of this.modelFiles) {
      const extractedName = this.extractModelNameFromFile(file.fullPath);
      if (extractedName && extractedName.toLowerCase() === lowerModelName) {
        return file;
      }
    }
    
    // Try filename match
    for (const file of this.modelFiles) {
      const fileName = path.basename(file.fullPath, '.js');
      if (fileName.toLowerCase().includes(modelName.toLowerCase().replace('model', ''))) {
        return file;
      }
    }
    
    console.warn(`Model ${modelName} not found in scanned files`);
    return null;
  }
  
  /**
   * Extract dependencies from model file
   */
  extractDependencies(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
      const dependencies = [];
      let match;
      
      while ((match = requireRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
      
      return dependencies;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Check if models are initialized for client
   */
  isInitializedForClient(clientId) {
    return this.clientModels.has(clientId);
  }
  
  /**
   * Get sequelize instance for client
   */
  getClientSequelize(clientId) {
    const clientData = this.clientModels.get(clientId);
    return clientData ? clientData.sequelize : null;
  }
  
  /**
   * Get all loaded models for a client
   */
  getAllModels(clientId) {
    const clientData = this.clientModels.get(clientId);
    if (!clientData) {
      throw new Error(`No models initialized for client ${clientId}`);
    }
    
    // If we need to load all models
    if (clientData.models.size === 0 && this.modelFiles) {
      console.log(`🔄 Loading all models for client ${clientId}`);
      
      this.modelFiles.forEach(file => {
        const modelName = this.extractModelNameFromFile(file.fullPath);
        if (modelName && !clientData.models.has(modelName)) {
          try {
            const model = this.loadModelForClient(clientId, modelName, clientData.sequelize);
            if (model) {
              clientData.models.set(modelName, model);
            }
          } catch (error) {
            console.warn(`Failed to load model ${modelName}:`, error.message);
          }
        }
      });
    }
    
    return Object.fromEntries(clientData.models);
  }
  
  /**
   * Clean up old connections
   */
  cleanupOldConnections(maxAge = 30 * 60 * 1000) {
    const now = Date.now();
    
    for (const [clientId, data] of this.clientModels.entries()) {
      if (now - data.timestamp > maxAge) {
        this.clientModels.delete(clientId);
        console.log(`🧹 Cleaned up models for client ${clientId}`);
      }
    }
  }
}

// Create singleton
const modelRegistry = new ModelRegistry();

// Run cleanup every 15 minutes
setInterval(() => {
  modelRegistry.cleanupOldConnections();
}, 15 * 60 * 1000);

module.exports = modelRegistry;