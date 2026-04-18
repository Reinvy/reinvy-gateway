const express = require("express");
const { z } = require("zod");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const reinvy = require("../reinvyClient");

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  personality: z.enum(["friendly", "formal", "expert", "concise"]).optional(),
  language: z.string().min(2).max(10).optional(),
  model: z.string().optional(),
});

/**
 * POST /api/v1/chat
 * Public-facing chat endpoint. Requires JWT.
 */
router.post("/", authMiddleware, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0].message,
      },
    });
  }

  const { message, personality, language, model } = parsed.data;
  const { user_id, source } = req.user;

  try {
    const result = await reinvy.chat({
      user_id,
      source,
      message,
      personality,
      language,
      model,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }
});

module.exports = router;
