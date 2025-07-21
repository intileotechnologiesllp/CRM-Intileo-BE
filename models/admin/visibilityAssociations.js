const VisibilityGroup = require("./visibilityGroupModel");
const GroupMembership = require("./groupMembershipModel");
const PipelineVisibilityRule = require("./pipelineVisibilityRuleModel");
const ItemVisibilityRule = require("./itemVisibilityRuleModel");
const Pipeline = require("../deals/pipelineModel");
const MasterUser = require("../master/masterUserModel");

// VisibilityGroup associations
VisibilityGroup.hasMany(GroupMembership, {
  foreignKey: "groupId",
  as: "memberships",
});

VisibilityGroup.hasMany(PipelineVisibilityRule, {
  foreignKey: "groupId",
  as: "pipelineRules",
});

VisibilityGroup.hasMany(ItemVisibilityRule, {
  foreignKey: "groupId",
  as: "itemRules",
});

// GroupMembership associations
GroupMembership.belongsTo(VisibilityGroup, {
  foreignKey: "groupId",
  as: "group",
});

GroupMembership.belongsTo(MasterUser, {
  foreignKey: "userId",
  as: "user",
});

GroupMembership.belongsTo(MasterUser, {
  foreignKey: "assignedBy",
  as: "assignedByUser",
});

// PipelineVisibilityRule associations
PipelineVisibilityRule.belongsTo(VisibilityGroup, {
  foreignKey: "groupId",
  as: "group",
});

PipelineVisibilityRule.belongsTo(Pipeline, {
  foreignKey: "pipelineId",
  as: "pipeline",
});

// ItemVisibilityRule associations
ItemVisibilityRule.belongsTo(VisibilityGroup, {
  foreignKey: "groupId",
  as: "group",
});

// MasterUser associations
MasterUser.hasMany(GroupMembership, {
  foreignKey: "userId",
  as: "groupMemberships",
});

// Pipeline associations
Pipeline.hasMany(PipelineVisibilityRule, {
  foreignKey: "pipelineId",
  as: "visibilityRules",
});

module.exports = {
  VisibilityGroup,
  GroupMembership,
  PipelineVisibilityRule,
  ItemVisibilityRule,
};
