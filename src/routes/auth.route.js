const express = require("express");
const { z } = require("zod");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
const config = require("../config");
const { authRateLimit } = require("../middlewares/rateLimit.middleware");

const loginSchema = z.object({
  user_id: z.string().min(1).max(128),
  source: z.string().min(1).max(32).default("api"),
});

/**
 * POST /api/v1/auth/token
 * Issues a JWT for a user_id+source pair.
 *
 * Note: This is a demo auth endpoint. In production,
 * replace this with proper credential validation (DB lookup, OAuth, etc).
 */
router.post("/token", authRateLimit, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0].message,
      },
    });
  }

  const { user_id, source } = parsed.data;

  const token = jwt.sign(
    { user_id, source, jti: uuidv4() },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN },
  );

  res.json({
    success: true,
    data: {
      token,
      expires_in: config.JWT_EXPIRES_IN,
      user_id,
      source,
    },
  });
});

module.exports = router;
