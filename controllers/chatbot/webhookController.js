const ChatSession = require("../../models/chatbot/chatSessionModel");
const ChatbotConfig = require("../../models/chatbot/chatbotConfigModel");
const {
  getTenantConfigByInbox,
  listKnowledgeBase,
} = require("../../services/chatbot/chatbotConfigService");
const {
  sendToBotpress,
  shouldHandoff,
} = require("../../services/chatbot/botpressService");
const {
  sendMessageToConversation,
  assignToAgent,
  markConversationPendingHandoff,
} = require("../../services/chatbot/chatwootService");

function extractIncomingMessage(payload) {
  return (
    payload?.content ||
    payload?.message ||
    payload?.data?.content ||
    payload?.last_message?.content
  );
}

exports.handleChatwoot = async (req, res) => {
  try {
    const payload = req.body;
    const inboxId =
      payload?.inbox_id ||
      payload?.conversation?.inbox_id ||
      payload?.inboxId;
    const conversationId =
      payload?.conversation?.id ||
      payload?.conversation_id ||
      payload?.id ||
      payload?.conversationId;
    const text = extractIncomingMessage(payload);

    if (!inboxId || !conversationId || !text) {
      return res.status(400).json({ message: "Missing inbox, conversation, or text" });
    }

    const config = await getTenantConfigByInbox(String(inboxId));
    if (!config) {
      return res.status(404).json({ message: "No tenant linked to inbox" });
    }

    const tenantId = config.tenantId;
    let session = await ChatSession.findOne({
      where: { tenantId, chatwootConversationId: String(conversationId) },
    });

    if (!session) {
      session = await ChatSession.create({
        tenantId,
        chatwootConversationId: String(conversationId),
      });
    }

    const kbRecords = await listKnowledgeBase(tenantId, 50);
    const knowledgeBase = kbRecords.map((entry) =>
      entry?.toJSON ? entry.toJSON() : entry
    );
    const bpResponse = await sendToBotpress({
      botId: config.botpressBotId,
      sessionId: session.botpressSessionId || String(conversationId),
      message: text,
      tenantContext: {
        tenantId,
        inboxId,
        chatwootConversationId: conversationId,
      },
      knowledgeBase,
    });

    if (bpResponse.sessionId && !session.botpressSessionId) {
      session.botpressSessionId = bpResponse.sessionId;
      await session.save();
    }

    res.json({ forwarded: true });
  } catch (error) {
    console.error("Chatwoot webhook failed", error);
    res.status(500).json({ message: "Chatwoot webhook failed", error: error.message });
  }
};

exports.handleBotpress = async (req, res) => {
  try {
    const payload = req.body;
    const sessionId =
      payload?.sessionId ||
      payload?.session_id ||
      payload?.conversationId ||
      payload?.conversation_id;
    const responses = payload?.responses || payload?.messages || [];

    if (!sessionId) {
      return res.status(400).json({ message: "Missing sessionId" });
    }

    const session =
      (await ChatSession.findOne({
        where: { botpressSessionId: sessionId },
      })) ||
      (await ChatSession.findOne({
        where: { chatwootConversationId: sessionId },
      }));

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const config = await ChatbotConfig.findOne({
      where: { tenantId: session.tenantId },
    });

    const textResponse =
      responses
        .map((r) => r.text || r.content || "")
        .filter(Boolean)
        .join("\n") || config?.fallbackMessage;

    if (textResponse) {
      await sendMessageToConversation(session.chatwootConversationId, textResponse);
    }

    const handoff = shouldHandoff({
      responses,
      enableHumanHandoff: config?.enableHumanHandoff,
    });
    if (handoff) {
      await markConversationPendingHandoff(session.chatwootConversationId);
      if (config?.escalationRules?.agentId) {
        await assignToAgent(session.chatwootConversationId, config.escalationRules.agentId);
      }
      session.status = "handoff";
      await session.save();
    }

    res.json({ delivered: true });
  } catch (error) {
    console.error("Botpress webhook failed", error);
    res.status(500).json({ message: "Botpress webhook failed", error: error.message });
  }
};
