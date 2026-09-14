# Near Wheels — production container (Google Cloud Run / any Docker host)
FROM node:18-slim
WORKDIR /app

# Prisma schema must exist before npm ci so the client can generate
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Cloud Run injects $PORT; default 8080 locally in Docker
CMD ["sh", "-c", "npx next start -p ${PORT:-8080}"]
