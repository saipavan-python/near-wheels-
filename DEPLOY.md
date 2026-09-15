# Hosting Near Wheels on Google Cloud (Run + Neon Postgres)

## What is ALREADY ready
- Production build passes (`npm run build`), all routes compile
- Dockerfile + .dockerignore for Cloud Run / any container host
- Schema works on **both SQLite and PostgreSQL** (no code change needed)
- Session cookies auto-switch to `Secure` in production
- OTP, bookings, payments, admin — all APIs verified working

---

## BLOCKERS you must finish BEFORE real users
| # | Item | Why | How |
|---|------|-----|-----|
| 1 | **SMS provider for OTP** | In production the OTP is stored in DB but never sent to phones | Add MSG91 / Twilio / Fast2SMS: call their API inside `src/app/api/auth/otp/route.ts`, put API key in env |
| 2 | **Real payment gateway** | Payments are simulated (`sim_...` refs) | Razorpay: create order in `initiatePayment`, verify signature in `verifyPayment` |
| 3 | **Strong `SESSION_SECRET`** | Falls back to a dev default | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## Deploy steps (Google Cloud Run)

### 1. Create the database (free tier OK)
- Go to https://neon.tech or https://supabase.com → create project → copy the **PostgreSQL connection string**

### 2. Push schema to it (from your PC)
```powershell
$env:DATABASE_URL = "postgresql://user:pass@host/db?sslmode=require"
npx prisma db push
npm run db:seed     # optional demo data
```

### 3. Install Google Cloud CLI → login → enable services
```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.cloudbuild.gserviceaccount.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

### 4. Deploy (builds the Dockerfile in the cloud)
```powershell
gcloud run deploy near-wheels --source . --region asia-south1 --allow-unauthenticated --set-env-vars "DATABASE_URL=postgresql://...","SESSION_SECRET=your-long-secret","ADMIN_PHONE=yourphone","ADMIN_PASSWORD=strongpassword","GEMINI_API_KEY=yourkey"
```

You get a URL like `https://near-wheels-xxxx.a.run.app` with free HTTPS. Done.

> **Easier alternative:** Vercel (vercel.com) — push code to GitHub → Import → paste env vars → Deploy. No Docker needed; free SSL + CDN.

---

## Env vars summary (set at deploy time)
| Key | Example |
|-----|---------|
| DATABASE_URL | postgresql://…?sslmode=require |
| SESSION_SECRET | 64-char random hex |
| ADMIN_PHONE | your phone |
| ADMIN_PASSWORD | strong password |
| GEMINI_API_KEY | from aistudio.google.com |
| PAYMENT_MODE | gateway (later) |

## Pre-launch hygiene
- [ ] Change admin password from the seed default
- [ ] Delete demo data (`npm run db:reset` clears; or skip seeding)
- [ ] Point a custom domain (Cloud Run → Domain mappings / Vercel → Domains)
- [ ] Enable Cloud Run request logging & billing alerts
- [ ] Set `PAYMENT_MODE=razorpay` + Razorpay creds, and configure the webhook URL → `https://yourdomain/api/payments/razorpay/webhook`

---

## Production hardening status (applied)

Applied during the production-readiness pass:

- **Payments (P0)** — verification is now idempotent (webhook replays / double-taps can't double-credit a commission or payout), the captured amount is validated against the backend-computed booking total, Razorpay capture is resolved via `orders.fetchPayments` (order id ≠ payment id), and refunds only mark `REFUNDED` after the gateway accepts them.
- **Booking races (P0)** — concurrent booking attempts for the same listing are serialized with a `SELECT … FOR UPDATE` lock inside the creation transaction.
- **Admin auth (P0)** — `/api/admin/*` now re-validates the session role and user status against the DB on every request; a demoted/suspended admin loses access immediately.
- **Indexes (P1)** — added `Booking(status, holdExpiresAt)`, `Payment(gatewayRef)`, `OtpCode(phone, consumed)` + `(createdAt)`. Applied to the live DB via `prisma db push`.
- **Rate limiting (P1)** — `getClientIp` now trusts the rightmost `x-forwarded-for` entry (the load balancer-appended real client IP) so spoofing the first entry no longer bypasses limits.
- **Headers (P1)** — `Strict-Transport-Security` (prod only) added; uploads already validated magic bytes + re-encode via sharp.
- **Atomic provider registration (P1)** — provider + profile + pricing + subscription now commit in a single transaction.
- **Health (P2)** — `/api/health` (liveness) and `/api/readyz` (DB ping) endpoints; Dockerfile now has a `HEALTHCHECK` and no longer runs `prisma db push` on every cold start (schema is pushed in CI before deploy).
- **Request IDs (P1)** — a `middleware.ts` assigns/echoes `x-request-id` on every request for log correlation.
- **OTP hygiene (P2)** — consumed OTP codes are purged periodically.
- **Tests** — `npm test` (vitest, 21 unit tests) covers the rate limiter, session/password helpers, booking state machine, and payment settled/amount logic.

## Production backlogs (P3 — document only, do not build yet)

- **Rate limiting on multiple instances** — the limiter is in-memory per instance. Behind a multi-replica Cloud Run service an attacker can spread requests across instances; move to Redis/Upstash when traffic justifies it.
- **Server-side sessions / revocation** — the `Session` table exists but logins use stateless HMAC cookies (30-day expiry, no refresh or server-side revoke). A stolen cookie can't be invalidated today. Options: extend `Session` to record token hashes and check them on sensitive actions, add refresh rotation, and logout-revocation.
- **Metrics & monitoring** — no Prometheus/Grafana or alerts beyond Cloud Run's built-in logs. Expose counters (requests, errors, payment outcomes) and set up uptime/billing/error-rate alerts before real scale.
- **Content-Security-Policy** — not yet set (needs testing against Razorpay checkout, inline scripts, and `images.unoptimized`). Add after confirming the checkout flow works under it.
- **Background jobs** — `expireStaleHolds` and similar sweeps run only on demand; a scheduled job (Cloud Scheduler hitting `/api/readyz` or a dedicated admin sweep endpoint) bounds stale bookings.
- **Caching** — no shared cache. Add `Cache-Control` for public listing pages and, if read traffic grows, a Redis read-through cache for search.
- **Connection pool** — Prisma uses the URL default pool; pin `?connection_limit=N` (≤ DB max_connections ÷ instances) as traffic grows.
- **Queues / events** — notifications/payouts are inline; for heavy load move them behind a queue (Cloud Tasks / BullMQ + Redis). Kafka-style streaming is explicitly out of scope.
