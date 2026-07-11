# Agent Notes

## Goal

This repo is a Nuxt 4 fullstack app for manual DNS certificate generation.

## How to work here

- Use `pnpm dev` for local development.
- Use `pnpm build` for production validation.
- Use `pnpm test` for the existing Node tests.
- Use Nuxt MCP when answering Nuxt framework questions.

## Project Map

- `nuxt.config.ts` - Nuxt and Nuxt UI configuration.
- `app/app.vue` - root app shell.
- `app/pages/index.vue` - main wizard UI.
- `app/assets/css/main.css` - shared styling.
- `server/api/*` - health, request, verification, cancel, and download routes.
- `server/certbot-hooks/*` - Certbot manual hooks.
- `server/plugins/*` - server bootstrap and lifecycle hooks.
- `server/utils/*` - shared runtime and API helpers.
- `server/services/*` - ACME, DNS, export, and request orchestration logic.
- `compose.local.yaml` - Docker development stack.
- `compose.yaml` - Docker production stack.

## API Routes

- `GET /api/health`
- `POST /api/requests`
- `GET /api/requests/:requestId`
- `POST /api/requests/:requestId/verify`
- `POST /api/requests/:requestId/cancel`
- `POST /api/requests/:requestId/challenges/:challengeId/verify`
- `GET /api/download/:downloadUuid`

## References

- Nuxt MCP: https://nuxt.com/docs/4.x/guide/ai/mcp
- Nuxt LLMs.txt: https://nuxt.com/docs/4.x/guide/ai/llms-txt
- Nuxt installation: https://nuxt.com/docs/4.x/getting-started/installation
- Nuxt UI installation: https://ui.nuxt.com/docs/getting-started/installation/nuxt

## Constraints

- Keep the wizard sequential and locked.
- Keep the UI in English.
- Keep Certbot hooks executable and filesystem-based.
- Never log or expose private keys.
