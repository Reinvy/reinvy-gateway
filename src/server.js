require("dotenv").config();
const app = require("./app");
const config = require("./config");

const server = app.listen(config.PORT, () => {
  console.log(
    `[Gateway] Listening on port ${config.PORT} (${config.NODE_ENV})`,
  );
});

process.on("SIGTERM", () => {
  console.log("[Gateway] SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[Gateway] SIGINT received, shutting down...");
  server.close(() => process.exit(0));
});
