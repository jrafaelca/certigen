# Certigen

Nuxt 3 fullstack app for generating TLS certificates with manual DNS validation, packaging them into a private ZIP, and downloading the bundle from the browser.

## What it does

- Creates ACME requests with a primary domain plus additional SANs.
- Runs Certbot inside the container with `spawn()`.
- Shows the TXT record you need to create and waits for manual confirmation.
- Verifies DNS propagation with configurable resolvers.
- Emits, exports, and compresses the certificate.
- Provides a temporary download link with a usage limit.
- Includes installation examples for Nginx, Apache, HAProxy, Node.js, Docker Compose, IIS, and PFX.
- Uses Nuxt UI for the wizard interface.

## Docker

Production:

```bash
docker compose up --build
```

By default, `compose.yaml` pulls `ghcr.io/jrafaelca/certigen:latest`. Override `IMAGE_NAME` if you want a different tag or registry.

Development with hot reload:

```bash
docker compose -f compose.local.yaml up --build
```

## Environment

Copy [.env.example](/Users/jrafaelca/Projects/howen-acme-certificates/.env.example) to `.env` and adjust values as needed.

- `APP_NAME` controls the document title, the general app name, and the logo label. The default is `Certigen`.
- The remaining values configure the runtime and certificate workflow.

## Persistent data

- `data/certbot`
- `data/requests`
- `data/exports`
- `data/downloads`

## Tests

```bash
pnpm test
```
