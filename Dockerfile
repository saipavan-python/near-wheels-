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

# Wait for DB reachable, ensure schema, then serve.
# Cloud Run overrides PORT env (8080). SESSION_SECRET etc. come from runtime env vars.
CMD ["sh", "-c", "npx prisma generate >/dev/null 2>&1; npx prisma db push --skip-generate >/dev/null 2>&1; node node_modules/next/dist/bin/next start -p ${PORT:-8080}"]