<div align="center">

# Near Wheels

**A marketplace platform for India's road-transport and agri-services economy — ride sharing, vehicle rentals, garages, driving schools, drone spraying, and bus operators in one Next.js app.**

[![Next.js](https://img.shields.io/badge/Next.js%2014-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![CI](https://github.com/saipavan-python/near-wheels/actions/workflows/ci.yml/badge.svg)](https://github.com/saipavan-python/near-wheels/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-79%20passing-brightgreen?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)
[![Made with Supabase](https://supabase.com/badge-made-with-supabase.svg)](https://supabase.com)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/saipavan-python/near-wheels)

</div>

---

## What this is

Most marketplace demos stop at "listings and bookings." Near Wheels is a **multi-sided marketplace** where the same user can be a customer, a driver, a garage, a driving school, a drone operator, and a bus operator — each with its own onboarding, dashboard, pricing, and payout path.

Seven distinct service verticals share one auth system, one booking engine, one payment layer, and one admin panel:

| Vertical | What it does |
|---|---|
| **Share My Ride** | Carpooling with per-seat pricing and driver commission |
| **Vehicle rentals** | Owner-listed vehicles, availability calendar, booking requests |
| **Garages** | Location-based garage discovery with working-hours logic |
| **Driving schools** | Course enquiry, learner bookings, instructor management |
| **Drone spraying** | Agri-service booking for pesticide/fungicide application |
| **Yatra buses** | Intercity bus operator listings and seat booking |
| **Farm services** | Tractor and agri-equipment on-demand services |

### The parts that are actually hard

This is not a CRUD tutorial. The non-obvious work:

- **Concurrency-safe booking.** Two people booking the last slot of a vehicle is a real race. Booking creation runs inside a transaction with a `SELECT … FOR UPDATE` row lock, so the second request loses cleanly instead of double-booking.
- **Idempotent payment verification.** Razorpay webhooks replay and users double-tap. Settlement is idempotent, the captured amount is validated against the **backend-computed** total (never a client-sent number), capture is resolved via `orders.fetchPayments` because an order ID is not a payment ID, and a refund only marks `REFUNDED` after the gateway accepts it.
- **Session authorization that survives demotion.** Admin routes re-validate role *and* user status against the database on every request. A suspended admin loses access immediately, not when their cookie expires.
- **Rate limiting that resists spoofing.** The client IP is read from the **rightmost** `x-forwarded-for` entry, because a load balancer appends the real client IP last. Trusting the leftmost entry — the naive implementation — lets an attacker bypass limits by sending a fake header.
- **Uploads are validated by magic bytes**, then re-encoded to WebP through `sharp` with graceful fallback, so a mislabeled file cannot masquerade as an image.
- **The app builds with no payment credentials.** Razorpay is constructed lazily behind `hasRazorpayCreds()`. Constructing the SDK at module load with empty keys throws, which breaks `next build` on any environment that hasn't been configured yet. This is the bug that keeps biting CI.

### Scale of the codebase

- **73 API route handlers** across bookings, payments, auth, admin, providers, share-rides, and AI
- **79 unit tests** covering the rate limiter, password hashing, OTP flow, booking state machine, payment settlement logic, garage hours, and location dedupe
- **Multi-region SEO** — per-city location pages with `hreflang`, canonicals, `noindex` on private routes, and structured data

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components, route handlers, per-route caching control |
| Language | TypeScript 5 | `strict` across the whole surface |
| Database | PostgreSQL + Prisma 5.22 | Relational integrity for bookings and payouts |
| Auth | `jose` JWT + scrypt | Stateless sessions, no auth framework lock-in |
| Payments | Razorpay | India's standard; orders + webhooks + refunds |
| Validation | Zod | Every request body and env value |
| Images | `sharp` | Server-side re-encode to WebP |
| AI | Gemini | Trip suggestions and planning assistance |
| Styling | Tailwind CSS | Utility-first, no runtime CSS cost |
| Animation | Framer Motion | Shared-ride live tracking |
| Tests | Vitest | 79 tests, ~11s |
| Deploy | Docker, Cloud Run, Vercel, Render | Same repo, four targets |

---

## Quick start

### One command (Docker)

The fastest path to a fully working stack — app plus Postgres plus seeded data:

```bash
git clone https://github.com/saipavan-python/near-wheels.git
cd near-wheels
cp .env.example .env        # then edit DATABASE_URL and SESSION_SECRET
docker compose up -d
```

Open http://localhost:3000.

### Local development

Requires Node 20+ and a PostgreSQL database.

```bash
git clone https://github.com/saipavan-python/near-wheels.git
cd near-wheels
npm ci
cp .env.example .env        # fill in DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD
npx prisma db push          # create the schema
npm run db:seed             # admin account + subscription plans
npm run dev
```

Verify:

```bash
npm test          # 79 tests
npm run typecheck # tsc --noEmit
npm run build     # production build
```

### Demo credentials

The seed creates one admin account, using the values from your `.env`:

| Field | Source |
|---|---|
| Phone | `ADMIN_PHONE` (default `8096327356`) |
| Password | `ADMIN_PASSWORD` |

Customer and provider accounts are created through the signup flow at `/register`. The seed deliberately does **not** create fake providers or listings, so it never pollutes a production database.

> Change `ADMIN_PASSWORD` before exposing any deployment publicly. The admin panel is at `/admin`.

---

## Deploying

Your database is the only hard requirement. Everything else is in this repo.

| Target | Command | Notes |
|---|---|---|
| **Render** | Use the button above | Easiest. Provisions Postgres alongside via blueprint. |
| **Vercel** | `npx vercel --prod` | Set env vars from `.env.example`. |
| **Google Cloud Run** | `gcloud run deploy near-wheels --source .` | Needs a billing-enabled GCP project. See [DEPLOY.md](DEPLOY.md). |
| **Docker anywhere** | `docker build -t near-wheels . && docker run -p 3000:8080 near-wheels` | Multi-stage, non-root, standalone output. |

### Required environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `SESSION_SECRET` | **yes** | 64-char random hex. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_PHONE` | yes | Seeded admin login |
| `ADMIN_PASSWORD` | yes | Change this |
| `GEMINI_API_KEY` | no | AI features degrade gracefully when absent |
| `RAZORPAY_KEY_ID` | no | Without it, payments run in simulated mode |
| `RAZORPAY_KEY_SECRET` | no | Same |
| `RAZORPAY_WEBHOOK_SECRET` | no | Required for real payment verification |
| `PAYMENT_MODE` | no | `razorpay` or `simulated` (default) |
| `UPLOAD_DIR` | no | Defaults to `data/uploads`. On Cloud Run use `/tmp/uploads`. |

> **Before any public deployment:** OTP SMS is not wired to a provider yet — codes fall back to console logging, which no end user can see. Add MSG91, Twilio, or Fast2SMS in `src/lib/services/sms.ts` or login is impossible for real people. See [DEPLOY.md](DEPLOY.md) for the full pre-launch checklist.

### Health checks

| Endpoint | Purpose |
|---|---|
| `/api/health` | Liveness — process is up |
| `/api/readyz` | Readiness — database responds |

---

## Project layout

```
src/
  app/
    api/              73 route handlers
      auth/           OTP login, registration, sessions
      bookings/       creation, state machine, cancellation
      payments/       Razorpay initiate, verify, webhook
      share-rides/    carpool offers, search, commission
      admin/          role-gated moderation and payouts
      ai/             Gemini trip planning
      upload/         magic-byte validation + WebP encode
    locations/[slug]/ per-city SEO pages
    providers/        multi-vertical provider onboarding
  lib/
    services/         business logic (payments, bookings, notifications, audit)
    auth/             session signing, scrypt hashing
  prisma/schema.prisma
test/                 79 Vitest specs
```

Business logic lives in `src/lib/services/`, deliberately separated from route handlers. Handlers parse and authorize; services own the transactions. That split is what makes the payment and booking logic testable without booting Next.js.

---

## Security notes

Built in, not bolted on:

- Session cookies flip to `Secure` in production
- `Strict-Transport-Security` in production responses
- `noindex` on every authenticated route so private pages stay out of search results
- Provider registration commits provider, profile, pricing, and subscription in **one** transaction — no half-registered state
- Consumed OTP codes are purged on a schedule
- `x-request-id` is assigned and echoed on every request for log correlation
- Admin authorization re-checks the database, not just the token

Known gaps are tracked honestly in [DEPLOY.md](DEPLOY.md) — in-memory rate limiting across replicas, no CSP header yet, no server-side session revocation.

---

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first — it explains the code layout, the test requirement, and the AI-generated-PR policy.

Looking for a starting point? Issues labelled [`good first issue`](https://github.com/saipavan-python/near-wheels/labels/good%20first%20issue) are scoped to be genuinely small.

---

## License

[MIT](LICENSE) © 2026 Sai Pavan Kistamsetty

This project is not affiliated with, endorsed by, or sponsored by any vehicle manufacturer, ride-hailing company, or payment provider whose name appears in the source.
