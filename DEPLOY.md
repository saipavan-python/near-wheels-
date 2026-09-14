# 🚀 Hosting Near Wheels on Google Cloud (Run + Neon Postgres)

## ✅ What is ALREADY ready
- Production build passes (`npm run build`), all routes compile
- Dockerfile + .dockerignore for Cloud Run / any container host
- Schema works on **both SQLite and PostgreSQL** (no code change needed)
- Session cookies auto-switch to `Secure` in production
- OTP, bookings, payments, admin — all APIs verified working

---

## 🔴 BLOCKERS you must finish BEFORE real users
| # | Item | Why | How |
|---|------|-----|-----|
| 1 | **SMS provider for OTP** | In production the OTP is stored in DB but never sent to phones | Add MSG91 / Twilio / Fast2SMS: call their API inside `src/app/api/auth/otp/route.ts`, put API key in env |
| 2 | **Real payment gateway** | Payments are simulated (`sim_...` refs) | Razorpay: create order in `initiatePayment`, verify signature in `verifyPayment` |
| 3 | **Strong `SESSION_SECRET`** | Falls back to a dev default | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## 📋 Deploy steps (Google Cloud Run)

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

> 💡 **Easier alternative:** Vercel (vercel.com) — push code to GitHub → Import → paste env vars → Deploy. No Docker needed; free SSL + CDN.

---

## 🔐 Env vars summary (set at deploy time)
| Key | Example |
|-----|---------|
| DATABASE_URL | postgresql://…?sslmode=require |
| SESSION_SECRET | 64-char random hex |
| ADMIN_PHONE | your phone |
| ADMIN_PASSWORD | strong password |
| GEMINI_API_KEY | from aistudio.google.com |
| PAYMENT_MODE | gateway (later) |

## 🧹 Pre-launch hygiene
- [ ] Change admin password from the seed default
- [ ] Delete demo data (`npm run db:reset` clears; or skip seeding)
- [ ] Point a custom domain (Cloud Run → Domain mappings / Vercel → Domains)
- [ ] Enable Cloud Run request logging & billing alerts
