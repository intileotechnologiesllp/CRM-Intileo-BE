const Tenant = require("../../models/chatbot/tenantModel");
const ChatbotConfig = require("../../models/chatbot/chatbotConfigModel");
const {
  getTenantConfig,
  upsertChatbotConfig,
  listKnowledgeBase,
  replaceKnowledgeBase: replaceKnowledgeBaseEntries,
} = require("../../services/chatbot/chatbotConfigService");
const { syncBotConfiguration } = require("../../services/chatbot/botpressService");

async function ensureTenant(tenantId, name) {
  const [tenant] = await Tenant.findOrCreate({
    where: { id: tenantId },
    defaults: { name: name || `Tenant ${tenantId}` },
  });
  return tenant;
}

exports.createTenant = async (req, res) => {
  try {
    const { tenantId, name, status } = req.body;
    const tenant = await Tenant.create({
      id: tenantId,
      name,
      status: status || "active",
    });
    res.status(201).json({ tenant });
  } catch (error) {
    console.error("Failed to create tenant", error);
    res.status(500).json({ message: "Failed to create tenant", error: error.message });
  }
};

exports.upsertConfig = async (req, res) => {
  const { tenantId } = req.params;
  const { config = {}, knowledgeBase = [] } = req.body;

  try {
    await ensureTenant(tenantId, config.tenantName);
    const savedConfig = await upsertChatbotConfig(tenantId, config);
    if (Array.isArray(knowledgeBase)) {
      await replaceKnowledgeBaseEntries(tenantId, knowledgeBase);
    }
    res.json({ config: savedConfig });
  } catch (error) {
    console.error("Failed to upsert chatbot config", error);
    res.status(500).json({ message: "Failed to save config", error: error.message });
  }
};

exports.getConfig = async (req, res) => {
  const { tenantId } = req.params;
  try {
    const config = await getTenantConfig(tenantId);
    if (!config) return res.status(404).json({ message: "Config not found" });
    const kb = await listKnowledgeBase(tenantId, 100);
    const knowledgeBase = kb.map((entry) =>
      entry?.toJSON ? entry.toJSON() : entry
    );
    res.json({ config, knowledgeBase });
  } catch (error) {
    console.error("Failed to fetch config", error);
    res.status(500).json({ message: "Failed to fetch config", error: error.message });
  }
};

exports.syncToBotpress = async (req, res) => {
  const { tenantId } = req.params;
  try {
    const tenant = await Tenant.findByPk(tenantId);
    const config = await getTenantConfig(tenantId);
    const kbRecords = await listKnowledgeBase(tenantId, 100);
    const kb = kbRecords.map((entry) =>
      entry?.toJSON ? entry.toJSON() : entry
    );
    if (!tenant || !config) {
      return res.status(404).json({ message: "Tenant config not found" });
    }
    await syncBotConfiguration({
      tenant,
      config,
      knowledgeBase: kb,
    });
    res.json({ synced: true });
  } catch (error) {
    console.error("Failed to sync to Botpress", error);
    res.status(500).json({ message: "Failed to sync to Botpress", error: error.message });
  }
};

exports.replaceKnowledgeBase = async (req, res) => {
  const { tenantId } = req.params;
  const { entries } = req.body;
  try {
    const kb = await replaceKnowledgeBaseEntries(tenantId, entries || []);
    res.json({
      knowledgeBase: kb.map((entry) =>
        entry?.toJSON ? entry.toJSON() : entry
      ),
    });
  } catch (error) {
    console.error("Failed to replace knowledge base", error);
    res.status(500).json({ message: "Failed to replace knowledge base", error: error.message });
  }
};
