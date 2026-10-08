# 📋 Deployment Checklist

## Pre-Deployment (Do This First)

- [ ] Read `SETUP_GUIDE.md` (5 min read)
- [ ] Create Supabase account at https://supabase.com
- [ ] Create Supabase project and save database password
- [ ] Get PostgreSQL connection string from Supabase
- [ ] Generate `SESSION_SECRET` using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Vercel Deployment

- [ ] Push code to GitHub
- [ ] Create account at https://vercel.com
- [ ] Connect GitHub repo to Vercel
- [ ] Add environment variables in Vercel:
  - [ ] `DATABASE_URL` (from Supabase)
  - [ ] `SESSION_SECRET` (generated 64-char hex)
  - [ ] `ADMIN_PHONE` = `8096327356`
  - [ ] `ADMIN_PASSWORD` = `Admin@12345` (change this!)
  - [ ] `PAYMENT_MODE` = `simulated`
  - [ ] `FREE_MODE` = `on`
- [ ] Deploy (Vercel builds automatically)
- [ ] Wait for ✅ "Production" status (2-3 min)
- [ ] Note Vercel URL: `https://near-wheels-XXXXX.vercel.app`

## Local Database Setup

- [ ] Clone repo: `git clone https://github.com/saipavan-python/near-wheels-.git`
- [ ] Create `.env.local` with database URL from Supabase
- [ ] Run: `npm ci`
- [ ] Run: `npx prisma db push` (creates tables)
- [ ] Run: `npm run db:seed` (creates admin account)
- [ ] Test locally: `npm run dev` → http://localhost:3000

## Verification

- [ ] Visit Vercel URL
- [ ] Admin login: `/admin` with `8096327356` / `Admin@12345`
- [ ] Create test customer account at `/register`
  - [ ] Find OTP in Vercel Function Logs (see SETUP_GUIDE.md Step 6)
  - [ ] Complete registration
- [ ] Browse vehicles on home page
- [ ] Book a vehicle (simulated payment)
- [ ] Check admin panel for booking

## Optional: Real SMS

- [ ] Sign up for MSG91 or Twilio
- [ ] Get API credentials
- [ ] Add to Vercel env vars:
  ```
  MSG91_AUTH_KEY="..."
  MSG91_TEMPLATE_ID="..."
  MSG91_SENDER_ID="..."
  ```
- [ ] Change `OTP_CONSOLE_LOG="false"`
- [ ] Redeploy

## Optional: Real Payments

- [ ] Sign up for Razorpay at https://razorpay.com
- [ ] Get API keys
- [ ] Add to Vercel env vars:
  ```
  RAZORPAY_KEY_ID="..."
  RAZORPAY_KEY_SECRET="..."
  RAZORPAY_WEBHOOK_SECRET="..."
  NEXT_PUBLIC_RAZORPAY_KEY_ID="..."
  PAYMENT_MODE="razorpay"
  FREE_MODE="off"
  ```
- [ ] Redeploy

## Post-Deployment

- [ ] Change `ADMIN_PASSWORD` to something secure
- [ ] Customize branding (colors, logo, text)
- [ ] Add your business info to footer
- [ ] Test all booking flows
- [ ] Add real SMS provider (optional)
- [ ] Add real payment provider (optional)
- [ ] Invite team members

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `DATABASE_URL is undefined` | Check Vercel env vars are set |
| `Cannot connect to Supabase` | Check password and connection string |
| `Build fails with Prisma error` | Run `npx prisma db push` locally first |
| `OTP not visible` | Check Vercel Function Logs (Step 6 in SETUP_GUIDE.md) |
| `Booking not appearing` | Check admin panel under Bookings tab |

---

## Success Criteria ✅

You're done when:
1. Vercel shows ✅ Production
2. Site loads at Vercel URL
3. Can login as admin
4. Can register new customer
5. Can browse and book vehicle
6. Booking appears in admin panel

**Total time: ~20 minutes from start to live site**
