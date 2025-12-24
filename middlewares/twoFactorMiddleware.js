const rateLimit = require("express-rate-limit");

/**
 * Rate limiter for 2FA verification attempts
 * Limits to 5 attempts per 15 minutes per IP
 */
const twoFactorRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    message: "Too many 2FA verification attempts. Please try again after 15 minutes.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many 2FA verification attempts from this IP. Please try again after 15 minutes.",
      error: "RATE_LIMIT_EXCEEDED"
    });
  },
});

/**
 * Rate limiter for 2FA setup attempts
 * More lenient - 10 attempts per 15 minutes
 */
const twoFactorSetupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    message: "Too many 2FA setup attempts. Please try again after 15 minutes.",
  },
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many 2FA setup attempts. Please try again after 15 minutes.",
      error: "RATE_LIMIT_EXCEEDED"
    });
  },
});

module.exports = {
  twoFactorRateLimiter,
  twoFactorSetupRateLimiter,
};
