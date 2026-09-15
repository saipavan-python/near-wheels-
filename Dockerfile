# Near Wheels — Google Cloud Run image
# Multi-stage build: deps -> build -> slim runtime
# Prisma needs the query engine generated at build time; sharp needs its native libs.

FROM node:20-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl libc6 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# Generate Prisma client against the production schema (no DB connection needed here)
RUN npx prisma generate
# Build with required envs (values are read at build time by Next for PUBLIC_* only)
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=${NEXT_PUBLIC_RAZORPAY_KEY_ID}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates libc6 && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# App code + build output
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
# Keep original source so prisma seed scripts / db push can run if needed
COPY --from=builder /app/scripts ./scripts 2>/dev/null || true

# Writable uploads dir (Cloud Run: use a mounted volume or GCS for persistence across restarts)
RUN mkdir -p data/uploads && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Schema is migrated in CI (prisma db push / migrate) BEFORE deployment.
# Running `prisma db push` on every cold start is unsafe with concurrent
# instances and makes startups slow. Prisma client is already generated in the
# builder stage and copied into the runner image.
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -p ${PORT:-8080}"]