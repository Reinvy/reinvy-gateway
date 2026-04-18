require("dotenv").config();
const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  REINVY_CORE_URL: z.string().url().default("http://reinvy-core:3001"),
  REINVY_SERVICE_KEY: z.string().min(1, "REINVY_SERVICE_KEY is required"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[Config] Invalid environment variables:");
  parsed.error.errors.forEach((e) =>
    console.error(` - ${e.path.join(".")}: ${e.message}`),
  );
  process.exit(1);
}

module.exports = parsed.data;
