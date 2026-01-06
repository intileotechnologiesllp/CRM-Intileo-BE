const express = require("express");
const router = express.Router();
const { verifyChatwootWebhook, verifyBotpressWebhook } = require("../../middlewares/webhookAuth");
const { handleChatwoot, handleBotpress } = require("../../controllers/chatbot/webhookController");

// Capture raw body for HMAC verification on this router only
router.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

router.post("/chatwoot", verifyChatwootWebhook, handleChatwoot);
router.post("/botpress", verifyBotpressWebhook, handleBotpress);

module.exports = router;
