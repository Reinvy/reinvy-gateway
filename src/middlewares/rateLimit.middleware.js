const rateLimit = require("express-rate-limit");

/**
 * Public-facing rate limiter: 30 requests / minute per IP.
 * Applied to all /api routes.
 */
const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please slow down.",
      },
    });
  },
});

/**
 * Stricter rate limiter for auth endpoints: 10 req / minute per IP.
 */
const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many auth attempts. Try again later.",
      },
    });
  },
});

module.exports = { publicRateLimit, authRateLimit };
