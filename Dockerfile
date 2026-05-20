# ============================================================
# Dockerfile — Invoice App (Next.js 15 + Puppeteer)
# Multi-stage build → final image ~600 MB (incl. Chromium for PDF)
# ============================================================

# ---- Stage 1: deps (install npm packages) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Allow Puppeteer to download Chromium during npm install
ENV PUPPETEER_SKIP_DOWNLOAD=false
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates wget gnupg \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci

# ---- Stage 2: builder (build Next.js) ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 3: runner (production) ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Bangkok

# Install Chromium runtime deps (Puppeteer needs these on Linux)
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

# Copy standalone build (Next.js auto-bundles deps it needs)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Puppeteer's bundled Chromium (not auto-included in standalone)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/puppeteer ./node_modules/puppeteer
COPY --from=builder --chown=nextjs:nodejs /root/.cache/puppeteer /home/nextjs/.cache/puppeteer

# Ensure uploads dir exists and is writable
RUN mkdir -p /app/public/uploads/signatures && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
