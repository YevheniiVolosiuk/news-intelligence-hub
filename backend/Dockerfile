# syntax=docker/dockerfile:1
# News Intelligence Hub - backend image (NestJS API, BullMQ workers, Bull Board).
# One image, four entrypoints selected via the compose `command:`: the API
# (dist/main.js), the feed-pull worker (dist/worker-pull.js), the article-label
# worker (dist/worker-label.js), and Bull Board (dist/bull-board.js). See ADR-0004
# for why pull and label run as separate services.

# --- Dependencies (production only) ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# --- Builder (full deps + compile to dist/) ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

# --- Development (full deps, source mounted at runtime, hot reload) ---
FROM node:24-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
EXPOSE 3000 9229
CMD ["npm", "run", "start:dev"]

# --- Production (minimal, non-root, runtime artifacts only) ---
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S appuser && adduser -S -u 1001 -G appuser appuser
COPY --from=deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --chown=appuser:appuser package.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/main.js"]
