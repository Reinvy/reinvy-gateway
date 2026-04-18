const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const reinvy = require("../reinvyClient");

/**
 * GET /api/v1/usage
 */
router.get("/", authMiddleware, async (req, res) => {
  const { user_id } = req.user;
  try {
    const data = await reinvy.getUsage({ user_id });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }
});

module.exports = router;
