const express = require("express");
const { z } = require("zod");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const reinvy = require("../reinvyClient");

const configUpdateSchema = z
  .object({
    model: z.string().optional(),
    personality: z.enum(["friendly", "formal", "expert", "concise"]).optional(),
    max_context: z.number().int().min(1).max(50).optional(),
    language: z.string().min(2).max(10).optional(),
  })
  .strict();

/**
 * GET /api/v1/config
 */
router.get("/", authMiddleware, async (req, res) => {
  const { user_id, source } = req.user;
  try {
    const data = await reinvy.getConfig({ user_id, source });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }
});

/**
 * PUT /api/v1/config
 */
router.put("/", authMiddleware, async (req, res) => {
  const parsed = configUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0].message,
      },
    });
  }

  const { user_id, source } = req.user;
  try {
    const data = await reinvy.setConfig({ user_id, source, ...parsed.data });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }
});

module.exports = router;
