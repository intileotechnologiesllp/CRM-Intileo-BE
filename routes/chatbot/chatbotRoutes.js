const express = require("express");
const router = express.Router();
const {
  createTenant,
  upsertConfig,
  getConfig,
  syncToBotpress,
  replaceKnowledgeBase,
} = require("../../controllers/chatbot/configController");

router.post("/tenants", createTenant);
router.get("/tenants/:tenantId/config", getConfig);
router.post("/tenants/:tenantId/config", upsertConfig);
router.put("/tenants/:tenantId/config", upsertConfig);
router.post("/tenants/:tenantId/config/sync", syncToBotpress);
router.post("/tenants/:tenantId/knowledge-base", replaceKnowledgeBase);

module.exports = router;
