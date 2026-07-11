#!/usr/bin/env node
import path from 'node:path'
import { readJson, writeJsonAtomic, ensureDir, listFiles } from '../utils/json-store.js'
import { nowIso } from '../utils/utils.js'

const requestId = process.env.REQUEST_ID
const requestDir = process.env.REQUEST_DIR
const challengeDir = process.env.REQUEST_CHALLENGE_DIR || path.join(requestDir || '', 'challenges')
const domain = String(process.env.CERTBOT_DOMAIN || '')
const validation = String(process.env.CERTBOT_VALIDATION || '')

if (!requestId || !requestDir || !domain) {
  process.exit(0)
}

await ensureDir(challengeDir)
const files = await listFiles(challengeDir, '.json')

for (const file of files) {
  const challenge = await readJson(file, null)
  if (!challenge) continue

  if (challenge.domain === domain && challenge.recordValue === validation) {
    await writeJsonAtomic(file, {
      ...challenge,
      status: 'cleaned',
      cleanedAt: nowIso(),
      updatedAt: nowIso(),
    })
  }
}
