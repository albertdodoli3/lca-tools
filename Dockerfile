# Immagine di produzione: Node 22 + Chromium (per generare i PDF firmati)
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Europe/Rome
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM base AS run
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json /app/next.config.mjs ./
USER node
EXPOSE 3000
# Applica le migrazioni del database, crea il template LCA (solo la prima volta) e avvia
CMD ["sh", "-c", "npx prisma migrate deploy && node node_modules/tsx/dist/cli.mjs prisma/seed.ts && npx next start"]
