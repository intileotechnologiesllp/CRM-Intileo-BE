// utils/requirePatcher.js
const modelRegistry = require('./modelRegistry');

class RequirePatcher {
  constructor() {
    this.activePatches = new Map(); // clientId -> { originalRequire }
    this.requireStack = [];
  }
  
  /**
   * Activate require patch for a client
   */
  activateForClient(clientId) {
    if (this.activePatches.has(clientId)) {
      return; // Already active
    }
    
    const { patchedRequire, originalRequire } = modelRegistry.patchRequireForClient(clientId);
    
    // Store original
    this.activePatches.set(clientId, {
      originalRequire: global.require,
      patchedRequire
    });
    
    // Only patch if not already patched
    if (!this.isPatched()) {
      this.requireStack.push(global.require);
      global.require = patchedRequire;
    }
    
    console.log(`🔧 Require patched for client ${clientId}`);
  }
  
  /**
   * Deactivate require patch for a client
   */
  deactivateForClient(clientId) {
    if (!this.activePatches.has(clientId)) {
      return;
    }
    
    this.activePatches.delete(clientId);
    
    // If no more active patches, restore original require
    if (this.activePatches.size === 0 && this.requireStack.length > 0) {
      global.require = this.requireStack.pop();
      console.log('🔧 Require patch deactivated');
    }
  }
  
  /**
   * Check if require is currently patched
   */
  isPatched() {
    return this.requireStack.length > 0;
  }
  
  /**
   * Deactivate all patches
   */
  deactivateAll() {
    while (this.requireStack.length > 0) {
      global.require = this.requireStack.pop();
    }
    this.activePatches.clear();
    console.log('🔧 All require patches deactivated');
  }
}

// Create singleton
const requirePatcher = new RequirePatcher();

module.exports = requirePatcher;