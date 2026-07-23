FROM node:24-bookworm-slim AS base

ENV PORT=3000 \
    APP_HOST=0.0.0.0 \
    DATA_DIR=/data

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS development
ENV NODE_ENV=development \
    CI=true
CMD ["pnpm", "dev"]

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS production
ENV PORT=3000 \
    APP_HOST=0.0.0.0 \
    DATA_DIR=/data \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends zip openssl ca-certificates certbot \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY server/utils ./server/utils
COPY server/certbot-hooks ./server/certbot-hooks
RUN mkdir -p /data && chmod +x /app/server/certbot-hooks/*.js
CMD ["node", ".output/server/index.mjs"]
