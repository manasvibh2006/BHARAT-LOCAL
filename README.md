# 🇮🇳 Bharat Local: Multilingual Location-Based Community Platform & API

> A robust, production-grade hyperlocal community platform engineered for India. Residents can find, share, and moderate local announcements, utility services, jobs, and emergency aid in their native language and locality.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v22-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-dc382d.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-16%20Passed-success.svg)](tests/)

---

## 🌟 System Architecture & Key Capabilities

```
                  ┌────────────────────────────────────────┐
                  │       Client Layer                     │
                  │  (Interactive Web App / Mobile / cURL) │
                  └──────────────────┬─────────────────────┘
                                     │ REST HTTP / JSON
                                     ▼
        ┌────────────────────────────────────────────────────────┐
        │            Bharat Local Express Gateway                │
        │  • Helmet & CORS Security  • IP & Route Rate Limiters  │
        │  • JWT Auth & RBAC         • Zod Input Validation      │
        └───────┬────────────────────┬───────────────────┬───────┘
                │                    │                   │
    Cache Lookups & TTL       SQL Queries & DDL      Async Jobs
                │                    │                   │
                ▼                    ▼                   ▼
    ┌───────────────────────┐ ┌─────────────┐ ┌─────────────────────┐
    │     Redis Cache       │ │ PostgreSQL  │ │ Notification Queue  │
    │  • Hyperlocal Feed    │ │ • B-Tree    │ │ • Job Scheduler     │
    │  • Post Detail Cache  │ │ • GIN Search│ │ • Exponential Retry │
    │  • Event Invalidation │ │ • Foreign K │ │ • Worker Event Log  │
    └───────────────────────┘ └─────────────┘ └──────────┬──────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │  Background Worker  │
                                              │ • Mod Alerts        │
                                              │ • Author Approvals  │
                                              │ • SMS / Push Emitter│
                                              └─────────────────────┘
```

### 1. 📱 Phone-Based Authentication & RBAC
- **Indian Mobile Validation**: E.164 phone normalization supporting standard Indian mobile numbers (`+91XXXXXXXXXX` or `9XXXXXXXXX`).
- **OTP Verification Cycle**: Secure OTP request, rate-limited attempts, and JWT session token generation. In development, defaults to mock code `123456`.
- **Role-Based Permissions (RBAC)**:
  - `user`: Browse hyperlocal feeds, search posts, submit new community listings, report inappropriate content, manage language & location preferences.
  - `moderator`: Review flagged and reported posts in the Moderation Desk, approve/reject/hide content, add moderation audit notes.
  - `admin`: Full administrative oversight, district emergency broadcasts, user bans, and platform analytics.

### 2. 🗄️ PostgreSQL Data Modeling & Database Indexes
Located in [`src/db/schema.sql`](src/db/schema.sql):
- **Composite B-Tree Indexes**:
  - `idx_posts_city_status_created` (`city, status, created_at DESC`): Powers instant filtering of active community feeds sorted by recency.
  - `idx_posts_category_lang_created` (`category_id, language, created_at DESC`): High-efficiency filtering by category and preferred language.
  - `idx_posts_locality_status` (`city, locality, status`): Locality-level spatial slicing.
- **Multilingual Full-Text Search (GIN)**:
  - `idx_posts_search_vector` on TSVECTOR: Indexed across title, content, locality, and city using weighted vector scoring (`setweight`).
- **Partial Moderation Queue Index**:
  - `idx_posts_pending_review` on `(status, report_count DESC)` filtered strictly `WHERE status IN ('pending_review', 'flagged')` for zero-overhead moderator queue queries.

### 3. ⚡ Redis Caching Layer
Located in [`src/cache/cache-service.ts`](src/cache/cache-service.ts):
- **Hyperlocal Feed Caching**: Structured keys: `feed:<city>:<locality>:<category>:<language>:<page>`.
- **Event-Driven Cache Invalidation**: Whenever a post is published, updated, or moderated in a city, `invalidateFeed(city)` immediately evicts stale feed pages from Redis.
- **Resilient Fallback**: Transparently swaps to an in-memory LRU cache if Redis is temporarily unreachable.

### 4. 👷 Asynchronous Notification Queue & Worker
Located in [`src/queue/notification-queue.ts`](src/queue/notification-queue.ts) and [`src/queue/worker.ts`](src/queue/worker.ts):
- **Background Decoupling**: Critical operations (e.g., submitting a post report, approving a flagged post, broadcasting emergency alerts) do not block the HTTP client. They are enqueued immediately.
- **Exponential Backoff**: Automatic retry mechanism (up to 3 attempts) with retry delays.
- **Notification Persistence**: Alerts are delivered to the recipient's inbox and logged in the audit trail.

### 5. 🌐 Supported Languages (Bharat-First)
| Code | Language | Native Script |
|:----:|:--------:|:-------------:|
| `hi` | Hindi | हिन्दी |
| `en` | English | English |
| `ta` | Tamil | தமிழ் |
| `te` | Telugu | తెలుగు |
| `kn` | Kannada | ಕನ್ನಡ |
| `mr` | Marathi | मराठी |
| `bn` | Bengali | বাংলা |
| `gu` | Gujarati | ગુજરાતી |
| `ml` | Malayalam | മലയാളം |
| `pa` | Punjabi | ਪੰਜਾਬੀ |

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (>= v18, tested on v22) & npm
- Docker & Docker Compose (optional for containerized setup)

### Option A: Local Standalone Development (Zero-Setup)
Bharat Local has a built-in resilient database and cache fallback adapter with realistic multilingual seed data, allowing immediate local execution even before starting Postgres or Redis!

```bash
# 1. Clone repository and navigate to folder
cd bharat-local

# 2. Install dependencies
npm install

# 3. Run development server (with live reload)
npm run dev
```

Visit the services in your browser:
- 🌐 **Interactive Web App**: [http://localhost:5000](http://localhost:5000)
- 📑 **OpenAPI / Swagger Explorer**: [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
- ⚡ **System Healthcheck**: [http://localhost:5000/health](http://localhost:5000/health)

---

### Option B: Production Docker Compose

Runs PostgreSQL 16 (with persistent volume and init SQL), Redis 7 Alpine, and the Bharat Local API in isolated containers:

```bash
# Start all containers in the background
docker-compose up -d --build

# View container status
docker-compose ps

# View application logs
docker-compose logs -f app
```

To stop the containers:
```bash
docker-compose down
```

---

## 🧪 Running Automated Tests

Bharat Local includes a full test suite testing Authentication, Hyperlocal Feeds, Redis Caching, Post Lifecycles, and RBAC Moderation:

```bash
# Run unit & integration tests
npm test

# Run TypeScript typechecker
npm run lint
```

**Test Coverage Summary:**
- `tests/auth.test.ts`: Phone validation, OTP generation, verification, JWT signing, profile retrieval.
- `tests/feed.test.ts`: Location queries, language filtering, Redis cache hit/miss assertions.
- `tests/posts.test.ts`: Post creation, 6-digit Indian PIN code validation, post reporting.
- `tests/moderation.test.ts`: 403 Forbidden checks for regular users, moderation queue resolution, admin district emergency broadcast.

---

## 📚 REST API Reference

All API routes are prefixed with `/api/v1`.

### 1. Authentication & Profiles (`/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/request-otp` | Public | Send OTP to 10-digit Indian mobile number |
| `POST` | `/api/v1/auth/verify-otp` | Public | Verify OTP and return JWT Bearer token |
| `GET` | `/api/v1/auth/me` | Bearer | Get current authenticated user profile |
| `PUT` | `/api/v1/auth/me` | Bearer | Update user preferred language & location |
| `GET` | `/api/v1/auth/demo-personas` | Public | Get test personas (Admin, Moderator, Citizens) |

### 2. Hyperlocal Feed & Categories (`/feed`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/feed` | Optional | Get paginated community feed with Redis caching |
| `GET` | `/api/v1/feed/categories` | Public | List categories with multilingual labels |
| `GET` | `/api/v1/feed/languages` | Public | List supported Indian languages |

**Query Parameters for `/api/v1/feed`:**
- `city`: e.g. `Jaipur`, `Bengaluru`, `Chennai`
- `locality`: e.g. `Indiranagar`, `C-Scheme`
- `category`: `announcements`, `services`, `emergency`, `help_wanted`, `buy_sell`, `events`, `lost_found`
- `language`: `hi`, `en`, `ta`, `kn`, etc.
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)
- `sort`: `latest`, `popular`, `oldest`

### 3. Posts Management (`/posts`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/posts` | Bearer | Create a new community post |
| `GET` | `/api/v1/posts/:id` | Public | Retrieve post details & increment view count |
| `PUT` | `/api/v1/posts/:id` | Bearer | Update post (Author or Moderator/Admin) |
| `DELETE` | `/api/v1/posts/:id` | Bearer | Delete post (Author or Moderator/Admin) |
| `POST` | `/api/v1/posts/:id/report` | Bearer | Report post (Enqueues async alert to moderators) |

### 4. Search (`/search`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/search?q=...` | Public | Multilingual full-text search with location filters |

### 5. Moderation Desk (`/moderation`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/moderation/reports` | Moderator / Admin | View reported posts queue |
| `POST` | `/api/v1/moderation/posts/:id/action` | Moderator / Admin | Approve, Reject, or Hide reported post |
| `POST` | `/api/v1/moderation/broadcast` | Admin Only | Broadcast district alert to all residents |
| `GET` | `/api/v1/moderation/stats` | Moderator / Admin | Community health, cache & queue metrics |

### 6. Notifications (`/notifications`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | Bearer | Retrieve user notification inbox |
| `PATCH` | `/api/v1/notifications/:id/read` | Bearer | Mark notification as read |
| `GET` | `/api/v1/notifications/queue-status` | Bearer | Background worker queue statistics |

---

## 🛠️ Testing via cURL

### 1. Request OTP & Login
```bash
# Request OTP
curl -X POST http://localhost:5000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

# Verify OTP (Dev OTP: 123456)
curl -X POST http://localhost:5000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456", "city": "Bengaluru"}'
```

### 2. Fetch Hyperlocal Feed (Notice Redis Cache Header)
```bash
curl -X GET "http://localhost:5000/api/v1/feed?city=Jaipur&language=hi"
```

### 3. Report a Post
```bash
curl -X POST "http://localhost:5000/api/v1/posts/<POST_ID>/report" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "spam", "details": "Repeated promotional advertisement"}'
```

---

## 📂 Project Structure

```
bharat-local/
├── src/
│   ├── config/
│   │   ├── constants.ts          # Indian languages, categories, roles & cache keys
│   │   └── env.ts                # Strongly typed environment configuration
│   ├── db/
│   │   ├── schema.sql            # PostgreSQL DDL, constraints, composite & GIN indexes
│   │   ├── schema.ts             # TypeScript interfaces for database models
│   │   ├── connection.ts         # pg connection pool with error recovery
│   │   ├── database-adapter.ts   # Unified database adapter (PostgreSQL + resilient fallback)
│   │   ├── memory-db.ts          # Fast in-memory datastore with seeded Indian city posts
│   │   └── seed.ts               # Standalone database seeder
│   ├── cache/
│   │   ├── redis.ts              # ioredis client with memory fallback
│   │   └── cache-service.ts      # Multi-level cache get/set/del & feed invalidation
│   ├── queue/
│   │   ├── notification-queue.ts # Asynchronous job queue with retry logic
│   │   └── worker.ts             # Background worker executing alerts & notifications
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification & request user extraction
│   │   ├── rbac.ts               # Role-based access control (User, Moderator, Admin)
│   │   ├── validate.ts           # Zod schema validation for body & query
│   │   ├── rate-limiter.ts       # Rate limiting rules for API & auth endpoints
│   │   └── error-handler.ts      # Standardized REST error response handler
│   ├── modules/
│   │   ├── auth/                 # OTP verification, user profiles & test personas
│   │   ├── feed/                 # Hyperlocal feed with Redis caching
│   │   ├── posts/                # Post CRUD, validation & reporting
│   │   ├── search/               # Multilingual full-text search
│   │   ├── moderation/           # Moderator desk, queue review & district alerts
│   │   └── notifications/        # User inbox & queue execution telemetry
│   ├── public/                   # Interactive Web App UI (HTML, CSS, JS)
│   ├── docs/
│   │   └── swagger.json          # Complete OpenAPI 3.0 specification
│   ├── app.ts                    # Express application setup
│   └── server.ts                 # HTTP server bootstrap & graceful shutdown
├── tests/
│   ├── auth.test.ts              # Authentication & user profile tests
│   ├── feed.test.ts              # Feed & Redis cache hit/miss tests
│   ├── posts.test.ts             # Post lifecycle & validation tests
│   └── moderation.test.ts        # RBAC permissions & moderation tests
├── Dockerfile                    # Multi-stage production container
├── docker-compose.yml            # Postgres 16, Redis 7 & Bharat Local App
├── package.json
└── README.md
```

---

## 🇮🇳 License
MIT License. Built with pride for Bharat's hyperlocal communities.
