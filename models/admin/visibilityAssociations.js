// This file is kept for backwards compatibility
// Associations are now defined in config/associations.js
// Models should be imported from the appropriate model files or through dbConnectionManager

// For backwards compatibility, we export the model factory functions
// Controllers should be updated to use proper model access patterns
const createVisibilityGroupModel = require("./visibilityGroupModel");
const createGroupMembershipModel = require("./groupMembershipModel");
const createPipelineVisibilityRuleModel = require("./pipelineVisibilityRuleModel");
const createItemVisibilityRuleModel = require("./itemVisibilityRuleModel");

module.exports = {
  VisibilityGroup: createVisibilityGroupModel,
  GroupMembership: createGroupMembershipModel,
  PipelineVisibilityRule: createPipelineVisibilityRuleModel,
  ItemVisibilityRule: createItemVisibilityRuleModel,
};
