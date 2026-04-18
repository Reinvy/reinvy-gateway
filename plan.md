# 🗺️ reinvy-gateway — Implementation Plan

> **Tipe:** Interface Project — Public REST API Gateway  
> **Posisi:** Depends on `@reinvy/sdk`. Satu-satunya service yang diekspos ke publik.  
> **Referensi:** [Root plan.md](../plan.md) | [PRD](prd.md)

---

## Status Progres

| Fase | Deskripsi                  | Status         |
| ---- | -------------------------- | -------------- |
| 11   | Public REST API + JWT Auth | ⬜ Not Started |

---

## Prerequisites

- `reinvy-core` selesai Fase 6 (Core complete)
- `reinvy-sdk` selesai Fase 7 dan sudah di-install

---

## Fase 11 — Public REST API Gateway

**Test saat selesai:**

```bash
# 1. Dapat JWT
curl -X POST http://localhost:4000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"api_key": "test_api_key_123"}'

# 2. Chat dengan JWT
curl -X POST http://localhost:4000/v1/chat \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"message": "halo!"}'
```

### Struktur Folder Target

```
reinvy-gateway/
├── src/
│   ├── routes/
│   │   ├── auth.route.js
│   │   ├── chat.route.js
│   │   ├── memory.route.js
│   │   ├── config.route.js
│   │   └── usage.route.js
│   ├── middlewares/
│   │   ├── jwtAuth.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── validate.middleware.js
│   ├── adapters/
│   │   └── reinvy.adapter.js
│   └── config/
│       └── config.js
├── app.js
├── Dockerfile
├── .env.example
└── package.json
```

### Checklist

#### Setup

- [ ] Hapus express-generator scaffold (bin/, public/, routes/)
- [ ] Update `package.json`:

  ```json
  {
    "name": "reinvy-gateway",
    "version": "1.0.0",
    "scripts": {
      "start": "node app.js",
      "dev": "nodemon app.js"
    },
    "dependencies": {
      "express": "^4.18.0",
      "jsonwebtoken": "^9.0.0",
      "express-rate-limit": "^7.0.0",
      "zod": "^3.0.0",
      "@reinvy/sdk": "file:../reinvy-sdk",
      "dotenv": "^16.0.0",
      "winston": "^3.0.0",
      "uuid": "^9.0.0"
    },
    "devDependencies": {
      "nodemon": "^3.0.0"
    }
  }
  ```

- [ ] `.env.example`:

  ```
  PORT=4000
  NODE_ENV=development

  JWT_SECRET=change_this_to_a_long_random_secret_minimum_32_chars
  JWT_EXPIRES_IN=86400

  REINVY_CORE_URL=http://localhost:3000
  REINVY_SERVICE_KEY=api_devkey123

  # API keys yang valid (comma-separated: key:user_id)
  # Format: apikey1:user_uuid1,apikey2:user_uuid2
  API_KEYS=test_api_key_123:user_test_001
  ```

- [ ] `src/config/config.js` — Zod validation:
  ```js
  // Required: PORT, JWT_SECRET (min 32 chars), JWT_EXPIRES_IN, REINVY_CORE_URL, REINVY_SERVICE_KEY, API_KEYS
  // Parse API_KEYS: string → Map<apiKey, userId>
  ```

#### Adapter

- [ ] `src/adapters/reinvy.adapter.js`:
  ```js
  const { ReinvyClient } = require("@reinvy/sdk");
  const client = new ReinvyClient({
    baseUrl: config.REINVY_CORE_URL,
    serviceKey: config.REINVY_SERVICE_KEY,
    source: "gateway",
  });
  module.exports = client;
  ```

#### Middlewares

- [ ] `src/middlewares/jwtAuth.middleware.js`:

  ```js
  // Extract token dari header: Authorization: Bearer <token>
  // jwt.verify(token, config.JWT_SECRET)
  // Attach req.user = { user_id, ... }
  // Jika tidak ada / invalid → 401 { success: false, error: { code: "UNAUTHORIZED", message: "..." } }
  // Jangan expose error detail JWT ke client (hanya log di server)
  ```

- [ ] `src/middlewares/rateLimit.middleware.js`:

  ```js
  // express-rate-limit: 20 req per menit per IP (public-facing)
  // Lebih ketat dari Core (10/menit per user) karena ini public
  // Custom handler: return { success: false, error: { code: "RATE_LIMIT_EXCEEDED", ... } }
  ```

- [ ] `src/middlewares/validate.middleware.js`:
  ```js
  // Factory: createValidator(zodSchema)
  // Validasi req.body terhadap schema
  // Jika gagal → 400 { success: false, error: { code: "VALIDATION_ERROR", details: [...] } }
  ```

#### Routes

- [ ] `src/routes/auth.route.js`:

  ```js
  // POST /auth/token
  // Body: { api_key: string }
  // Validate api_key vs config.API_KEYS map
  // Jika valid → jwt.sign({ user_id, source: 'gateway' }, secret, { expiresIn })
  // Response: { token: "...", expires_in: JWT_EXPIRES_IN }
  // Jika tidak valid → 401 { success: false, error: { code: "INVALID_API_KEY" } }
  // Rate limit ketat: 5 req per menit untuk auth endpoint (mencegah brute force)
  ```

- [ ] `src/routes/chat.route.js`:

  ```js
  // POST /v1/chat
  // Middleware: rateLimitMiddleware → jwtAuthMiddleware → validateMiddleware(chatSchema)
  // Zod schema: { message: string.min(1).max(2000), model?: string, personality?: string, options?: object }
  // user_id dari req.user.user_id (JWT payload)
  // Call: reinvyAdapter.chat({ user_id, message, model, personality, options })
  // Response passthrough dari Core
  ```

- [ ] `src/routes/memory.route.js`:

  ```js
  // GET /v1/memory
  // Middleware: jwtAuthMiddleware
  // Call: reinvyAdapter.getMemory(req.user.user_id, { limit: req.query.limit })
  //
  // DELETE /v1/memory
  // Middleware: jwtAuthMiddleware
  // Call: reinvyAdapter.deleteMemory(req.user.user_id)
  ```

- [ ] `src/routes/config.route.js`:

  ```js
  // GET /v1/config
  // Middleware: jwtAuthMiddleware
  // Call: reinvyAdapter.getConfig(req.user.user_id)
  //
  // PUT /v1/config
  // Middleware: jwtAuthMiddleware → validateMiddleware(configSchema)
  // Zod schema: { model?: string, personality?: string, max_context?: number.min(1).max(50), language?: string }
  // Call: reinvyAdapter.updateConfig(req.user.user_id, body)
  ```

- [ ] `src/routes/usage.route.js`:
  ```js
  // GET /v1/usage
  // Middleware: jwtAuthMiddleware
  // Call: reinvyAdapter.getUsage(req.user.user_id)
  ```

#### App Entry Point

- [ ] `app.js`:

  ```js
  require("dotenv").config();
  const express = require("express");
  const config = require("./src/config/config");

  const app = express();
  app.use(express.json());

  // Request logger
  // CORS headers (jika diperlukan untuk web client)

  // Routes
  app.use("/auth", require("./src/routes/auth.route"));
  app.use("/v1/chat", require("./src/routes/chat.route"));
  app.use("/v1/memory", require("./src/routes/memory.route"));
  app.use("/v1/config", require("./src/routes/config.route"));
  app.use("/v1/usage", require("./src/routes/usage.route"));
  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // 404 handler
  // Global error handler: { success: false, error: { code, message } }

  app.listen(config.PORT, () =>
    console.log(`Gateway running on port ${config.PORT}`),
  );
  ```

#### Dockerfile

- [ ] `Dockerfile`:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --omit=dev
  COPY . .
  EXPOSE 4000
  CMD ["node", "app.js"]
  ```

---

## Catatan Security

### JWT Best Practices (OWASP)

- Secret wajib ≥ 32 random chars — jangan pakai kata-kata
- Algorithm: HS256 minimum, gunakan RS256 jika butuh multi-service verify
- Jangan expose JWT errors detail ke client (hanya log di server)
- Set `expiresIn` — jangan buat token yang tidak pernah expire

### Auth Endpoint Brute Force Protection

- Rate limit ketat di `/auth/token`: 5 req/menit
- Jangan bedakan response antara "API key tidak ada" vs "API key salah" (selalu "INVALID_API_KEY")

### User Isolation

- User hanya boleh akses data miliknya sendiri
- `user_id` HARUS dari JWT payload (req.user.user_id), bukan dari request body
- Jangan ijinkan client mengirim `user_id` sendiri di body untuk menimpa JWT

### Input Validation

- Semua route yang menerima body WAJIB pakai `validateMiddleware` + Zod schema
- Max message length: 2000 chars (konsisten dengan Core)

### API Key Storage

- Untuk production: simpan API keys di database (hashed), bukan di ENV
- Development: ENV sudah cukup via `API_KEYS` format
