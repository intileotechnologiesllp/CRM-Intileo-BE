const axios = require("axios");

const CHATWOOT_URL = process.env.CHATWOOT_URL;
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN;
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;

const chatwootClient = axios.create({
  baseURL: CHATWOOT_URL,
  headers: {
    api_access_token: CHATWOOT_API_TOKEN,
    "Content-Type": "application/json",
  },
  timeout: 8000,
});

async function sendMessageToConversation(conversationId, content) {
  await chatwootClient.post(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
    {
      content,
      message_type: "outgoing",
      private: false,
    }
  );
}

async function assignToAgent(conversationId, agentId) {
  await chatwootClient.post(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/assignments`,
    { assignee_id: agentId }
  );
}

async function markConversationPendingHandoff(conversationId) {
  await chatwootClient.post(
    `/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/labels`,
    { labels: ["handoff-requested"] }
  );
}

module.exports = {
  sendMessageToConversation,
  assignToAgent,
  markConversationPendingHandoff,
};
