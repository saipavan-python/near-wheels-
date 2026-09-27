# Contributing to Near Wheels

Thanks for looking at this. It's a real project with real users, so a few ground rules
make contributions land faster.

## Before you start

- Check existing issues — someone may already be working on it
- For anything beyond a small fix, open an issue first so we can agree on the approach
- Comment on the issue you intend to work on, so two people don't build the same thing

## Getting set up

Requires **Node 20+** and a **PostgreSQL** database (a free Supabase project works).

```bash
git clone https://github.com/saipavan-python/near-wheels.git
cd near-wheels
npm ci
cp .env.example .env
```

Minimum `.env` for local work:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
SESSION_SECRET="<64-char random hex>"
ADMIN_PHONE="8096327356"
ADMIN_PASSWORD="pick-a-local-password"
```

Then:

```bash
npx prisma db push     # create schema
npm run db:seed        # admin + subscription plans
npm run dev
```

If you'd rather not install Postgres, `docker compose up -d` brings up the app and a
database together.

## The one rule that matters

**A pull request that fails CI will not be merged.** Before you push:

```bash
npm test          # 79 tests
npm run typecheck # must be clean
npm run build     # must succeed
```

`npm run build` succeeding with **no** `RAZORPAY_*` or `GEMINI_API_KEY` variables set is
a deliberate CI check, not an oversight. Don't read a credential at module load — use the
lazy accessors in `src/lib/services/razorpayClient.ts` and the `hasX()` guards elsewhere.
Reading `process.env` at import time is what breaks credential-less builds.

## Code layout

| Directory | Owns |
|---|---|
| `src/app/**/route.ts` | HTTP concerns only — parse input, authorize, delegate, respond |
| `src/lib/services/` | Business logic and transactions |
| `src/lib/auth/` | Session signing, password hashing, role checks |
| `prisma/schema.prisma` | Data model — changes here need a `db push` note in the PR |
| `test/` | Vitest specs, mirroring the `src` tree |

The split between route handlers and services is load-bearing. Services must stay
testable without booting Next.js, so **no `next/*` imports in `src/lib/services/`**.
If you need to write a test, put the logic in a service.

## Writing tests

Vitest, mirroring the source tree:

```
src/lib/services/__tests__/paymentGuard.test.ts
src/lib/services/bookingState.test.ts
```

Cover the state machine transitions, the money paths, and anything that can be raced.
Pure functions are easiest — a service that takes input and returns output needs no
mocking.

## Commit messages

Conventional Commits, matching the existing history:

```
feat: add provider payout export
fix: prevent double-credit on replayed webhook
perf: index Booking(status, holdExpiresAt)
security: re-validate admin role against the DB
test: cover garage hours across midnight
docs: document the Cloud Storage volume recipe
```

## AI-generated pull requests

**Please do not submit AI-generated pull requests.**

This is a real, small project maintained in someone's spare time. Bulk auto-generated
PRs are unreviewable — I cannot verify intent, and low-quality contributions cost more
time to reject than useful ones cost to accept. Issues and discussions where you use AI
as a thinking partner are genuinely welcome, and so is a human-written PR that happens to
have been drafted with a tool. What I'm asking for is that you understand and can defend
every line you send.

## Security

**Do not report vulnerabilities in a public issue.** See [SECURITY.md](SECURITY.md).

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Contributions are accepted under the [MIT License](LICENSE).
