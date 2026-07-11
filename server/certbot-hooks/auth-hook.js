#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ensureDir, pathExists, writeJsonAtomic } from '../utils/json-store.js'
import { nowIso, sleep } from '../utils/utils.js'

const requestId = process.env.REQUEST_ID
const requestDir = process.env.REQUEST_DIR
const timeoutMs = Number(process.env.CHALLENGE_TIMEOUT_MS || 10 * 60 * 1000)
const startedAt = Date.now()

if (!requestId || !requestDir) {
  process.stderr.write('REQUEST_ID and REQUEST_DIR are required\n')
  process.exit(2)
}

const domain = String(process.env.CERTBOT_DOMAIN || '')
const validation = String(process.env.CERTBOT_VALIDATION || '')
const challengeDir = process.env.REQUEST_CHALLENGE_DIR || path.join(requestDir, 'challenges')
const signalDir = process.env.REQUEST_SIGNAL_DIR || path.join(requestDir, 'signals')
const challengeId = randomUUID()
const normalizedDomain = domain.replace(/^\*\./, '')
const challenge = {
  id: challengeId,
  requestId,
  domain,
  recordType: 'TXT',
  recordName: `_acme-challenge.${normalizedDomain}`,
  recordValue: validation,
  status: 'waiting',
  createdAt: nowIso(),
  updatedAt: nowIso(),
  expiresAt: new Date(startedAt + timeoutMs).toISOString(),
}

await ensureDir(challengeDir)
await ensureDir(signalDir)
await writeJsonAtomic(path.join(challengeDir, `${challengeId}.json`), challenge)

const continueFile = path.join(signalDir, `${challengeId}.continue`)
const cancelFile = path.join(signalDir, 'cancel')

while (Date.now() - startedAt < timeoutMs) {
  if (await pathExists(cancelFile)) {
    await writeJsonAtomic(path.join(challengeDir, `${challengeId}.json`), {
      ...challenge,
      status: 'cancelled',
      updatedAt: nowIso(),
    })
    process.stderr.write(`Cancelled challenge ${challengeId}\n`)
    process.exit(2)
  }

  if (await pathExists(continueFile)) {
    await writeJsonAtomic(path.join(challengeDir, `${challengeId}.json`), {
      ...challenge,
      status: 'continued',
      updatedAt: nowIso(),
    })
    process.exit(0)
  }

  await sleep(1000)
}

await writeJsonAtomic(path.join(challengeDir, `${challengeId}.json`), {
  ...challenge,
  status: 'timeout',
  updatedAt: nowIso(),
})
process.stderr.write(`Timeout waiting for ${challengeId}\n`)
process.exit(1)
