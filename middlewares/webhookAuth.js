const crypto = require("crypto");

function verifyHmac(secret, signature, rawBody) {
  if (!secret || !signature || !rawBody) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(computed, "utf8"),
    Buffer.from(signature, "utf8")
  );
}

function verifyChatwootWebhook(req, res, next) {
  const signature = req.headers["x-chatwoot-signature"];
  const token = req.headers["x-webhook-token"];
  const hmacOk = verifyHmac(
    process.env.CHATWOOT_WEBHOOK_SECRET,
    signature,
    req.rawBody
  );
  const tokenOk =
    process.env.CHATWOOT_WEBHOOK_TOKEN &&
    token === process.env.CHATWOOT_WEBHOOK_TOKEN;

  if (hmacOk || tokenOk) return next();
  return res.status(401).json({ message: "Invalid Chatwoot webhook signature" });
}

function verifyBotpressWebhook(req, res, next) {
  const signature = req.headers["x-bp-signature"] || req.headers["x-botpress-signature"];
  const token = req.headers["x-webhook-token"];
  const hmacOk = verifyHmac(
    process.env.BOTPRESS_WEBHOOK_SECRET,
    signature,
    req.rawBody
  );
  const tokenOk =
    process.env.BOTPRESS_WEBHOOK_TOKEN &&
    token === process.env.BOTPRESS_WEBHOOK_TOKEN;

  if (hmacOk || tokenOk) return next();
  return res.status(401).json({ message: "Invalid Botpress webhook signature" });
}

module.exports = {
  verifyChatwootWebhook,
  verifyBotpressWebhook,
};
