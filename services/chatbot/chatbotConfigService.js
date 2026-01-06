const ChatbotConfig = require("../../models/chatbot/chatbotConfigModel");
const KnowledgeBase = require("../../models/chatbot/knowledgeBaseModel");
const Tenant = require("../../models/chatbot/tenantModel");

async function getTenantConfigByInbox(chatwootInboxId) {
  return ChatbotConfig.findOne({
    where: { chatwootInboxId },
    include: [{ model: Tenant, as: "tenant" }],
  });
}

async function getTenantConfig(tenantId) {
  return ChatbotConfig.findOne({ where: { tenantId } });
}

async function upsertChatbotConfig(tenantId, payload) {
  const [config] = await ChatbotConfig.upsert(
    { tenantId, ...payload },
    { returning: true }
  );
  return config;
}

async function listKnowledgeBase(tenantId, limit = 50) {
  return KnowledgeBase.findAll({
    where: { tenantId },
    limit,
    order: [["updatedAt", "DESC"]],
  });
}

async function replaceKnowledgeBase(tenantId, entries = []) {
  await KnowledgeBase.destroy({ where: { tenantId } });
  if (!entries.length) return [];
  const normalized = entries.map((entry) => ({
    tenantId,
    question: entry.question,
    answer: entry.answer,
    tags: entry.tags || [],
  }));
  return KnowledgeBase.bulkCreate(normalized);
}

module.exports = {
  getTenantConfigByInbox,
  getTenantConfig,
  upsertChatbotConfig,
  listKnowledgeBase,
  replaceKnowledgeBase,
};
