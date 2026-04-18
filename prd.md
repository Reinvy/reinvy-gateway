# 📄 PRD: `reinvy-gateway`

> **Bagian dari:** Reinvy AI Systems Ecosystem
> **Tipe:** Interface Project — Public REST API Gateway
> **Versi:** 2.0.0
> **Last Updated:** April 2026
> **Referensi Utama:** Lihat root [`prd.md`](../prd.md) §8 untuk konteks ekosistem lengkap.

---

## 1. Repo Overview

`reinvy-gateway` adalah satu-satunya interface project yang **terekspos ke internet publik**. Repo ini menyediakan REST API untuk client web dan mobile, menangani autentikasi user eksternal via JWT, dan meneruskan request ke `reinvy-core` melalui `reinvy-sdk`.

### Posisi dalam Ekosistem

```
Internet (User Web / Mobile)
    │
    │  HTTPS — JWT auth
    ▼
reinvy-gateway  (Public API Gateway)
    │
    │  @reinvy/sdk  (HTTP internal ke reinvy-core)
    ▼
reinvy-core  (AI Engine — tidak accessible dari publik)
```

**Dependency position:**

- **Depends on:** `@reinvy/sdk` (versi `^1.0.0`)
- **Does NOT depend on:** `reinvy-core` secara langsung, database, Redis
- **Satu-satunya service** dalam ekosistem yang expose port ke publik (via reverse proxy)

---

## 2. Scope

### Yang TERMASUK Tanggung Jawab Repo Ini

| Area                    | Detail                                                       |
| ----------------------- | ------------------------------------------------------------ |
| Public REST API         | Endpoint `/v1/chat`, `/v1/memory`, `/v1/config`, `/v1/usage` |
| External Authentication | Issue & validasi JWT token via `POST /auth/token`            |
| Public Rate Limiting    | 20 req/menit per user publik                                 |
| Request Validation      | Validasi body dengan Zod sebelum diteruskan ke SDK           |
| Response Normalization  | Format response konsisten ke semua client                    |
| User ID Namespace       | Map external user ke `reinvy user_id` dengan prefix `api_`   |
| Health Endpoint         | `GET /health` untuk monitoring dan load balancer             |

### Yang TIDAK Termasuk Tanggung Jawab Repo Ini

| Yang Dikecualikan                             | Keterangan                                                 |
| --------------------------------------------- | ---------------------------------------------------------- |
| Logika AI                                     | Tanggung jawab `reinvy-core`                               |
| Penyimpanan conversation history              | Tanggung jawab `reinvy-core`                               |
| Akses langsung ke PostgreSQL atau Redis       | ❌ Dilarang keras                                          |
| Discord / Telegram bot commands               | Tanggung jawab `reinvy-discord`, `reinvy-telegram`         |
| Internal service authentication (service key) | Dikelola di `reinvy-core` level                            |
| User database / user management               | Fase future — saat ini autentikasi berbasis API key statis |

---

## 3. Tech Stack

| Layer            | Teknologi            | Keterangan                        |
| ---------------- | -------------------- | --------------------------------- |
| Runtime          | Node.js 20+          |                                   |
| Framework        | Express.js           |                                   |
| Authentication   | JWT (`jsonwebtoken`) | HS256, signed dengan `JWT_SECRET` |
| Rate Limiting    | `express-rate-limit` | Per IP dan per user               |
| Validation       | Zod                  | Body dan query param validation   |
| SDK              | @reinvy/sdk          | Komunikasi ke reinvy-core         |
| Containerization | Docker               |                                   |

---

## 4. Folder Structure

```
reinvy-gateway/
├── src/
│   ├── routes/
│   │   ├── auth.route.js              # POST /auth/token
│   │   ├── chat.route.js              # POST /v1/chat
│   │   ├── memory.route.js            # GET, DELETE /v1/memory
│   │   ├── config.route.js            # GET, PUT /v1/config
│   │   └── usage.route.js             # GET /v1/usage
│   ├── middlewares/
│   │   ├── jwtAuth.middleware.js      # Validasi Bearer JWT token
│   │   ├── rateLimit.middleware.js    # Rate limiter per user
│   │   └── validate.middleware.js     # Zod schema validation
│   ├── adapters/
│   │   └── reinvy.adapter.js          # Inisialisasi ReinvyClient
│   └── config/
│       └── config.js                  # Load & validasi ENV variables
├── app.js
├── package.json
├── Dockerfile
├── .env.example
└── README.md
```

---

## 5. Public API Endpoints

### Base URL

```
https://api.reinvy.ai/v1
```

### Authentication Header (semua endpoint kecuali `/auth/token` dan `/health`)

```
Authorization: Bearer <JWT_TOKEN>
```

JWT token didapat melalui `POST /auth/token`.

---

### `POST /auth/token`

Tukar API key user eksternal dengan JWT token.

**Request Body:**

```json
{
  "api_key": "user_api_key_here"
}
```

| Field     | Type   | Required | Keterangan                                   |
| --------- | ------ | -------- | -------------------------------------------- |
| `api_key` | string | ✅       | API key yang diberikan kepada user/developer |

**Response 200:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

| Field        | Keterangan                                         |
| ------------ | -------------------------------------------------- |
| `token`      | JWT Bearer token untuk digunakan di header         |
| `expires_in` | Durasi token dalam detik (default: 86400 = 24 jam) |

**JWT Payload yang di-encode:**

```json
{
  "user_id": "api_<hashed_api_key>",
  "iat": 1745000000,
  "exp": 1745086400
}
```

**Error 401:**

```json
{
  "success": false,
  "error": { "code": "INVALID_API_KEY", "message": "API key tidak valid" }
}
```

---

### `POST /v1/chat`

Kirim pesan ke AI. User diidentifikasi dari JWT token.

**Request Body:**

```json
{
  "message": "Apa itu neural network?",
  "model": "openai/gpt-4o",
  "personality": "expert",
  "options": {
    "response_style": "detailed"
  }
}
```

| Field         | Type   | Required | Keterangan                    |
| ------------- | ------ | -------- | ----------------------------- |
| `message`     | string | ✅       | Pesan user, max 4000 karakter |
| `model`       | string | ❌       | Override model AI             |
| `personality` | string | ❌       | Override personality          |
| `options`     | object | ❌       | Runtime options               |

**Catatan:** `user_id` diambil otomatis dari JWT payload — client tidak perlu (dan tidak boleh) mengirim `user_id` sendiri.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "reply": "Neural network adalah...",
    "tokens": { "input": 80, "output": 350, "total": 430 }
  }
}
```

**Error Codes:**

| Code                        | HTTP | Keterangan                                 |
| --------------------------- | ---- | ------------------------------------------ |
| `UNAUTHORIZED`              | 401  | Token tidak ada, expired, atau tidak valid |
| `RATE_LIMIT_EXCEEDED`       | 429  | Melebihi 20 req/menit                      |
| `MESSAGE_TOO_LONG`          | 400  | Pesan > 4000 karakter                      |
| `VALIDATION_ERROR`          | 400  | Request body tidak sesuai schema           |
| `PROMPT_INJECTION_DETECTED` | 400  | Input terdeteksi sebagai prompt injection  |
| `SERVICE_UNAVAILABLE`       | 503  | reinvy-core tidak tersedia                 |
| `INTERNAL_ERROR`            | 500  | Error internal server                      |

---

### `GET /v1/memory`

Ambil conversation history user yang sedang login.

**Query Parameters:**

| Param   | Type   | Default | Keterangan                       |
| ------- | ------ | ------- | -------------------------------- |
| `limit` | number | 20      | Jumlah pesan terakhir (max: 100) |

**Response 200:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "role": "user",
        "content": "Halo",
        "created_at": "2026-04-18T10:00:00Z"
      },
      {
        "role": "assistant",
        "content": "Halo!",
        "created_at": "2026-04-18T10:00:01Z"
      }
    ],
    "summary": "User menanyakan tentang ML dasar.",
    "total_messages": 42
  }
}
```

---

### `DELETE /v1/memory`

Reset conversation history user yang sedang login.

**Response 200:**

```json
{
  "success": true,
  "message": "Memory cleared"
}
```

---

### `GET /v1/config`

Ambil konfigurasi AI user yang sedang login.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "model": "openai/gpt-4o",
    "personality": "friendly",
    "max_context": 10,
    "language": "id"
  }
}
```

---

### `PUT /v1/config`

Update konfigurasi AI user yang sedang login. Partial update didukung.

**Request Body:**

```json
{
  "model": "anthropic/claude-3-opus",
  "personality": "expert",
  "max_context": 15,
  "language": "en"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "model": "anthropic/claude-3-opus",
    "personality": "expert",
    "max_context": 15,
    "language": "en"
  }
}
```

---

### `GET /v1/usage`

Ambil usage stats user bulan ini.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "total_tokens": 15420,
    "total_requests": 87,
    "estimated_cost_usd": 0.0231,
    "period": "2026-04"
  }
}
```

---

### `GET /health`

Health check endpoint. **Tidak memerlukan autentikasi.**

**Response 200:**

```json
{
  "status": "ok",
  "uptime": 3600
}
```

---

## 6. Middleware Stack

Request masuk melalui middleware dalam urutan berikut:

```
Request
  │
  ├─► [1] express-rate-limit   — cek IP rate limit
  ├─► [2] jwtAuth.middleware   — validasi Bearer token (kecuali /auth/token & /health)
  ├─► [3] validate.middleware  — validasi body dengan Zod schema
  ├─► [4] Route Handler        — call reinvy.adapter → SDK → reinvy-core
  └─► [5] Error Handler        — format semua error ke response standar
```

---

## 7. User ID Namespace

User yang mengakses via `reinvy-gateway` menggunakan format `user_id` berikut:

```
JWT sub/user_id: "api_<hashed_api_key>"
```

Format `api_<...>` memastikan tidak ada collision dengan user Discord (`discord_<...>`) atau Telegram (`telegram_<...>`).

**Catatan keamanan:** `user_id` yang di-pass ke SDK **selalu diambil dari JWT payload** yang tervalidasi — client tidak boleh menentukan sendiri `user_id`-nya untuk mencegah user impersonation.

---

## 8. Rate Limiting

| Scope                    | Limit   | Window  | Keterangan                 |
| ------------------------ | ------- | ------- | -------------------------- |
| Per IP (global)          | 100 req | 1 menit | Proteksi dari bot scanning |
| Per user (authenticated) | 20 req  | 1 menit | Sesuai main PRD §12.4      |
| `/auth/token` endpoint   | 10 req  | 1 menit | Cegah brute force API key  |

Rate limit headers yang di-return ke client:

```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1745000060
```

---

## 9. Error Response Format

Semua error mengikuti format standar yang konsisten:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Deskripsi error yang ramah untuk developer"
  }
}
```

`error.code` adalah string konstanta yang bisa di-handle programatik oleh client. `error.message` adalah deskripsi yang lebih informatif.

---

## 10. Adapters

### `src/adapters/reinvy.adapter.js`

```js
const { ReinvyClient } = require("@reinvy/sdk");

const client = new ReinvyClient({
  baseUrl: process.env.REINVY_CORE_URL,
  serviceKey: process.env.REINVY_SERVICE_KEY,
  source: "api",
});

module.exports = client;
```

Di route handler, `user_id` selalu diambil dari JWT:

```js
// Contoh di chat.route.js
router.post("/chat", jwtAuth, validate(chatSchema), async (req, res) => {
  const userId = req.user.user_id; // dari JWT payload — tidak dari req.body
  const { message, model, personality, options } = req.body;

  const response = await reinvyClient.chat({
    user_id: userId,
    message,
    model,
    personality,
    options,
  });
  res.json(response);
});
```

---

## 11. Security Responsibilities

| Area                          | Implementasi                                                             |
| ----------------------------- | ------------------------------------------------------------------------ |
| JWT Validation                | Setiap request terautentikasi — token divalidasi signature & expiry      |
| User Impersonation Prevention | `user_id` selalu dari JWT payload, bukan dari request body               |
| API Key Hashing               | API key di-hash sebelum disimpan (tidak boleh store plain text)          |
| Rate Limiting                 | Per IP + per user untuk cegah abuse                                      |
| Input Validation              | Zod schema di semua endpoint sebelum data dikirim ke SDK                 |
| HTTPS Only                    | Tidak menerima request HTTP biasa di production (enforce di Nginx/Caddy) |
| CORS                          | Konfigurasi allowed origins yang ketat (tidak `*` di production)         |
| JWT Secret Protection         | `JWT_SECRET` hanya di ENV, tidak pernah di-log                           |
| Service Key Protection        | `REINVY_SERVICE_KEY` hanya di ENV                                        |
| No Direct DB Access           | ❌ Semua akses data melalui `@reinvy/sdk`                                |

---

## 12. Reverse Proxy Integration

`reinvy-gateway` di-expose ke publik melalui Nginx atau Caddy sebagai reverse proxy:

```
Internet → Nginx / Caddy (HTTPS termination)
    └── api.reinvy.ai  → reinvy-gateway:4000
```

**Nginx config contoh:**

```nginx
server {
  listen 443 ssl;
  server_name api.reinvy.ai;

  location / {
    proxy_pass http://reinvy-gateway:4000;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Host $host;
  }
}
```

`X-Forwarded-For` digunakan oleh `express-rate-limit` untuk rate limit per IP yang akurat.

---

## 13. Testing Strategy

| Jenis Test       | Target                                                     | Tool             |
| ---------------- | ---------------------------------------------------------- | ---------------- |
| Unit Test        | JWT middleware — valid token, expired token, missing token | Jest             |
| Unit Test        | Rate limiter — over limit dan under limit                  | Jest             |
| Unit Test        | Zod validators — valid body, invalid body, missing fields  | Jest             |
| Unit Test        | Error handler — semua SDK error ter-format dengan benar    | Jest             |
| Integration Test | Route handlers → SDK mock → response format                | Jest + Supertest |
| Integration Test | Auth flow: POST /auth/token → GET /v1/chat dengan token    | Jest + Supertest |

**Target coverage:** ≥ 80% untuk semua file di `src/`.

---

## 14. Deployment Notes

```yaml
# Dari docker-compose.yml ekosistem — lihat root prd.md §13.1
reinvy-gateway:
  build: ./reinvy-gateway
  networks: [reinvy-network]
  ports:
    - "4000:4000" # Expose ke host, dikonsumsi reverse proxy
  restart: unless-stopped
  environment:
    - PORT=4000
    - JWT_SECRET=
    - JWT_EXPIRES_IN=86400
    - REINVY_CORE_URL=http://reinvy-core:3000
    - REINVY_SERVICE_KEY=api_xxx
  depends_on: [reinvy-core]
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
    interval: 30s
    retries: 3
```

**Scaling Strategy:** Horizontal scaling didukung — `reinvy-gateway` bersifat stateless (semua state ada di Core dan JWT adalah self-contained token).

---

## 15. Environment Variables

```env
# Server
PORT=4000
NODE_ENV=production

# Authentication
JWT_SECRET=<strong_random_secret_min_32_chars>
JWT_EXPIRES_IN=86400

# CORS
CORS_ALLOWED_ORIGINS=https://app.reinvy.ai,https://docs.reinvy.ai

# Reinvy Core (via SDK)
REINVY_CORE_URL=http://reinvy-core:3000
REINVY_SERVICE_KEY=api_xxxxxxxxxxxx
```

---

## 16. Roadmap Ownership

Fase dari roadmap ekosistem (root `prd.md` §17) yang menjadi tanggung jawab repo ini:

| Fase    | Item                                               | Status     |
| ------- | -------------------------------------------------- | ---------- |
| Phase 3 | Setup Express app, JWT auth middleware             | ⬜ Todo    |
| Phase 3 | Implementasi semua route `/v1/*` dan `/auth/token` | ⬜ Todo    |
| Phase 3 | Rate limiting publik                               | ⬜ Todo    |
| Phase 3 | Zod validation untuk semua endpoint                | ⬜ Todo    |
| Phase 3 | Integrasi dengan reinvy-sdk                        | ⬜ Todo    |
| Phase 3 | Docker setup                                       | ⬜ Todo    |
| Phase 5 | Multi-tenant support                               | 🔜 Planned |
| Phase 5 | API key management dashboard                       | 🔜 Planned |
| Phase 5 | Webhook support untuk event notifications          | 🔜 Planned |
