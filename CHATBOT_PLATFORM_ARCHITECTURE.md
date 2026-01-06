# Multi-tenant Chatbot Platform (Botpress + Chatwoot)

## High-level architecture
- **API layer (Express)**: tenant-aware REST APIs, webhook endpoints, validation, and auth. Routes live under `routes/chatbot` with controllers in `controllers/chatbot`.
- **Domain services**: `services/chatbot/*` encapsulate Botpress + Chatwoot calls, config orchestration, and handoff logic. Keeps controllers thin and testable.
- **Persistence (MySQL via Sequelize)**: `tenants`, `tenant_users`, `chatbot_configs`, `knowledge_bases`, `chat_sessions` enforce tenant isolation. All queries filter by `tenantId`.
- **Bots**: one Botpress bot per tenant (preferred) or shared bot keyed by `tenantContext`. Config + KB are synced via `syncBotConfiguration`.
- **Channels**: one Chatwoot inbox per tenant. Inbox → tenant mapping stored on `chatbot_configs.chatwootInboxId`.
- **Webhooks**: HMAC/token verification in `middlewares/webhookAuth.js`, raw body captured for signature validation. Chatwoot → Node → Botpress; Botpress → Node → Chatwoot.
- **Session tracking**: `chat_sessions` maps Chatwoot conversation ↔ Botpress session for continuity and handoff state.

## Key data models
- `Tenant`: isolates each SaaS customer; status toggles access.
- `TenantUser`: minimal role-based admin for chatbot (owner/admin/agent).
- `ChatbotConfig`: bot persona, welcome/fallback, language, business hours, allowed actions, escalation rules, Botpress bot ID, Chatwoot inbox ID.
- `KnowledgeBase`: tenant FAQ/KB entries (question/answer/tags) injected into Botpress payloads.
- `ChatSession`: tracks active conversation and handoff status.

## API surface
- `POST /api/chatbot/tenants` – create tenant.
- `GET /api/chatbot/tenants/:tenantId/config` – fetch config + KB.
- `POST|PUT /api/chatbot/tenants/:tenantId/config` – upsert config (and optional KB array).
- `POST /api/chatbot/tenants/:tenantId/config/sync` – push config/KB to Botpress.
- `POST /api/chatbot/tenants/:tenantId/knowledge-base` – replace KB entries.
- `POST /api/webhooks/chatbot/chatwoot` – Chatwoot inbound.
- `POST /api/webhooks/chatbot/botpress` – Botpress outbound.

## Example payloads
### Upsert config
```json
{
  "config": {
    "botName": "Acme Helper",
    "systemPrompt": "You are Acme's helpful assistant...",
    "welcomeMessage": "Hi! I'm AcmeBot.",
    "language": "en",
    "businessHours": { "timezone": "UTC", "hours": [{ "day": "mon-fri", "from": "09:00", "to": "18:00" }] },
    "fallbackMessage": "I'm handing this to a human.",
    "enableHumanHandoff": true,
    "allowedActions": ["lead_capture", "booking", "handoff"],
    "escalationRules": { "agentId": 123, "keywords": ["agent", "support"] },
    "botpressBotId": "bp-acme-001",
    "chatwootInboxId": "42"
  },
  "knowledgeBase": [
    { "question": "What are your hours?", "answer": "We open 9-6 UTC.", "tags": ["hours"] },
    { "question": "How to book a demo?", "answer": "Use /book or share your email.", "tags": ["booking"] }
  ]
}
```

### Chatwoot webhook (inbound)
```json
{
  "inbox_id": 42,
  "conversation": { "id": 9876, "inbox_id": 42 },
  "content": "I need a demo tomorrow"
}
```

### Botpress webhook (outbound)
```json
{
  "sessionId": "9876",
  "responses": [
    { "text": "I can help book a demo. What time works?" }
  ]
}
```

## Flow
1. **Inbound (Chatwoot → Botpress)**: webhook resolves tenant via `chatwootInboxId`, loads config + KB, ensures `chat_sessions` entry, forwards to Botpress with `tenantContext` + KB.
2. **Outbound (Botpress → Chatwoot)**: webhook resolves session, sends response back to Chatwoot. Handoff triggers Chatwoot assignment/labeling per `escalationRules`.
3. **Sync**: Admin calls `/config/sync` to push latest config/KB into Botpress for runtime use.

## Security
- HMAC (`x-chatwoot-signature`, `x-bp-signature`) or token (`x-webhook-token`) required for webhooks.
- All data access keyed by `tenantId`; no cross-tenant queries.
- Store secrets in env: `CHATWOOT_*`, `BOTPRESS_*`, `BOTPRESS_WEBHOOK_SECRET`, `CHATWOOT_WEBHOOK_SECRET`.

## Scaling to 10k+ tenants
- Keep KB + config in MySQL with `tenantId` indexes (added in migration).
- Avoid per-tenant Node processes; reuse connection pools and Botpress shared bot with `tenantContext` when bot-per-tenant is heavy.
- Cache hot config/KB (Redis) keyed by `tenantId`; warm on webhook hit.
- Use background sync jobs to push config to Botpress; keep webhook path lightweight.
- Apply rate limiting per inbox/tenant; monitor webhook latency + retries.
- Shard Chatwoot inboxes across accounts if needed; maintain mapping in `chatbot_configs`.
