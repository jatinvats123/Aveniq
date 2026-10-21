# Aveniq

A full-stack e-commerce marketplace where sellers list products with variants and buyers check out through Razorpay.

[![CI](https://github.com/jatinvats123/Aveniq/actions/workflows/ci.yml/badge.svg)](https://github.com/jatinvats123/Aveniq/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a)
![License](https://img.shields.io/badge/license-MIT-blue)

**[Live demo](https://aveniq-sooty.vercel.app/)** · API docs available at `/api/docs` (Swagger UI, enabled outside production)

---

## Overview

Aveniq is a MERN marketplace with two distinct user journeys. Sellers register, list products with multiple variants (size, colour, price) and up to seven images per product served from a CDN. Buyers browse the catalog, add specific variants to a cart, and complete payment through Razorpay with server-side signature verification.

The backend is deliberately layered. Routes stay thin, validation runs before controllers, business logic sits in services, and all database access is isolated behind a data-access layer. Each concern can change without touching the others — the payment provider could be swapped without editing a single controller.

Authentication uses JWTs delivered as HTTP-only cookies rather than `localStorage`, which removes an entire class of XSS token-theft attacks. Google OAuth 2.0 is supported alongside email/password.

## Features

**Authentication & authorization**

- Email/password registration with server-side validation
- Google OAuth 2.0 sign-in via Passport
- JWT issued as an HTTP-only, secure, SameSite cookie
- Forgot-password and token-based reset over SMTP
- Role-based access control separating buyer and seller capabilities
- Ownership enforcement — a seller cannot read or mutate another seller's resources

**Seller**

- Create products with up to 7 images per upload
- Add and remove variants with independent pricing
- Manage own listings and view orders containing own products

**Buyer**

- Browse catalog with filtering and pagination
- Variant-level cart with increment, decrement, and remove
- Razorpay checkout with signature verification and payment-failure handling
- Stock is decremented atomically inside the order transaction, so the last unit can't be oversold
- Order history and order detail

**Production**

- Helmet, rate limiting, request sanitisation, CORS allow-list
- Centralised error handling with consistent error envelopes
- Structured JSON logging with per-request correlation IDs
- Health and readiness endpoints
- 71 integration tests running in CI

## Tech stack

| Layer    | Technologies                                                          |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, Redux Toolkit, React Router 7, Tailwind CSS 4, Vite, Axios |
| Backend  | Node.js 20, Express 5, MongoDB, Mongoose                             |
| Auth     | JWT, bcryptjs, Passport (Google OAuth 2.0), express-validator        |
| Payments | Razorpay                                                             |
| Media    | Multer, ImageKit CDN                                                 |
| Email    | Nodemailer over SMTP                                                 |
| Testing  | Jest, Supertest, mongodb-memory-server                              |
| Ops      | Docker, Docker Compose, GitHub Actions, Pino                        |

## Architecture

```
                    ┌──────────────┐
   Browser ───────► │  React SPA   │  Redux Toolkit · feature-sliced
                    └──────┬───────┘
                           │ HTTPS · HTTP-only cookie
                           ▼
                    ┌──────────────┐
                    │  Express API │
                    └──────┬───────┘
                           │
   ┌───────────────────────┼───────────────────────┐
   │                       │                       │
   ▼                       ▼                       ▼
routes/               middleware/              validator/
thin routing        JWT + role checks       express-validator
   │                       │                       │
   └───────────────────────┼───────────────────────┘
                           ▼
                     controller/        orchestration, response shaping
                           ▼
                 services/ · dao/       integrations · database access
                           ▼
                       models/          Mongoose schemas
                           ▼
                    ┌──────────────┐
                    │   MongoDB    │
                    └──────────────┘

External: ImageKit (media) · Razorpay (payments) · SMTP (email)
```

A request passes validation and authentication before reaching a controller, so controllers can assume a valid, authorised request. Errors thrown anywhere bubble to a single error middleware.

## Folder structure

```
aveniq/
├── backend/
│   ├── server.js                 # process entry, signal handling
│   └── src/
│       ├── app.js                # express app assembly, middleware chain
│       ├── config/               # env validation, db, razorpay, logger
│       ├── routes/               # thin route definitions
│       ├── validator/            # express-validator rule sets
│       ├── middleware/           # auth, rbac, error handler, rate limits
│       ├── controller/           # request orchestration
│       ├── services/             # business logic, external integrations
│       ├── dao/                  # database access, owner scoping
│       ├── models/               # mongoose schemas + indexes
│       ├── docs/                 # OpenAPI spec (Swagger UI)
│       └── utils/                # AppError, asyncHandler, mailer
│   └── tests/                    # integration + unit tests
│
├── frontend/
│   └── src/
│       ├── app/                  # App shell, routes, store
│       ├── components/           # shared presentational components
│       └── features/
│           ├── auth/             # pages, hooks, services, slice
│           ├── cart/
│           ├── orders/
│           └── products/
│
├── docs/
│   ├── adr/                      # architecture decision records
│   └── PRODUCTION-READINESS.md
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

## Setup

**Prerequisites:** Node.js 20+, npm 10+, and either Docker or a MongoDB replica set (order creation uses a transaction, which requires a replica set — MongoDB Atlas is one).

```bash
git clone https://github.com/jatinvats123/Aveniq.git
cd Aveniq
```

### Option A — Docker (recommended)

Docker Compose brings up the API, the web app, and a single-node MongoDB replica set.

```bash
cp backend/.env.example backend/.env      # fill in values
docker compose up --build                 # web on http://localhost:5173
```

### Option B — local

```bash
npm run install:all                       # installs root + both workspaces
cp backend/.env.example backend/.env      # fill in values
npm run dev                               # api :3000, web :5173
```

> The frontend needs no `.env` — it calls the API at the same origin under `/api`, proxied to the backend by the Vite dev server locally and by Vercel rewrites in production.

### Common scripts

```bash
npm run dev            # both packages in watch mode
npm test               # backend test suite (Jest, with coverage)
npm run lint           # eslint across backend + frontend
npm run format:check   # prettier check
npm run build          # production build of the frontend
```

## Environment variables

### `backend/.env`

**Required** — the server refuses to start if any of these is missing:

| Variable               | Description                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| `MONGO_URI`            | MongoDB connection string. Must point at a replica set            |
| `JWT_SECRET`           | Signing secret for JWTs. Use a long, random string                |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                            |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                        |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key (used to upload product images)              |
| `SMTP_HOST`            | SMTP host                                                         |
| `SMTP_USER`            | SMTP username                                                     |
| `SMTP_PASS`            | SMTP password                                                     |
| `EMAIL_FROM`           | "From" address for outgoing email                                 |
| `CLIENT_URL`           | Absolute frontend URL (CORS, OAuth redirects, password-reset links) |
| `RAZORPAY_KEY_ID`      | Razorpay key ID (publishable)                                     |
| `RAZORPAY_KEY_SECRET`  | Razorpay secret — server only                                     |

**Optional** (defaults shown):

| Variable              | Default                              | Description                              |
| --------------------- | ------------------------------------ | ---------------------------------------- |
| `PORT`                | `3000`                               | API port                                 |
| `NODE_ENV`            | `development`                        | `development` \| `production` \| `test`  |
| `JWT_EXPIRES_DAYS`    | `7`                                  | Auth token / cookie lifetime in days     |
| `SMTP_PORT`           | `587`                                | SMTP port (`465` uses implicit TLS)      |
| `CORS_ORIGINS`        | falls back to `CLIENT_URL`           | Comma-separated CORS allow-list          |
| `GOOGLE_CALLBACK_URL` | relative `/api/auth/google/callback` | Absolute OAuth callback URL              |
| `LOG_LEVEL`           | `info`                               | Pino level: `trace`…`error` \| `silent`  |

### `frontend/.env`

The frontend needs **no runtime environment variables** — it talks to the API at the same origin under `/api` (proxied in dev and prod), and the Razorpay publishable key is delivered by the server at checkout. Remember that Vite only exposes `VITE_`-prefixed variables to the browser bundle, so never put secrets there.

> Never commit `.env`. Only `.env.example` is tracked.

## Future improvements

- Product search backed by a proper text index or a dedicated search service
- Seller payouts and settlement reporting
- Stock reservation at checkout (with release/expiry) to close the paid-but-out-of-stock refund gap
- Review and rating system with verified-purchase gating
- Automated refund and return workflow through the Razorpay refunds API
- Redis caching for the catalog with event-driven invalidation
- Migration of the order domain to a state machine with an audit trail

## License

Released under the MIT License. See [LICENSE](LICENSE).

## Contact

**Jatin Vats** — Full Stack Developer, Delhi, India
[GitHub](https://github.com/jatinvats123)
