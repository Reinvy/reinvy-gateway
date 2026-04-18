const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const reinvy = require("../reinvyClient");

/**
 * GET /api/v1/memory
 * Get conversation history for the authenticated user.
 */
router.get("/", authMiddleware, async (req, res) => {
  const { user_id, source } = req.user;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const data = await reinvy.getMemory({ user_id, source, limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }
});

/**
 * DELETE /api/v1/memory
 * Clear conversation history for the authenticated user.
 */
router.delete("/", authMiddleware, async (req, res) => {
  const { user_id, source } = req.user;

  try {
    await reinvy.clearMemory({ user_id, source });
    res.json({ success: true, message: "Memory cleared" });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }
});

module.exports = router;
