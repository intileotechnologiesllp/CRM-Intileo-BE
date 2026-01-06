const axios = require("axios");

const BOTPRESS_URL = process.env.BOTPRESS_URL;
const BOTPRESS_ADMIN_TOKEN = process.env.BOTPRESS_ADMIN_TOKEN;

const botpressClient = axios.create({
  baseURL: BOTPRESS_URL,
  headers: {
    Authorization: `Bearer ${BOTPRESS_ADMIN_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

/**
 * Pushes tenant config + KB into Botpress. Assumes a custom Botpress HTTP handler
 * that can accept the payload and persist it (per-tenant or per-bot).
 */
async function syncBotConfiguration({ tenant, config, knowledgeBase }) {
  if (!config.botpressBotId) {
    throw new Error("Missing botpressBotId for tenant");
  }

  await botpressClient.post(
    `/api/v1/bots/${config.botpressBotId}/config`,
    {
      tenantId: tenant.id,
      botName: config.botName,
      systemPrompt: config.systemPrompt,
      welcomeMessage: config.welcomeMessage,
      language: config.language,
      businessHours: config.businessHours,
      fallbackMessage: config.fallbackMessage,
      enableHumanHandoff: config.enableHumanHandoff,
      allowedActions: config.allowedActions,
      escalationRules: config.escalationRules,
      knowledgeBase,
    }
  );
}

/**
 * Sends a message from Chatwoot → Botpress, preserving tenant context and KB.
 */
async function sendToBotpress({
  botId,
  sessionId,
  message,
  tenantContext,
  knowledgeBase,
}) {
  const response = await botpressClient.post(
    `/api/v1/bots/${botId}/converse/${sessionId}`,
    {
      type: "text",
      text: message,
      metadata: {
        tenantContext,
        knowledgeBase,
      },
    }
  );

  return {
    sessionId: response.data?.sessionId || sessionId,
    answers: response.data?.responses || [],
  };
}

/**
 * Lightweight detection for human handoff.
 */
function shouldHandoff({ responses = [], enableHumanHandoff }) {
  if (!enableHumanHandoff) return false;
  const text = responses.map((r) => r.text || "").join(" ").toLowerCase();
  return text.includes("handoff") || text.includes("human agent");
}

module.exports = {
  syncBotConfiguration,
  sendToBotpress,
  shouldHandoff,
};
