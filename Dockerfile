# ============================================================
# Dockerfile — Invoice App (Next.js 15 + Puppeteer)
# Multi-stage build → final image ~600 MB (incl. Chromium for PDF)
# ============================================================

# Cache puppeteer's Chromium at a known path that all stages share
ARG PUPPETEER_CACHE=/app/.cache/puppeteer

# ---- Stage 1: deps (install npm packages + Chromium) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ARG PUPPETEER_CACHE
ENV PUPPETEER_CACHE_DIR=${PUPPETEER_CACHE}
COPY package.json package-lock.json* ./
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates wget gnupg \
    && rm -rf /var/lib/apt/lists/*
# Install npm deps. Allow postinstall scripts (Puppeteer downloads Chromium here)
RUN npm ci
# Explicitly ensure Chrome is downloaded into our known cache path
RUN npx puppeteer browsers install chrome \
    && ls -la ${PUPPETEER_CACHE_DIR}

# ---- Stage 2: builder (Next.js build) ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG PUPPETEER_CACHE
ENV PUPPETEER_CACHE_DIR=${PUPPETEER_CACHE}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps ${PUPPETEER_CACHE} ${PUPPETEER_CACHE}
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 3: runner (production) ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ARG PUPPETEER_CACHE

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Bangkok
ENV PUPPETEER_CACHE_DIR=${PUPPETEER_CACHE}

# Install Chromium runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
      libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 \
      libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 \
      libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 \
      libxfixes3 libxkbcommon0 libxrandr2 xdg-utils \
      tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Puppeteer package + downloaded Chromium (use the explicit cache path)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/puppeteer ./node_modules/puppeteer
COPY --from=builder --chown=nextjs:nodejs ${PUPPETEER_CACHE} ${PUPPETEER_CACHE}

# Uploads dir
RUN mkdir -p /app/public/uploads/signatures && chown -R nextjs:nodejs /app/public/uploads

# Backups dir (pg_dump output from /backup UI). Mounted as a volume in
# docker-compose so backups persist across container rebuilds.
RUN mkdir -p /app/backups && chown -R nextjs:nodejs /app/backups

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
