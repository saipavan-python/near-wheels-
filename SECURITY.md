# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security bug.**

Email **saipavankistamsetty@gmail.com** with:

- what the issue is
- how to reproduce it
- which endpoint or file is involved
- the impact you believe it has

I'll aim to acknowledge within 72 hours. If a fix is warranted I'll ship a patch and
credit you in the release notes unless you'd rather stay anonymous.

## Supported versions

This project is pre-1.0 and actively developed. Only the latest `master` receives
security fixes — there are no backports to older commits.

## Scope

In scope:

- Authentication bypass or session forgery
- Authorization flaws, including privilege escalation to an admin role
- Payment manipulation — incorrect amounts, double credits, unverified captures
- Injection (SQL, XSS, path traversal) in server routes
- IDOR — reading or mutating another user's bookings, payouts, or documents
- Secrets exposure in committed code, build artifacts, or client bundles
- Upload validation bypass

Out of scope:

- Findings that require an already-compromised account
- Denial of service through volumetric traffic
- Missing hardening headers with no demonstrated impact
- Reports against the self-hosted infrastructure of a deployer rather than this code
- Automated scanner output with no demonstrated exploitation path

## Threat model

This app handles real money: Razorpay payments, provider commissions, and admin payouts.
It also holds PII — phone numbers, addresses, and booking history. Treat both as
sensitive.

Deliberate design decisions worth knowing when assessing a report:

- **Sessions are stateless HMAC cookies.** There is no server-side revocation list, so a
  stolen cookie remains valid until it expires. This is a known gap, tracked in
  [DEPLOY.md](DEPLOY.md).
- **Rate limiting is in-memory per instance.** Behind multiple replicas the limit can be
  spread across instances. Move to Redis if you need a hard bound.
- **The admin panel re-validates role and user status against the database on every
  request**, so a demoted admin loses access immediately rather than at cookie expiry.
- **Captured payment amounts are validated against the backend-computed booking total**,
  never against a client-supplied figure.
- **OTP codes are stored hashed, single-use, and purged after consumption.**

If you find a way around any of these, that is a genuine finding — please report it.
