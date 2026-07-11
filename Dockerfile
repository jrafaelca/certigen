FROM node:24-bookworm-slim AS base

ENV PORT=3000 \
    APP_HOST=0.0.0.0 \
    DATA_DIR=/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends zip openssl ca-certificates certbot \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY . .
RUN mkdir -p /data && chmod +x /app/server/certbot-hooks/*.js
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
