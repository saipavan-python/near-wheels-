# Near Wheels — Google Cloud Run image
# Multi-stage build using Next.js `standalone` output:
#   - deps: full install (runs `prisma generate` via postinstall)
#   - builder: Next build against the exact same node_modules
#   - runner: minimal image — only the traced runtime bundle
#
# Cloud Run notes:
#   - The root filesystem is READ-ONLY except /tmp. Uploads go to
#     $UPLOAD_DIR (default /tmp/uploads) which is writable. For persistent
#     uploads, mount a Cloud Storage / Filestore volume at /tmp/uploads and
#     Cloud Run injects it over the same path.
#   - Schema is migrated in CI (prisma db push / migrate) BEFORE deploy;
#     the container never runs `prisma db push` (unsafe across instances).

FROM node:20-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# Public env vars are inlined at build time. Server-side secrets are NOT needed here.
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=${NEXT_PUBLIC_RAZORPAY_KEY_ID}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Non-root user for Cloud Run / runtime security
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# Standalone runtime bundle + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Schema + seed so db push / seed scripts can be run inside the container if needed
COPY --from=builder /app/prisma ./prisma

# Writable upload dirs (Cloud Run: mount a GCS volume here for persistence)
RUN mkdir -p /tmp/uploads data/uploads && chown -R nextjs:nodejs /tmp/uploads data/uploads /app

USER nextjs
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]