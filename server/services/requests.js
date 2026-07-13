import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requestPaths } from './paths.js';
import { ensureDir, readJson, removeIfExists, writeJsonAtomic, pathExists, listFiles } from '../utils/json-store.js';
import { validateRequestInput, validateDownloadUuid, validateSessionId } from '../utils/validation.js';
import { normalizeDomainSet, nowIso, sameDomainSet, sleep } from '../utils/utils.js';
import { startCertbotProcess } from './certbot.js';
import { verifyDnsRecord } from './dns.js';
import { packageCertificate } from './export.js';

function statusPayload(status, extras = {}) {
  return {
    status,
    updatedAt: nowIso(),
    message: null,
    error: null,
    downloadUuid: null,
    downloadName: null,
    downloadRemaining: null,
    downloadExpiresAt: null,
    issuedAt: null,
    expiresAt: null,
    serialNumber: null,
    fingerprintSha256: null,
    recentLogs: [],
    ...extras,
  };
}

async function readTail(filePath, maxLines = 80) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.split('\n').filter(Boolean).slice(-maxLines);
  } catch {
    return [];
  }
}

function extractFailureMessage(lines = [], fallback = 'Unexpected error.') {
  const meaningful = [...lines].reverse().find((line) => {
    if (!line) return false
    if (line.startsWith('error Certbot exited with code')) return false
    if (line.startsWith('error Certbot could not start inside the container.')) return false
    return /^(stderr|stdout|error)\s+/i.test(line)
  })

  if (!meaningful) {
    return fallback
  }

  return meaningful.replace(/^(stderr|stdout|error)\s+/i, '')
}

function describeDnsFailure(status) {
  switch (status) {
    case 'incorrect_value':
      return 'The TXT record exists, but the value does not match.'
    case 'not_found':
      return 'The TXT record is not visible yet.'
    default:
      return 'The TXT record could not be verified.'
  }
}

function getDnsResolvers(request) {
  const resolvers = Array.isArray(request?.resolvers) ? request.resolvers.filter(Boolean) : [];

  if (!resolvers.length) {
    return undefined;
  }

  if (resolvers.length === 1 && resolvers[0] === 'system') {
    return undefined;
  }

  return resolvers;
}

function requestFile(requestId, dataDir) {
  return requestPaths(dataDir, requestId);
}

function normalizeSessionId(value) {
  const sessionId = String(value ?? '').trim();
  return validateSessionId(sessionId) ? sessionId : '';
}

function normalizeRequestId(value) {
  const requestId = String(value ?? '').trim();
  return validateDownloadUuid(requestId) ? requestId : '';
}

async function readChallenges(challengesDir) {
  const files = await listFiles(challengesDir, '.json');
  const challenges = [];
  for (const file of files) {
    const challenge = await readJson(file, null);
    if (challenge) {
      challenges.push(challenge);
    }
  }
  challenges.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return challenges;
}

async function readDownloadMetadata(dataDir, downloadUuid) {
  const meta = await readJson(path.join(dataDir, 'downloads', `${downloadUuid}.json`), null);
  return meta;
}

async function writeDownloadMetadata(dataDir, downloadUuid, metadata) {
  await writeJsonAtomic(path.join(dataDir, 'downloads', `${downloadUuid}.json`), metadata);
}

async function removeDownloadArtifacts(dataDir, downloadUuid) {
  const downloadDir = path.join(dataDir, 'downloads');
  const exportsDir = path.join(dataDir, 'exports', downloadUuid);
  await removeIfExists(path.join(downloadDir, `${downloadUuid}.json`));
  await removeIfExists(path.join(downloadDir, `${downloadUuid}.zip`));
  await fs.rm(exportsDir, { recursive: true, force: true });
}

async function markRequestExpired(dataDir, requestId, message = 'The download expired.') {
  const paths = requestFile(requestId, dataDir);
  const state = (await readJson(paths.stateJson, statusPayload('expired'))) || statusPayload('expired');
  await writeJsonAtomic(paths.stateJson, {
    ...state,
    status: 'expired',
    message,
    error: null,
    updatedAt: nowIso(),
  });
}

export class RequestManager {
  constructor({ dataDir, logger, config }) {
    this.dataDir = dataDir;
    this.logger = logger;
    this.config = config;
    this.active = new Map();
  }

  async init() {
    await ensureDir(path.join(this.dataDir, 'certbot', 'config'));
    await ensureDir(path.join(this.dataDir, 'certbot', 'work'));
    await ensureDir(path.join(this.dataDir, 'certbot', 'logs'));
    await ensureDir(path.join(this.dataDir, 'requests'));
    await ensureDir(path.join(this.dataDir, 'exports'));
    await ensureDir(path.join(this.dataDir, 'downloads'));
  }

  async findExistingCertificate(payload) {
    const validation = validateRequestInput(payload);
    if (!validation.ok) {
      const error = new Error(validation.errors.join(' '));
      error.statusCode = 400;
      throw error;
    }

    const sessionId = normalizeSessionId(payload?.sessionId);
    if (!sessionId) {
      return null;
    }

    const targetDomains = normalizeDomainSet(validation.value.domains);
    const requestsDir = path.join(this.dataDir, 'requests');
    const requestIds = await fs.readdir(requestsDir).catch(() => []);
    let latestMatch = null;

    for (const requestId of requestIds) {
      const paths = requestFile(requestId, this.dataDir);
      const request = await readJson(paths.requestJson, null);
      if (!request || !Array.isArray(request.domains) || !request.domains.length) {
        continue;
      }

      if (request.sessionId !== sessionId || !request.primaryDomain || !sameDomainSet(request.domains, targetDomains)) {
        continue;
      }

      const state = await readJson(paths.stateJson, null);
      if (!state || state.status !== 'ready' || !state.downloadUuid) {
        continue;
      }

      const download = await this.refreshDownload(state.downloadUuid);
      if (!download) {
        continue;
      }

      const fullRequest = await this.getRequest(requestId);
      if (!latestMatch || new Date(fullRequest.updatedAt).getTime() > new Date(latestMatch.updatedAt).getTime()) {
        latestMatch = fullRequest;
      }
    }

    return latestMatch;
  }

  async createRequest(payload) {
    const validation = validateRequestInput(payload);
    if (!validation.ok) {
      const error = new Error(validation.errors.join(' '));
      error.statusCode = 400;
      throw error;
    }

    const sessionId = normalizeSessionId(payload?.sessionId);
    if (!sessionId) {
      const error = new Error('Invalid wizard session.');
      error.statusCode = 400;
      throw error;
    }

    const renewalRequestId = normalizeRequestId(payload?.renewalRequestId);
    if (renewalRequestId) {
      await this.invalidateRequest(renewalRequestId, 'The previous certificate bundle was replaced by a renewal.');
    }

    if ((await this.countActive()) >= this.config.maxConcurrentRequests) {
      const error = new Error('The concurrent request limit was reached.');
      error.statusCode = 429;
      throw error;
    }

    const requestId = randomUUID();
    const paths = requestFile(requestId, this.dataDir);
    const createdAt = nowIso();
    const request = {
      requestId,
      createdAt,
      updatedAt: createdAt,
      sessionId,
      ...validation.value,
      certificateAuthority: validation.value.certificateAuthority || 'letsencrypt',
      downloadTtlMinutes: this.config.downloadTtlMinutes,
      downloadMaxCount: 1,
    };

    await Promise.all([
      ensureDir(paths.root),
      ensureDir(paths.challengesDir),
      ensureDir(paths.signalsDir),
      ensureDir(paths.logsDir),
      ensureDir(paths.outputDir),
    ]);

    await writeJsonAtomic(paths.requestJson, request);
    await writeJsonAtomic(
      paths.stateJson,
      statusPayload('pending', { message: 'Request created. Preparing Certbot.' }),
    );

    this.logger.info(
      {
        event: 'request.created',
        request_id: requestId,
        session_id: sessionId,
        primary_domain: request.primaryDomain,
        domains_count: request.domains.length,
      },
      'certificate request created',
    );

    this.launchCertbot(request, paths).catch((error) => {
      this.failRequest(requestId, error);
    });

    return this.getRequest(requestId);
  }

  async launchCertbot(request, paths) {
    const requestId = request.requestId;
    await this.updateState(requestId, {
      status: 'starting',
      message: 'Preparing Certbot.',
      error: null,
    });

    const child = startCertbotProcess({
      request,
      requestDir: paths.root,
      paths,
      logger: this.logger,
      onOutput: async (line) => {
        await this.appendLog(requestId, line);
      },
      onExit: async (error, exit) => {
        this.active.delete(requestId);
        const paths = requestFile(requestId, this.dataDir);
        const currentState = await readJson(paths.stateJson, null);

        if (currentState?.status === 'cancelled') {
          return;
        }

        if (error) {
          await this.failRequest(requestId, error);
          return;
        }

        if (exit?.code !== 0) {
          const currentState = await readJson(paths.stateJson, statusPayload('starting'));
          const recentLogs = currentState?.recentLogs || [];
          const failureMessage = extractFailureMessage(
            recentLogs,
            exit?.code === -2
              ? 'Certbot could not start inside the container.'
              : `Certbot exited with code ${exit.code}${exit.signal ? ` (${exit.signal})` : ''}`,
          );
          const message =
            failureMessage;
          await this.failRequest(requestId, new Error(message));
          return;
        }

        try {
          await this.updateState(requestId, {
            status: 'packaging',
            message: 'Packaging the ZIP.',
            error: null,
          });
          const packaged = await packageCertificate({
            request,
            paths,
            dataDir: this.dataDir,
            logger: this.logger,
          });

          const downloadExpiresAt = new Date(Date.now() + request.downloadTtlMinutes * 60_000).toISOString();
          const metadata = {
            downloadUuid: packaged.downloadUuid,
            requestId,
            filename: packaged.filename,
            createdAt: nowIso(),
            expiresAt: downloadExpiresAt,
            remainingDownloads: request.downloadMaxCount,
          };
          await writeDownloadMetadata(this.dataDir, packaged.downloadUuid, metadata);
          await this.updateState(requestId, {
            status: 'ready',
            message: 'Certificate ready for download.',
            downloadUuid: packaged.downloadUuid,
            downloadName: packaged.filename,
            downloadRemaining: request.downloadMaxCount,
            downloadExpiresAt,
            issuedAt: packaged.metadata.issuedAt,
            expiresAt: packaged.metadata.expiresAt,
            serialNumber: packaged.metadata.serialNumber,
            fingerprintSha256: packaged.metadata.fingerprintSha256,
            error: null,
          });
          this.logger.info(
            {
              event: 'request.ready',
              request_id: requestId,
              download_id: packaged.downloadUuid,
            },
            'certificate request ready',
          );
        } catch (packageError) {
          await this.failRequest(requestId, packageError);
        }
      },
    });

    this.active.set(requestId, child);
    return child;
  }

  async countActive() {
    let count = 0;
    for (const child of this.active.values()) {
      if (child && !child.killed) count += 1;
    }
    return count;
  }

  async updateState(requestId, patch) {
    const paths = requestFile(requestId, this.dataDir);
    const current = (await readJson(paths.stateJson, statusPayload('pending'))) || statusPayload('pending');
    const next = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    await writeJsonAtomic(paths.stateJson, next);
    return next;
  }

  async appendLog(requestId, line) {
    const paths = requestFile(requestId, this.dataDir);
    const state = (await readJson(paths.stateJson, statusPayload('pending'))) || statusPayload('pending');
    const recentLogs = [...(state.recentLogs || []), line].slice(-120);
    await writeJsonAtomic(paths.stateJson, {
      ...state,
      recentLogs,
      updatedAt: nowIso(),
    });
    await fs.appendFile(path.join(paths.logsDir, 'request.log'), `${nowIso()} ${line}\n`);
  }

  async failRequest(requestId, error) {
    const message =
      error?.code === 'ENOENT'
        ? 'Certbot is not installed in the image.'
        : error?.message || 'Unexpected error.';
    await this.updateState(requestId, {
      status: 'failed',
      message: 'Issuance failed.',
      error: message,
    });
    await this.appendLog(requestId, `error ${message}`);
    this.logger.error({ event: 'request.failed', request_id: requestId, error: message }, 'request failed');
  }

  async getRequest(requestId) {
    const paths = requestFile(requestId, this.dataDir);
    const request = await readJson(paths.requestJson, null);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }

    const state = await readJson(paths.stateJson, statusPayload('pending'));
    const challenges = await readChallenges(paths.challengesDir);
    const download = state.downloadUuid ? await readDownloadMetadata(this.dataDir, state.downloadUuid) : null;

    return {
      ...request,
      ...state,
      challenges,
      download,
      recentLogs: state.recentLogs || [],
    };
  }

  async verifyRequest(requestId) {
    const request = await this.getRequest(requestId);
    const paths = requestFile(requestId, this.dataDir);
    const results = [];
    const challenges = await readChallenges(paths.challengesDir);

    if (!challenges.length) {
      const error = new Error('No challenges are available yet.');
      error.statusCode = 409;
      throw error;
    }

    await this.updateState(requestId, {
      status: 'checking_dns',
      message: 'Checking TXT records via DNS.',
      error: null,
    });

    for (const challenge of challenges) {
      const result = await verifyDnsRecord({
        recordName: challenge.recordName,
        expectedValue: challenge.recordValue,
        resolvers: getDnsResolvers(request),
      });

      results.push({ challengeId: challenge.id, ...result });

      if (result.status === 'propagated') {
        const continueFile = path.join(paths.signalsDir, `${challenge.id}.continue`);
        await writeJsonAtomic(path.join(paths.challengesDir, `${challenge.id}.json`), {
          ...challenge,
          status: 'propagated',
          verifiedAt: nowIso(),
          verification: result,
        });
        await fs.writeFile(continueFile, `${nowIso()}\n`, { flag: 'wx' }).catch(async () => {
          await fs.writeFile(continueFile, `${nowIso()}\n`);
        });
      } else {
        await writeJsonAtomic(path.join(paths.challengesDir, `${challenge.id}.json`), {
          ...challenge,
          status: result.status,
          verifiedAt: nowIso(),
          verification: result,
        });
      }
    }

    const allPropagated = results.every((item) => item.status === 'propagated');
    const failingResult = results.find((item) => item.status !== 'propagated');
    const failureMessage = describeDnsFailure(failingResult?.status);
    await this.updateState(requestId, {
      status: allPropagated ? 'issuing' : 'waiting_dns',
      message: allPropagated ? 'All TXT records are visible. Certbot can continue.' : failureMessage,
      error: allPropagated ? null : failureMessage,
    });

    return this.getRequest(requestId);
  }

  async verifyChallenge(requestId, challengeId) {
    const paths = requestFile(requestId, this.dataDir);
    const challengePath = path.join(paths.challengesDir, `${challengeId}.json`);
    const challenge = await readJson(challengePath, null);
    if (!challenge) {
      const error = new Error('Challenge not found.');
      error.statusCode = 404;
      throw error;
    }

    const request = await this.getRequest(requestId);
    const result = await verifyDnsRecord({
      recordName: challenge.recordName,
      expectedValue: challenge.recordValue,
      resolvers: getDnsResolvers(request),
    });

    await writeJsonAtomic(challengePath, {
      ...challenge,
      status: result.status,
      verifiedAt: nowIso(),
      verification: result,
    });

    if (result.status === 'propagated') {
      const continueFile = path.join(paths.signalsDir, `${challenge.id}.continue`);
      await fs.writeFile(continueFile, `${nowIso()}\n`, { flag: 'wx' }).catch(async () => {
        await fs.writeFile(continueFile, `${nowIso()}\n`);
      });
    }

    const refreshed = await readChallenges(paths.challengesDir);
    const allPropagated = refreshed.every((item) => item.status === 'propagated');
    const failureMessage = describeDnsFailure(result.status);
    await this.updateState(requestId, {
      status: allPropagated ? 'issuing' : 'waiting_dns',
      message: allPropagated ? 'Challenge visible. Certbot can continue.' : failureMessage,
      error: allPropagated ? null : failureMessage,
    });

    return this.getRequest(requestId);
  }

  async cancelRequest(requestId) {
    const paths = requestFile(requestId, this.dataDir);

    await writeJsonAtomic(paths.stateJson, {
      ...(await readJson(paths.stateJson, statusPayload('pending'))),
      status: 'cancelled',
      message: 'Request cancelled.',
      error: null,
      updatedAt: nowIso(),
    });

    await fs.writeFile(path.join(paths.signalsDir, 'cancel'), `${nowIso()}\n`).catch(() => {});
    const child = this.active.get(requestId);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await sleep(3000);
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }

    this.active.delete(requestId);
    this.logger.warn({ event: 'request.cancelled', request_id: requestId }, 'request cancelled');
    return this.getRequest(requestId);
  }

  async refreshDownload(downloadUuid) {
    if (!validateDownloadUuid(downloadUuid)) {
      return null;
    }

    const metadata = await readDownloadMetadata(this.dataDir, downloadUuid);
    if (!metadata) {
      return null;
    }

    if (metadata.remainingDownloads <= 0) {
      return null;
    }

    if (new Date(metadata.expiresAt).getTime() <= Date.now()) {
      await markRequestExpired(this.dataDir, metadata.requestId);
      await removeDownloadArtifacts(this.dataDir, downloadUuid);
      return null;
    }

    return metadata;
  }

  async consumeDownload(downloadUuid) {
    const metadata = await this.refreshDownload(downloadUuid);
    if (!metadata) {
      return null;
    }

    if (metadata.remainingDownloads <= 0) {
      await removeDownloadArtifacts(this.dataDir, downloadUuid);
      return null;
    }

    metadata.remainingDownloads -= 1;
    metadata.lastDownloadedAt = nowIso();
    await writeDownloadMetadata(this.dataDir, downloadUuid, metadata);

    if (metadata.remainingDownloads <= 0) {
      await markRequestExpired(this.dataDir, metadata.requestId);
    }

    return metadata;
  }

  async finalizeDownload(downloadUuid) {
    if (!validateDownloadUuid(downloadUuid)) {
      return null;
    }

    const metadata = await readDownloadMetadata(this.dataDir, downloadUuid);
    if (!metadata) {
      return null;
    }

    const paths = requestFile(metadata.requestId, this.dataDir);
    await removeDownloadArtifacts(this.dataDir, downloadUuid);
    await fs.rm(paths.root, { recursive: true, force: true });
    return metadata;
  }

  async invalidateRequest(requestId, message = 'The certificate bundle was replaced.') {
    const paths = requestFile(requestId, this.dataDir);
    const request = await readJson(paths.requestJson, null);
    if (!request) {
      return null;
    }

    const state = await readJson(paths.stateJson, statusPayload('expired'));
    if (state?.downloadUuid) {
      await removeDownloadArtifacts(this.dataDir, state.downloadUuid);
    }

    const child = this.active.get(requestId);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await sleep(3000);
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }

    this.active.delete(requestId);

    await fs.rm(paths.root, { recursive: true, force: true });
    this.logger.warn({ event: 'request.invalidated', request_id: requestId }, message);
    return request;
  }

  async cleanupExpired() {
    const downloadsDir = path.join(this.dataDir, 'downloads');
    const files = await listFiles(downloadsDir, '.json');
    for (const file of files) {
      const metadata = await readJson(file, null);
      if (!metadata) continue;
      if (new Date(metadata.expiresAt).getTime() <= Date.now()) {
        const downloadUuid = path.basename(file, '.json');
        await removeDownloadArtifacts(this.dataDir, downloadUuid);
      }
    }

    const requestsDir = path.join(this.dataDir, 'requests');
    const requestIds = await fs.readdir(requestsDir).catch(() => []);
    for (const requestId of requestIds) {
      const paths = requestFile(requestId, this.dataDir);
      const state = await readJson(paths.stateJson, null);
      if (!state) continue;

      const finished = ['ready', 'failed', 'cancelled', 'expired'].includes(state.status);
      const updatedAt = new Date(state.updatedAt).getTime();
      const expired = Number.isFinite(updatedAt) && Date.now() - updatedAt > this.config.requestTtlMinutes * 60_000;

      if (finished && expired) {
        await fs.rm(paths.root, { recursive: true, force: true });
      }
    }
  }
}
