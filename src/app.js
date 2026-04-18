const express = require("express");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");
const { publicRateLimit } = require("./middlewares/rateLimit.middleware");

const authRouter = require("./routes/auth.route");
const chatRouter = require("./routes/chat.route");
const memoryRouter = require("./routes/memory.route");
const configRouter = require("./routes/config.route");
const usageRouter = require("./routes/usage.route");

const app = express();

// ─── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));

// ─── Request Logger ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.requestId = uuidv4();
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        latency_ms: Date.now() - start,
        request_id: req.requestId,
      }),
    );
  });
  next();
});

// ─── Global Rate Limit ──────────────────────────────────────────────────────
app.use("/api", publicRateLimit);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get("/api/v1/health", async (req, res) => {
  try {
    const reinvy = require("./reinvyClient");
    const health = await reinvy.health();
    res.json({ success: true, gateway: "ok", core: health });
  } catch (err) {
    res
      .status(503)
      .json({
        success: false,
        gateway: "ok",
        core: "unreachable",
        error: err.message,
      });
  }
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/memory", memoryRouter);
app.use("/api/v1/config", configRouter);
app.use("/api/v1/usage", usageRouter);

// ─── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// ─── Error Handler ──────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Gateway] Unhandled error:", err.message);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
});

module.exports = app;
